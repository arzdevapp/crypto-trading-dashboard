import { BaseStrategy } from '../BaseStrategy';
import type { Signal } from '@/types/strategy';
import type { OHLCVCandle } from '@/types/exchange';

export interface DCALevel {
  neuralTrigger: number;   // signal level threshold
  hardPctTrigger: number;  // % drawdown trigger
  multiplier: number;      // position size multiplier
}

const DEFAULT_DCA_LEVELS: DCALevel[] = [
  { neuralTrigger: 4, hardPctTrigger: -2.5,  multiplier: 2.0 },
  { neuralTrigger: 5, hardPctTrigger: -5.0,  multiplier: 2.0 },
  { neuralTrigger: 6, hardPctTrigger: -10.0, multiplier: 2.0 },
  { neuralTrigger: 7, hardPctTrigger: -20.0, multiplier: 2.0 },
  { neuralTrigger: 8, hardPctTrigger: -30.0, multiplier: 2.0 },
  { neuralTrigger: 8, hardPctTrigger: -40.0, multiplier: 2.0 },
  { neuralTrigger: 8, hardPctTrigger: -50.0, multiplier: 2.0 },
];

export interface PowerTraderState {
  inPosition: boolean;
  avgCostBasis: number;
  positionSize: number;
  dcaStage: number;
  dcaCount: number;
  trailingPeak: number;
  trailingPMLine: number;
  pmActive: boolean;
  lastSignalLevel: number;
}

export class PowerTraderStrategy extends BaseStrategy {
  readonly type = 'POWER_TRADER';
  readonly name = 'Power Trader (DCA + Neural)';

  private state: PowerTraderState = {
    inPosition: false,
    avgCostBasis: 0,
    positionSize: 0,
    dcaStage: 0,
    dcaCount: 0,
    trailingPeak: 0,
    trailingPMLine: 0,
    pmActive: false,
    lastSignalLevel: 0,
  };

  // Live neural signals injected by StrategyRunner before each tick
  private _neuralLong  = 0;
  private _neuralShort = 0;

  constructor(config: Record<string, unknown>) {
    super(config as never);
    // @ts-ignore
    this.config = config;
    this.warmupPeriod = 20;
  }

  // Called by StrategyRunner before each computeSignal() tick.
  // Decouples signal injection from config so it can't get stale.
  setNeuralSignals(longLevel: number, shortLevel: number): void {
    this._neuralLong  = longLevel;
    this._neuralShort = shortLevel;
  }

  computeSignal(candles: OHLCVCandle[]): Signal {
    const cfg = this.config as Record<string, unknown>;
    const tradeStartLevel  = cfg.tradeStartLevel  as number ?? 3;
    const startAllocationPct = cfg.startAllocationPct as number ?? 0.5;
    const pmStartPct       = cfg.pmStartPct       as number ?? 5.0;
    const pmStartPctDCA    = cfg.pmStartPctDCA    as number ?? 2.5;
    const trailingGapPct   = cfg.trailingGapPct   as number ?? 0.5;
    const quantity         = cfg.quantity         as number ?? 0.001;

    // Prefer live-injected signals; fall back to config for backward compatibility
    const neuralLongLevel  = this._neuralLong  || (cfg._neuralLongLevel  as number ?? 0);
    const neuralShortLevel = this._neuralShort || (cfg._neuralShortLevel as number ?? 0);

    const currentPrice = candles[candles.length - 1].close;
    const dcaLevels: DCALevel[] = (cfg.dcaLevels as DCALevel[]) ?? DEFAULT_DCA_LEVELS;

    // === SELL LOGIC: Trailing Profit Margin ===
    if (this.state.inPosition && this.state.avgCostBasis > 0) {
      const pmPct     = this.state.dcaCount > 0 ? pmStartPctDCA : pmStartPct;
      const pmBaseLine = this.state.avgCostBasis * (1 + pmPct / 100);

      if (currentPrice >= pmBaseLine) {
        if (!this.state.pmActive) {
          this.state.pmActive      = true;
          this.state.trailingPeak  = currentPrice;
          this.state.trailingPMLine = currentPrice * (1 - trailingGapPct / 100);
        } else if (currentPrice > this.state.trailingPeak) {
          this.state.trailingPeak   = currentPrice;
          this.state.trailingPMLine = currentPrice * (1 - trailingGapPct / 100);
        } else if (currentPrice < this.state.trailingPMLine) {
          // Price dropped below trailing line → SELL
          this.state.inPosition = false;
          this.state.pmActive   = false;
          this.state.trailingPeak = 0;
          return {
            action: 'sell',
            quantity,
            reason: `Trailing PM sell at ${currentPrice.toFixed(2)} (PM line: ${this.state.trailingPMLine.toFixed(2)})`,
          };
        }
      }

      // Improvement: also exit if a strong short signal fires while in a losing position
      const gainLossPctNow = ((currentPrice - this.state.avgCostBasis) / this.state.avgCostBasis) * 100;
      if (neuralShortLevel >= 5 && gainLossPctNow < -1) {
        this.state.inPosition = false;
        this.state.pmActive   = false;
        return {
          action: 'sell',
          quantity,
          reason: `Neural short signal ${neuralShortLevel} with position at ${gainLossPctNow.toFixed(1)}% — defensive exit`,
        };
      }
    }

    // === BUY LOGIC: Entry ===
    if (!this.state.inPosition) {
      // Improvement: suppress entry when bearish signal is also elevated (conflicting momentum)
      if (neuralLongLevel >= tradeStartLevel && neuralShortLevel <= 2) {
        this.state.inPosition    = true;
        this.state.avgCostBasis  = currentPrice;
        this.state.positionSize  = quantity;
        this.state.dcaStage      = 0;
        this.state.dcaCount      = 0;
        this.state.pmActive      = false;
        this.state.lastSignalLevel = neuralLongLevel;
        return {
          action: 'buy',
          quantity,
          price: currentPrice,
          reason: `Entry: neural long ${neuralLongLevel} >= ${tradeStartLevel} (short=${neuralShortLevel})`,
        };
      }
      return {
        action: 'hold',
        reason: `Waiting — long=${neuralLongLevel} (need ${tradeStartLevel}), short=${neuralShortLevel}`,
      };
    }

    // === DCA LOGIC: Add to position ===
    if (this.state.inPosition && this.state.dcaStage < dcaLevels.length) {
      const level      = dcaLevels[this.state.dcaStage];
      const gainLossPct = ((currentPrice - this.state.avgCostBasis) / this.state.avgCostBasis) * 100;
      const neuralTriggered = neuralLongLevel >= level.neuralTrigger && gainLossPct < 0;
      const hardTriggered   = gainLossPct <= level.hardPctTrigger;

      if (neuralTriggered || hardTriggered) {
        const dcaQty = quantity * level.multiplier;
        const reason = neuralTriggered
          ? `DCA stage ${this.state.dcaStage + 1}: neural long ${neuralLongLevel} >= ${level.neuralTrigger}`
          : `DCA stage ${this.state.dcaStage + 1}: ${gainLossPct.toFixed(1)}% drawdown`;

        const totalCost         = this.state.avgCostBasis * this.state.positionSize + currentPrice * dcaQty;
        this.state.positionSize += dcaQty;
        this.state.avgCostBasis  = totalCost / this.state.positionSize;
        this.state.dcaStage++;
        this.state.dcaCount++;
        this.state.pmActive = false; // reset trailing on DCA

        return { action: 'buy', quantity: dcaQty, price: currentPrice, reason };
      }
    }

    const gainLossPct = ((currentPrice - this.state.avgCostBasis) / this.state.avgCostBasis) * 100;
    return {
      action: 'hold',
      reason: `Holding. P&L: ${gainLossPct.toFixed(2)}%, DCA: ${this.state.dcaStage}/${dcaLevels.length}, neural: L${neuralLongLevel}/S${neuralShortLevel}`,
    };
  }

  getState(): PowerTraderState {
    return { ...this.state };
  }
}
