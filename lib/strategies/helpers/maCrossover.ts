// src/lib/strategies/helpers/maCrossover.ts
/**
 * Simple Simple Moving Average (SMA) crossover helper.
 * Returns true when the short‑period SMA is above the long‑period SMA (bullish trend).
 */
export function isBullishTrend(
  candles: { close: number }[],
  shortPeriod: number,
  longPeriod: number,
): boolean {
  if (candles.length < longPeriod) return false;
  const shortSma = sma(candles.slice(-shortPeriod));
  const longSma = sma(candles.slice(-longPeriod));
  return shortSma > longSma;
}

function sma(slice: { close: number }[]): number {
  const sum = slice.reduce((acc, c) => acc + c.close, 0);
  return sum / slice.length;
}
