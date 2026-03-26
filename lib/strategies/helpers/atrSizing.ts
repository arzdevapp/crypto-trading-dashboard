// src/lib/strategies/helpers/atrSizing.ts
/**
 * Compute Average True Range (ATR) over a configurable window and return a risk‑adjusted quantity.
 * The function expects an array of candles (OHLCV) where each candle has `high`, `low`, and `close`.
 * `riskPct` is the percentage of account equity to risk per trade (e.g., 1 for 1%).
 * `accountEquity` is the total equity available for trading.
 * `atrWindow` is the number of periods used for the ATR calculation (default 14).
 */
export interface AtrSizingParams {
  candles: { high: number; low: number; close: number }[];
  riskPct: number; // e.g., 1 for 1%
  accountEquity: number;
  atrWindow?: number;
}

/**
 * Calculate True Range for a single candle.
 */
function trueRange(prevClose: number, high: number, low: number): number {
  const tr1 = high - low;
  const tr2 = Math.abs(high - prevClose);
  const tr3 = Math.abs(low - prevClose);
  return Math.max(tr1, tr2, tr3);
}

/**
 * Compute ATR over the last `atrWindow` candles.
 */
function computeATR(candles: { high: number; low: number; close: number }[], atrWindow: number): number {
  if (candles.length < atrWindow + 1) return 0;
  const trs: number[] = [];
  for (let i = candles.length - atrWindow; i < candles.length; i++) {
    const prevClose = candles[i - 1].close;
    const { high, low } = candles[i];
    trs.push(trueRange(prevClose, high, low));
  }
  const sum = trs.reduce((a, b) => a + b, 0);
  return sum / atrWindow;
}

/**
 * Return the quantity (in base asset units) that corresponds to the desired risk.
 * Simple formula: quantity = (riskPct/100 * equity) / (ATR * multiplier)
 * We use a multiplier of 1 for simplicity.
 */
export function getAtrBasedQuantity(params: AtrSizingParams): number {
  const { candles, riskPct, accountEquity, atrWindow = 14 } = params;
  const atr = computeATR(candles, atrWindow);
  if (atr <= 0) return 0;
  const riskCapital = (riskPct / 100) * accountEquity;
  const quantity = riskCapital / atr;
  // Ensure a minimum trade size (e.g., 0.0001) to avoid zero trades.
  return Math.max(quantity, 0.0001);
}
