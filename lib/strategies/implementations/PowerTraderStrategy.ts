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

  constructor(config: Record<string, unknown>) {
    super(config as never);
    // @ts-ignore
    this.config = config;
    this.warmupPeriod = 20;
  }

  computeSignal(candles: OHLCVCandle[]): Signal {
    const cfg = this.config as Record<string, unknown>;
    const tradeStartLevel = cfg.tradeStartLevel as number ?? 3;
    const startAllocationPct = cfg.startAllocationPct as number ?? 0.5;
    const pmStartPct = cfg.pmStartPct as number ?? 5.0;
    const pmStartPctDCA = cfg.pmStartPctDCA as number ?? 2.5;
    const trailingGapPct = cfg.trailingGapPct as number ?? 0.5;
    const quantity = cfg.quantity as number ?? 0.001;

    // Use injected neural signal level (set externally by PowerTrader runner)
    const neuralLongLevel = (cfg as Record<string, unknown>)._neuralLongLevel as number ?? 0;
    const neuralShortLevel = (cfg as Record<string, unknown>)._neuralShortLevel as number ?? 0;

    const currentPrice = candles[candles.length - 1].close;
    const dcaLevels: DCALevel[] = (cfg.dcaLevels as DCALevel[]) ?? DEFAULT_DCA_LEVELS;

    // === SELL LOGIC: Trailing Profit Margin ===
    if (this.state.inPosition && this.state.avgCostBasis > 0) {
      const pmPct = this.state.dcaCount > 0 ? pmStartPctDCA : pmStartPct;
      const pmBaseLine = this.state.avgCostBasis * (1 + pmPct / 100);

      if (currentPrice >= pmBaseLine) {
        // Activate or update trailing
        if (!this.state.pmActive) {
          this.state.pmActive = true;
          this.state.trailingPeak = currentPrice;
          this.state.trailingPMLine = currentPrice * (1 - trailingGapPct / 100);
        } else if (currentPrice > this.state.trailingPeak) {
          this.state.trailingPeak = currentPrice;
          this.state.trailingPMLine = currentPrice * (1 - trailingGapPct / 100);
        } else if (currentPrice < this.state.trailingPMLine) {
          // Cross: price dropped below trailing line → SELL
          this.state.inPosition = false;
          this.state.pmActive = false;
          this.state.trailingPeak = 0;
          return {
            action: 'sell',
            quantity,
            reason: `Trailing PM sell at ${currentPrice.toFixed(2)} (PM line: ${this.state.trailingPMLine.toFixed(2)})`,
          };
        }
      }
    }

    // === BUY LOGIC: Entry ===
    if (!this.state.inPosition) {
      if (neuralLongLevel >= tradeStartLevel && neuralShortLevel === 0) {
        this.state.inPosition = true;
        this.state.avgCostBasis = currentPrice;
        this.state.positionSize = quantity;
        this.state.dcaStage = 0;
        this.state.dcaCount = 0;
        this.state.pmActive = false;
        return {
          action: 'buy',
          quantity,
          price: currentPrice,
          reason: `Entry: neural long signal ${neuralLongLevel} >= ${tradeStartLevel}`,
        };
      }
      return { action: 'hold', reason: `Waiting for signal (long=${neuralLongLevel}, need ${tradeStartLevel})` };
    }

    // === DCA LOGIC: Add to position ===
    if (this.state.inPosition && this.state.dcaStage < dcaLevels.length) {
      const level = dcaLevels[this.state.dcaStage];
      const gainLossPct = ((currentPrice - this.state.avgCostBasis) / this.state.avgCostBasis) * 100;
      const neuralTriggered = neuralLongLevel >= level.neuralTrigger && gainLossPct < 0;
      const hardTriggered = gainLossPct <= level.hardPctTrigger;

      if (neuralTriggered || hardTriggered) {
        const dcaQty = quantity * level.multiplier;
        const reason = neuralTriggered
          ? `DCA stage ${this.state.dcaStage + 1}: neural level ${neuralLongLevel}`
          : `DCA stage ${this.state.dcaStage + 1}: ${gainLossPct.toFixed(1)}% drawdown`;

        // Update avg cost basis
        const totalCost = this.state.avgCostBasis * this.state.positionSize + currentPrice * dcaQty;
        this.state.positionSize += dcaQty;
        this.state.avgCostBasis = totalCost / this.state.positionSize;
        this.state.dcaStage++;
        this.state.dcaCount++;
        this.state.pmActive = false; // reset trailing on DCA

        return { action: 'buy', quantity: dcaQty, price: currentPrice, reason };
      }
    }

    const gainLossPct = ((currentPrice - this.state.avgCostBasis) / this.state.avgCostBasis) * 100;
    return {
      action: 'hold',
      reason: `Holding position. P&L: ${gainLossPct.toFixed(2)}%, DCA: ${this.state.dcaStage}/${dcaLevels.length}`,
    };
  }

  getState(): PowerTraderState {
    return { ...this.state };
  }
}
