import { BaseStrategy } from '../BaseStrategy';
import type { Signal } from '@/types/strategy';
import type { OHLCVCandle } from '@/types/exchange';
import { getAtrBasedQuantity } from '../helpers/atrSizing';
import { isBullishTrend } from '../helpers/maCrossover';
import { applyFees } from '../helpers/feeModel';

export interface DayTraderState {
  inPosition: boolean;
  entryPrice: number;
  quantity: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  trailingActive: boolean;
  trailingPeak: number;
  trailingStopPrice: number;
  tradesThisSession: number;
  lastSignalLevel: number;
  sessionStartTime: number;
}

export class DayTraderStrategy extends BaseStrategy {
  readonly type = 'DAY_TRADER';
  readonly name = 'Day Trader (Neural + SL/TP)';

  private state: DayTraderState = {
    inPosition: false,
    entryPrice: 0,
    quantity: 0,
    stopLossPrice: 0,
    takeProfitPrice: 0,
    trailingActive: false,
    trailingPeak: 0,
    trailingStopPrice: 0,
    tradesThisSession: 0,
    lastSignalLevel: 0,
    sessionStartTime: 0,
  };

  constructor(config: Record<string, unknown>) {
    super(config as never);
    // @ts-expect-error generic config assignment
    this.config = config;
    this.warmupPeriod = 10;
  }

  computeSignal(candles: OHLCVCandle[]): Signal {
    const cfg = this.config as Record<string, unknown>;

    // Config params
    // Dynamic ATR‑based quantity
const accountEquity = cfg.accountEquity as number ?? 1000;
const riskPct = cfg.riskPct as number ?? 1;
const atrWindow = cfg.atrWindow as number ?? 14;
const quantity = getAtrBasedQuantity({
  candles,
  accountEquity,
  riskPct,
  atrWindow,
});
    const stopLossPct     = cfg.stopLossPct     as number ?? 1.0;   // % below entry
    const takeProfitPct   = cfg.takeProfitPct   as number ?? 0.8;   // % above entry
    const trailingGapPct  = cfg.trailingGapPct  as number ?? 0.3;   // trailing gap after TP
    const entrySignalMin  = cfg.entrySignalMin  as number ?? 3;     // min neural long level
    const maxTradesPerDay = cfg.maxTradesPerDay as number ?? 5;     // session trade cap
    const newsBlockThresh = cfg.newsBlockThresh as number ?? -0.4;  // news score to block

    // Injected by StrategyRunner
    const neuralLong  = cfg._neuralLongLevel    as number ?? 0;
    const neuralShort = cfg._neuralShortLevel   as number ?? 0;
    const newsSentiment = cfg._newsSentiment    as number ?? 0;
    const newsSentimentLabel = cfg._newsSentimentLabel as string ?? 'Neutral';

    const currentPrice = candles[candles.length - 1].close;


    // Reset session counter at midnight UTC
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    if (this.state.sessionStartTime < dayStart.getTime()) {
      this.state.tradesThisSession = 0;
      this.state.sessionStartTime = dayStart.getTime();
    }

    // ── EXIT LOGIC (runs first — always check exits before entries) ──────────
    if (this.state.inPosition) {

      // 1. Hard stop loss
      if (currentPrice <= this.state.stopLossPrice) {
        const loss = ((currentPrice - this.state.entryPrice) / this.state.entryPrice * 100).toFixed(2);
        const qty = this.state.quantity || quantity;
        this.resetPosition();
        return {
          action: 'sell',
          quantity: qty,
          price: currentPrice,
          reason: `Stop loss hit at ${currentPrice.toFixed(4)} (${loss}%)`,
        };
      }

      // 2. Take profit → activate trailing stop
      if (currentPrice >= this.state.takeProfitPrice) {
        if (!this.state.trailingActive) {
          this.state.trailingActive = true;
          this.state.trailingPeak = currentPrice;
          this.state.trailingStopPrice = currentPrice * (1 - trailingGapPct / 100);
        } else if (currentPrice > this.state.trailingPeak) {
          // Raise trailing stop as price moves up
          this.state.trailingPeak = currentPrice;
          this.state.trailingStopPrice = currentPrice * (1 - trailingGapPct / 100);
        } else if (currentPrice <= this.state.trailingStopPrice) {
          // Trailing stop triggered → sell
          const profit = ((currentPrice - this.state.entryPrice) / this.state.entryPrice * 100).toFixed(2);
          const qty = this.state.quantity;
          this.resetPosition();
          return {
            action: 'sell',
            quantity: qty,
            price: currentPrice,
            reason: `Trailing exit at ${currentPrice.toFixed(4)} (+${profit}%)`,
          };
        }
      }

      // 3. Strong short signal while in position → early exit
      if (neuralShort >= 5 && currentPrice > this.state.entryPrice) {
        const profit = ((currentPrice - this.state.entryPrice) / this.state.entryPrice * 100).toFixed(2);
        const qty = this.state.quantity;
        this.resetPosition();
        return {
          action: 'sell',
          quantity: qty,
          price: currentPrice,
          reason: `Neural short signal ${neuralShort} — early exit at ${profit}%`,
        };
      }

      const pct = ((currentPrice - this.state.entryPrice) / this.state.entryPrice * 100).toFixed(2);
      return {
        action: 'hold',
        reason: `Holding @ ${pct}% | SL: ${this.state.stopLossPrice.toFixed(4)} | TP: ${this.state.trailingActive ? `trailing ${this.state.trailingStopPrice.toFixed(4)}` : this.state.takeProfitPrice.toFixed(4)}`,
      };
    }

    // ── ENTRY LOGIC ──────────────────────────────────────────────────────────

    // Daily trade cap
    if (this.state.tradesThisSession >= maxTradesPerDay) {
      return { action: 'hold', reason: `Daily cap reached (${this.state.tradesThisSession}/${maxTradesPerDay} trades)` };
    }

    // News block
    if (newsSentiment <= newsBlockThresh) {
      return { action: 'hold', reason: `News block: ${newsSentimentLabel} (${newsSentiment.toFixed(2)})` };
    }

    // Funding rate / OI block — overleveraged longs signal likely pullback
    const fundingOIScore = cfg._fundingOIScore as number ?? 0;
    const fundingOILabel = cfg._fundingOILabel as string ?? 'Neutral';
    const fundingBlockThresh = cfg.fundingBlockThresh as number ?? -0.4;
    if (fundingOIScore <= fundingBlockThresh) {
      return { action: 'hold', reason: `Funding block: ${fundingOILabel} (${fundingOIScore.toFixed(2)})` };
    }

    // Don't enter against short signal
    if (neuralShort >= 3) {
      return { action: 'hold', reason: `Short signal active (${neuralShort}) — skip entry` };
    }

    // Neural entry with trend filter
const shortMaPeriod = cfg.shortMaPeriod as number ?? 5;
const longMaPeriod = cfg.longMaPeriod as number ?? 20;
const bullish = isBullishTrend(candles, shortMaPeriod, longMaPeriod);
if (!bullish) {
  return { action: 'hold', reason: 'Trend filter: not bullish' };
}
    if (neuralLong >= entrySignalMin) {
      const entryPrice = applyFees(currentPrice, (cfg.feePct as number) ?? 0.08, (cfg.slippagePct as number) ?? 0.02, 'buy');
      const sl = entryPrice * (1 - stopLossPct / 100);
      const tp = entryPrice * (1 + takeProfitPct / 100);

      this.state.inPosition = true;
      this.state.entryPrice = entryPrice;
      this.state.quantity = quantity;
      this.state.stopLossPrice = sl;
      this.state.takeProfitPrice = tp;
      this.state.trailingActive = false;
      this.state.trailingPeak = 0;
      this.state.trailingStopPrice = 0;
      this.state.lastSignalLevel = neuralLong;
      this.state.tradesThisSession++;

      return {
        action: 'buy',
        quantity,
        price: entryPrice,
        reason: `Day trade entry: neural=${neuralLong}, news=${newsSentimentLabel} | SL=${sl.toFixed(4)} TP=${tp.toFixed(4)} | trade ${this.state.tradesThisSession}/${maxTradesPerDay}`,
      };
    }

    return {
      action: 'hold',
      reason: `Waiting: neural=${neuralLong} need ${entrySignalMin}, news=${newsSentimentLabel}, trades=${this.state.tradesThisSession}/${maxTradesPerDay}`,
    };
  }

  private resetPosition() {
    this.state.inPosition = false;
    this.state.entryPrice = 0;
    this.state.stopLossPrice = 0;
    this.state.takeProfitPrice = 0;
    this.state.trailingActive = false;
    this.state.trailingPeak = 0;
    this.state.trailingStopPrice = 0;
  }

  setNeuralLevels(longLevel: number, shortLevel: number): void {
    (this.config as Record<string, unknown>)._neuralLongLevel = longLevel;
    (this.config as Record<string, unknown>)._neuralShortLevel = shortLevel;
  }

  setNewsSentiment(score: number, label: string): void {
    (this.config as Record<string, unknown>)._newsSentiment = score;
    (this.config as Record<string, unknown>)._newsSentimentLabel = label;
  }

  setFundingOISignal(score: number, label: string): void {
    (this.config as Record<string, unknown>)._fundingOIScore = score;
    (this.config as Record<string, unknown>)._fundingOILabel = label;
  }

  getState(): DayTraderState {
    return { ...this.state };
  }

  restoreState(state: Record<string, unknown>): void {
    const s = state as unknown as DayTraderState;
    if (typeof s.inPosition === 'boolean') this.state.inPosition = s.inPosition;
    if (typeof s.entryPrice === 'number') this.state.entryPrice = s.entryPrice;
    if (typeof s.quantity === 'number') this.state.quantity = s.quantity;
    if (typeof s.stopLossPrice === 'number') this.state.stopLossPrice = s.stopLossPrice;
    if (typeof s.takeProfitPrice === 'number') this.state.takeProfitPrice = s.takeProfitPrice;
    if (typeof s.trailingActive === 'boolean') this.state.trailingActive = s.trailingActive;
    if (typeof s.trailingPeak === 'number') this.state.trailingPeak = s.trailingPeak;
    if (typeof s.trailingStopPrice === 'number') this.state.trailingStopPrice = s.trailingStopPrice;
    if (typeof s.tradesThisSession === 'number') this.state.tradesThisSession = s.tradesThisSession;
    if (typeof s.lastSignalLevel === 'number') this.state.lastSignalLevel = s.lastSignalLevel;
    if (typeof s.sessionStartTime === 'number') this.state.sessionStartTime = s.sessionStartTime;
  }
}
