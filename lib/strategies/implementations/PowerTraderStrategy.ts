import { BaseStrategy } from '../BaseStrategy';
import type { Signal, StrategyConfig } from '@/types/strategy';
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
  lastBuyPrice: number;
  lastBuyTime: number;
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
    lastBuyPrice: 0,
    lastBuyTime: 0,
  };

  constructor(config: StrategyConfig & Record<string, unknown>) {
    super(config as StrategyConfig);
    this.config = config;
    this.warmupPeriod = 20;
  }

  computeSignal(candles: OHLCVCandle[]): Signal {
    const cfg = this.config as Record<string, unknown>;
    const tradeStartLevel = cfg.tradeStartLevel as number ?? 3;
    const pmStartPct = cfg.pmStartPct as number ?? 5.0;
    const pmStartPctDCA = cfg.pmStartPctDCA as number ?? 2.5;
    const trailingGapPct = cfg.trailingGapPct as number ?? 1.5;
    const legacyQuantity = cfg.quantity as number ?? 0.001;

    // Neural signal levels injected by StrategyRunner before each candle
    const neuralLongLevel = cfg._neuralLongLevel as number ?? 0;
    const neuralShortLevel = cfg._neuralShortLevel as number ?? 0;

    // News sentiment injected by StrategyRunner (-1 bearish → +1 bullish)
    const newsSentiment = cfg._newsSentiment as number ?? 0;
    const newsSentimentLabel = cfg._newsSentimentLabel as string ?? 'Neutral';

    // Adjust entry threshold based on news sentiment:
    // Bad news → require stronger neural signal; good news → allow slightly earlier entry
    const newsAdjustment = newsSentiment <= -0.5 ? 2
      : newsSentiment <= -0.2 ? 1
      : newsSentiment >= 0.4 ? -1
      : 0;
    const effectiveStartLevel = Math.max(1, tradeStartLevel + newsAdjustment);

    const currentPrice = candles[candles.length - 1].close;
    
    let baseQuantity = legacyQuantity;
    if (cfg.investmentPerTrade) {
      baseQuantity = (cfg.investmentPerTrade as number) / currentPrice;
    }

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
          // Cross: price dropped below trailing line → SELL entire accumulated position
          const sellQty = this.state.positionSize;
          const pmLine = this.state.trailingPMLine;
          this.state.inPosition = false;
          this.state.pmActive = false;
          this.state.trailingPeak = 0;
          this.state.trailingPMLine = 0;
          this.state.positionSize = 0;
          this.state.avgCostBasis = 0;
          this.state.dcaStage = 0;
          this.state.dcaCount = 0;
          return {
            action: 'sell',
            quantity: sellQty,
            reason: `Trailing PM sell at ${currentPrice.toFixed(2)} (PM line: ${pmLine.toFixed(2)}) — sold ${sellQty.toFixed(6)} ${String(cfg.symbol ?? '')} total`,
          };
        }
      }
    }

    // === HARD BLOCK: Very bearish news — skip entry entirely ===
    if (!this.state.inPosition && newsSentiment <= -0.5) {
      return { action: 'hold', reason: `News block: sentiment ${newsSentimentLabel} (${newsSentiment.toFixed(2)}) — waiting for neutral` };
    }

    // === BUY LOGIC: Entry ===
    if (!this.state.inPosition) {
      if (neuralLongLevel >= effectiveStartLevel && neuralShortLevel === 0) {
        this.state.inPosition = true;
        this.state.avgCostBasis = currentPrice;
        this.state.positionSize = baseQuantity;
        this.state.dcaStage = 0;
        this.state.dcaCount = 0;
        this.state.pmActive = false;
        this.state.lastBuyPrice = currentPrice;
        this.state.lastBuyTime = Date.now();
        return {
          action: 'buy',
          quantity: baseQuantity,
          price: currentPrice,
          reason: `Entry: neural ${neuralLongLevel}>=${effectiveStartLevel}, news=${newsSentimentLabel}`,
        };
      }
      return { action: 'hold', reason: `Waiting: neural=${neuralLongLevel} need ${effectiveStartLevel}, news=${newsSentimentLabel}` };
    }

    // === DCA LOGIC: Add to position ===
    if (this.state.inPosition && this.state.dcaStage < dcaLevels.length) {
      const level = dcaLevels[this.state.dcaStage];
      const gainLossPct = ((currentPrice - this.state.avgCostBasis) / this.state.avgCostBasis) * 100;
      
      // Cooldown: at least 1 hour after entry or last DCA before hard trigger can fire
      const timeSinceLastBuy = Date.now() - this.state.lastBuyTime;
      const minCooldownMs = 60 * 60 * 1000; // 1 hour
      const hardTriggerCooldown = timeSinceLastBuy < minCooldownMs;
      
      const neuralTriggered = neuralLongLevel >= level.neuralTrigger && gainLossPct < 0;
      const hardTriggered = !hardTriggerCooldown && gainLossPct <= level.hardPctTrigger;

      if (neuralTriggered || hardTriggered) {
        let dcaQty = baseQuantity * level.multiplier;
        if (cfg.investmentPerTrade) {
          const dcaInvestment = (cfg.investmentPerTrade as number) * level.multiplier;
          dcaQty = dcaInvestment / currentPrice;
        }
        
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
        this.state.lastBuyPrice = currentPrice;
        this.state.lastBuyTime = Date.now();

        return { action: 'buy', quantity: dcaQty, price: currentPrice, reason };
      }
    }

    const gainLossPct = ((currentPrice - this.state.avgCostBasis) / this.state.avgCostBasis) * 100;
    return {
      action: 'hold',
      reason: `Holding position. P&L: ${gainLossPct.toFixed(2)}%, DCA: ${this.state.dcaStage}/${dcaLevels.length}`,
    };
  }

  setNeuralLevels(longLevel: number, shortLevel: number): void {
    (this.config as Record<string, unknown>)._neuralLongLevel = longLevel;
    (this.config as Record<string, unknown>)._neuralShortLevel = shortLevel;
  }

  setNewsSentiment(score: number, label: string): void {
    (this.config as Record<string, unknown>)._newsSentiment = score;
    (this.config as Record<string, unknown>)._newsSentimentLabel = label;
  }

  getState(): PowerTraderState {
    return { ...this.state };
  }

  restoreState(saved: Partial<PowerTraderState>): void {
    this.state = { ...this.state, ...saved };
  }
}
