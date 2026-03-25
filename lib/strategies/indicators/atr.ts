import type { OHLCVCandle } from '@/types/exchange';

/**
 * Calculates the Average True Range (ATR)
 * 
 * True Range (TR) is the greatest of:
 * - Current High - Current Low
 * - Absolute value of (Current High - Previous Close)
 * - Absolute value of (Current Low - Previous Close)
 *
 * ATR is an exponentially smoothed moving average of TR.
 */
export function atr(candles: OHLCVCandle[], period: number = 14): number[] {
  if (candles.length <= 1) return [];

  const trs: number[] = [candles[0].high - candles[0].low]; // First TR is just High - Low

  // Calculate True Range for the rest
  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const prev = candles[i - 1];

    const tr1 = current.high - current.low;
    const tr2 = Math.abs(current.high - prev.close);
    const tr3 = Math.abs(current.low - prev.close);

    trs.push(Math.max(tr1, tr2, tr3));
  }

  const atrs: number[] = [];
  
  // Need at least `period` candles to calculate the first ATR
  if (trs.length < period) return Array(candles.length).fill(0);

  // Initial ATR is simple moving average of first `period` TRs
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += trs[i];
  }
  let currentAtr = sum / period;
  
  // Pad the beginning with zeroes (or the initial ATR)
  for (let i = 0; i < period - 1; i++) {
    atrs.push(0); 
  }
  atrs.push(currentAtr);

  // For the remaining candles, use wildcard smoothing (RMA) used by TradingView
  // ATR_t = ((ATR_{t-1} * (period - 1)) + TR_t) / period
  for (let i = period; i < trs.length; i++) {
    currentAtr = ((currentAtr * (period - 1)) + trs[i]) / period;
    atrs.push(currentAtr);
  }

  return atrs;
}
