import { BaseStrategy } from '../BaseStrategy';
import type { Signal, StrategyConfig } from '@/types/strategy';
import type { OHLCVCandle } from '@/types/exchange';
import { atr } from '../indicators/atr';

export interface DCALevel {
  neuralTrigger: number;   // signal level threshold
  hardPctTrigger: number;  // % drawdown trigger
  multiplier: number;      // position size multiplier
}

const DEFAULT_DCA_LEVELS: DCALevel[] = [
  { neuralTrigger: 4, hardPctTrigger: -2.5,  multiplier: 1.0 },
  { neuralTrigger: 5, hardPctTrigger: -5.0,  multiplier: 1.5 },
  { neuralTrigger: 6, hardPctTrigger: -10.0, multiplier: 2.0 },
  { neuralTrigger: 7, hardPctTrigger: -20.0, multiplier: 2.5 },
  { neuralTrigger: 8, hardPctTrigger: -30.0, multiplier: 3.0 },
  { neuralTrigger: 8, hardPctTrigger: -40.0, multiplier: 3.5 },
  { neuralTrigger: 8, hardPctTrigger: -50.0, multiplier: 4.0 },
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
  side: 'long' | 'short';
  circuitBreakerHits: number;
  dailyLossTotal: number;
  dailyLossDate: string;  // YYYY-MM-DD UTC
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
    side: 'long',
    circuitBreakerHits: 0,
    dailyLossTotal: 0,
    dailyLossDate: '',
  };

  constructor(config: StrategyConfig & Record<string, unknown>) {
    super(config as StrategyConfig);
    this.config = config;
    this.warmupPeriod = 20;
    // Persist configured side into state
    if (config.side === 'short') {
      this.state.side = 'short';
    }
  }

  computeSignal(candles: OHLCVCandle[]): Signal {
    const cfg = this.config as Record<string, unknown>;
    const side = this.state.side;
    const isShort = side === 'short';

    const tradeStartLevel = cfg.tradeStartLevel as number ?? 3;
    const pmStartPct = cfg.pmStartPct as number ?? 5.0;
    const pmStartPctDCA = cfg.pmStartPctDCA as number ?? 2.5;
    const trailingGapPct = cfg.trailingGapPct as number ?? 1.5;
    const legacyQuantity = cfg.quantity as number ?? 0.001;
    const maxDrawdownPct = cfg.maxDrawdownPct as number ?? 25;
    const dailyLossLimit = cfg.dailyLossLimit as number ?? 0;

    // Neural signal levels injected by StrategyRunner before each candle
    const neuralLongLevel = cfg._neuralLongLevel as number ?? 0;
    const neuralShortLevel = cfg._neuralShortLevel as number ?? 0;

    // News sentiment injected by StrategyRunner (-1 bearish → +1 bullish)
    const newsSentiment = cfg._newsSentiment as number ?? 0;
    const newsSentimentLabel = cfg._newsSentimentLabel as string ?? 'Neutral';

    // Adjust entry threshold based on news sentiment:
    // Long: bad news → require stronger signal; good news → allow earlier entry
    // Short: good news → require stronger signal; bad news → allow earlier entry (inverted)
    const newsAdjustment = isShort
      ? (newsSentiment >= 0.5 ? 2 : newsSentiment >= 0.2 ? 1 : newsSentiment <= -0.4 ? -1 : 0)
      : (newsSentiment <= -0.5 ? 2 : newsSentiment <= -0.2 ? 1 : newsSentiment >= 0.4 ? -1 : 0);
    const effectiveStartLevel = Math.max(1, tradeStartLevel + newsAdjustment);

    const currentPrice = candles[candles.length - 1].close;

    // Base quantity calculation
    let baseQuantity = legacyQuantity;
    if (cfg.investmentPerTrade) {
      if (isShort) {
        // For sell mode: investmentPerTrade is already in base asset units
        baseQuantity = cfg.investmentPerTrade as number;
      } else {
        baseQuantity = (cfg.investmentPerTrade as number) / currentPrice;
      }
    }

    // === ATR Volatility Sizing ===
    const useAtrSizing = cfg.useAtrSizing as boolean ?? false;
    let atrLog = '';
    if (useAtrSizing && candles.length > 20) {
      const atrPeriod = cfg.atrPeriod as number ?? 14;
      const baselineAtrPct = cfg.baselineAtrPct as number ?? 2.0; // Assume 2% volatility is "normal 1x size"
      
      const atrs = atr(candles, atrPeriod);
      const currentAtr = atrs[atrs.length - 1];
      
      if (currentAtr > 0) {
        const currentAtrPct = (currentAtr / currentPrice) * 100;
        // Inverse volatility scaling: (Baseline ATR / Current ATR)
        // Cap multiplier at 2.5x to prevent over-leverage on completely flat charts
        // Floor at 0.1x to ensure we don't buy 0 on mega-wicks
        let sizingMultiplier = baselineAtrPct / currentAtrPct;
        if (sizingMultiplier > 2.5) sizingMultiplier = 2.5; 
        if (sizingMultiplier < 0.1) sizingMultiplier = 0.1;
        
        baseQuantity = baseQuantity * sizingMultiplier;
        atrLog = ` (ATR: ${currentAtrPct.toFixed(2)}%, Size: ${sizingMultiplier.toFixed(2)}x)`;
      }
    }

    const dcaLevels: DCALevel[] = (cfg.dcaLevels as DCALevel[]) ?? DEFAULT_DCA_LEVELS;

    // === Reset daily loss counter at midnight UTC ===
    const todayUTC = new Date().toISOString().slice(0, 10);
    if (this.state.dailyLossDate !== todayUTC) {
      this.state.dailyLossDate = todayUTC;
      this.state.dailyLossTotal = 0;
    }

    // === CIRCUIT BREAKER: Max Drawdown Stop-Loss ===
    if (this.state.inPosition && this.state.avgCostBasis > 0 && maxDrawdownPct > 0) {
      const unrealisedPct = isShort
        ? ((this.state.avgCostBasis - currentPrice) / this.state.avgCostBasis) * 100
        : ((currentPrice - this.state.avgCostBasis) / this.state.avgCostBasis) * 100;

      if (unrealisedPct <= -maxDrawdownPct) {
        const closeQty = this.state.positionSize;
        const lossAmount = Math.abs(currentPrice - this.state.avgCostBasis) * this.state.positionSize;
        this.state.circuitBreakerHits++;
        this.state.dailyLossTotal += lossAmount;
        const hits = this.state.circuitBreakerHits;
        this.resetState();
        return {
          action: isShort ? 'buy' : 'sell',
          quantity: closeQty,
          reason: `⚠ Circuit breaker: ${unrealisedPct.toFixed(1)}% drawdown exceeded ${maxDrawdownPct}% limit — force-closed ${closeQty.toFixed(6)} ${String(cfg.symbol ?? '')} (hit #${hits})`,
        };
      }
    }

    // === TAKE PROFIT: Trailing Profit Margin ===
    if (this.state.inPosition && this.state.avgCostBasis > 0) {
      const pmPct = this.state.dcaCount > 0 ? pmStartPctDCA : pmStartPct;

      if (isShort) {
        // Short: profit when price drops — trailing PM fires below cost basis
        const pmBaseLine = this.state.avgCostBasis * (1 - pmPct / 100);

        if (currentPrice <= pmBaseLine) {
          // Activate or update trailing (tracking the trough, line trails above)
          if (!this.state.pmActive) {
            this.state.pmActive = true;
            this.state.trailingPeak = currentPrice; // "peak" = trough for shorts
            this.state.trailingPMLine = currentPrice * (1 + trailingGapPct / 100);
          } else if (currentPrice < this.state.trailingPeak) {
            this.state.trailingPeak = currentPrice;
            this.state.trailingPMLine = currentPrice * (1 + trailingGapPct / 100);
          } else if (currentPrice > this.state.trailingPMLine) {
            // Cross: price rose above trailing line → BUY-BACK to close position
            const buyBackQty = this.state.positionSize;
            const pmLine = this.state.trailingPMLine;
            this.resetState();
            return {
              action: 'buy',
              quantity: buyBackQty,
              reason: `Trailing PM buy-back at ${currentPrice.toFixed(2)} (PM line: ${pmLine.toFixed(2)}) — bought back ${buyBackQty.toFixed(6)} ${String(cfg.symbol ?? '')} total`,
            };
          }
        }
      } else {
        // Long: profit when price rises — trailing PM fires above cost basis
        const pmBaseLine = this.state.avgCostBasis * (1 + pmPct / 100);

        if (currentPrice >= pmBaseLine) {
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
            this.resetState();
            return {
              action: 'sell',
              quantity: sellQty,
              reason: `Trailing PM sell at ${currentPrice.toFixed(2)} (PM line: ${pmLine.toFixed(2)}) — sold ${sellQty.toFixed(6)} ${String(cfg.symbol ?? '')} total`,
            };
          }
        }
      }
    }

    // === DAILY LOSS LIMIT: Block new entries if daily losses exceeded ===
    if (!this.state.inPosition && dailyLossLimit > 0 && this.state.dailyLossTotal >= dailyLossLimit) {
      return { action: 'hold', reason: `Daily loss limit: $${this.state.dailyLossTotal.toFixed(2)} realized losses today (limit: $${dailyLossLimit.toFixed(2)}) — paused until tomorrow` };
    }

    // === HARD BLOCK: Extreme news — skip entry entirely ===
    if (!this.state.inPosition) {
      if (isShort && newsSentiment >= 0.5) {
        return { action: 'hold', reason: `News block: sentiment ${newsSentimentLabel} (${newsSentiment.toFixed(2)}) — too bullish for sell entry` };
      }
      if (!isShort && newsSentiment <= -0.5) {
        return { action: 'hold', reason: `News block: sentiment ${newsSentimentLabel} (${newsSentiment.toFixed(2)}) — waiting for neutral` };
      }
    }

    // === HARD BLOCK: Macro Trend Filter ===
    const filterMacroTrend = cfg.filterMacroTrend as boolean ?? false;
    const macroTrend = cfg._macroTrend as string | undefined;
    if (!this.state.inPosition && filterMacroTrend && macroTrend) {
      if (isShort && macroTrend === 'bullish') {
        return { action: 'hold', reason: `Macro block: Higher timeframe trend is bullish — too risky for short entry` };
      }
      if (!isShort && macroTrend === 'bearish') {
        return { action: 'hold', reason: `Macro block: Higher timeframe trend is bearish — waiting for reversal` };
      }
    }

    // === ENTRY LOGIC ===
    if (!this.state.inPosition) {
      if (isShort) {
        // Short entry: neural short signal fires, no conflicting long
        if (neuralShortLevel >= effectiveStartLevel && neuralLongLevel === 0) {
          this.state.inPosition = true;
          this.state.avgCostBasis = currentPrice;
          this.state.positionSize = baseQuantity;
          this.state.dcaStage = 0;
          this.state.dcaCount = 0;
          this.state.pmActive = false;
          this.state.lastBuyPrice = currentPrice;
          this.state.lastBuyTime = Date.now();
          return {
            action: 'sell',
            quantity: baseQuantity,
            price: currentPrice,
            reason: `Sell entry: neural short ${neuralShortLevel}>=${effectiveStartLevel}, news=${newsSentimentLabel}${atrLog}`,
          };
        }
        return { action: 'hold', reason: `Waiting: neural short=${neuralShortLevel} need ${effectiveStartLevel}, news=${newsSentimentLabel}` };
      } else {
        // Long entry: neural long signal fires, no conflicting short
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
            reason: `Entry: neural ${neuralLongLevel}>=${effectiveStartLevel}, news=${newsSentimentLabel}${atrLog}`,
          };
        }
        return { action: 'hold', reason: `Waiting: neural=${neuralLongLevel} need ${effectiveStartLevel}, news=${newsSentimentLabel}` };
      }
    }

    // === DCA LOGIC: Add to position ===
    if (this.state.inPosition && this.state.dcaStage < dcaLevels.length) {
      const level = dcaLevels[this.state.dcaStage];

      // For long: negative % = drawdown (price dropped). For short: positive % = adverse move (price rose).
      const rawPctChange = ((currentPrice - this.state.avgCostBasis) / this.state.avgCostBasis) * 100;
      const adversePct = isShort ? rawPctChange : -rawPctChange; // positive = bad for position

      // Cooldown: at least 1 hour after entry or last DCA before hard trigger can fire
      const timeSinceLastAction = Date.now() - this.state.lastBuyTime;
      const minCooldownMs = 60 * 60 * 1000; // 1 hour
      const hardTriggerCooldown = timeSinceLastAction < minCooldownMs;

      // Neural trigger: appropriate signal fires while position is in adverse territory
      const neuralTriggered = isShort
        ? (neuralShortLevel >= level.neuralTrigger && rawPctChange > 0)   // short: price went up (bad), short signal strengthens
        : (neuralLongLevel >= level.neuralTrigger && rawPctChange < 0);    // long: price went down (bad), long signal strengthens

      // Hard trigger: adverse move exceeds the hard % threshold
      const hardTriggered = !hardTriggerCooldown && adversePct >= Math.abs(level.hardPctTrigger);

      if (neuralTriggered || hardTriggered) {
        let dcaQty = baseQuantity * level.multiplier;
        if (cfg.investmentPerTrade) {
          if (isShort) {
            dcaQty = (cfg.investmentPerTrade as number) * level.multiplier;
          } else {
            const dcaInvestment = (cfg.investmentPerTrade as number) * level.multiplier;
            dcaQty = dcaInvestment / currentPrice;
          }
        }

        const triggerSignalLevel = isShort ? neuralShortLevel : neuralLongLevel;
        const reason = neuralTriggered
          ? `DCA stage ${this.state.dcaStage + 1}: neural level ${triggerSignalLevel}`
          : `DCA stage ${this.state.dcaStage + 1}: ${rawPctChange.toFixed(1)}% ${isShort ? 'adverse rise' : 'drawdown'}`;

        // Update avg cost basis
        const totalCost = this.state.avgCostBasis * this.state.positionSize + currentPrice * dcaQty;
        this.state.positionSize += dcaQty;
        this.state.avgCostBasis = totalCost / this.state.positionSize;
        this.state.dcaStage++;
        this.state.dcaCount++;
        this.state.pmActive = false; // reset trailing on DCA
        this.state.lastBuyPrice = currentPrice;
        this.state.lastBuyTime = Date.now();

        return {
          action: isShort ? 'sell' : 'buy',
          quantity: dcaQty,
          price: currentPrice,
          reason,
        };
      }
    }

    const gainLossPct = isShort
      ? ((this.state.avgCostBasis - currentPrice) / this.state.avgCostBasis) * 100  // short profits when price drops
      : ((currentPrice - this.state.avgCostBasis) / this.state.avgCostBasis) * 100;
    return {
      action: 'hold',
      reason: `Holding ${isShort ? 'sell' : 'long'} position. P&L: ${gainLossPct.toFixed(2)}%, DCA: ${this.state.dcaStage}/${dcaLevels.length}`,
    };
  }

  /** Reset position state (preserves side, circuit breaker count, and daily loss tracking) */
  private resetState(): void {
    const { side, circuitBreakerHits, dailyLossTotal, dailyLossDate } = this.state;
    this.state = {
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
      side,
      circuitBreakerHits,
      dailyLossTotal,
      dailyLossDate,
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

  setMacroTrend(trend: 'bullish' | 'bearish'): void {
    (this.config as Record<string, unknown>)._macroTrend = trend;
  }

  getState(): PowerTraderState {
    return { ...this.state };
  }

  restoreState(saved: Partial<PowerTraderState>): void {
    this.state = { ...this.state, ...saved };
  }
}
