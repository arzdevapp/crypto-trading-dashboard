import type { ExchangeAdapter } from '../exchange/ExchangeAdapter';

export interface OrderBookImbalance {
  bidDepth: number;       // total bid volume (base units) in top N levels
  askDepth: number;       // total ask volume (base units) in top N levels
  ratio: number;          // bidDepth / askDepth (>1 = buy pressure, <1 = sell pressure)
  imbalancePct: number;   // (bidDepth - askDepth) / (bidDepth + askDepth) * 100
  signal: 'bullish' | 'bearish' | 'neutral';
}

/**
 * Fetch the order book and compute bid/ask depth imbalance.
 * A large imbalance opposing the intended trade direction signals a wall
 * that may prevent favorable execution.
 */
export async function analyzeOrderBook(
  adapter: ExchangeAdapter,
  symbol: string,
  depth = 20,
): Promise<OrderBookImbalance> {
  const ob = await adapter.fetchOrderBook(symbol, depth);

  const bidDepth = ob.bids.reduce((sum, e) => sum + e.amount, 0);
  const askDepth = ob.asks.reduce((sum, e) => sum + e.amount, 0);
  const total = bidDepth + askDepth;

  const ratio = askDepth > 0 ? bidDepth / askDepth : bidDepth > 0 ? Infinity : 1;
  const imbalancePct = total > 0 ? ((bidDepth - askDepth) / total) * 100 : 0;

  let signal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (imbalancePct > 20) signal = 'bullish';
  else if (imbalancePct < -20) signal = 'bearish';

  return { bidDepth, askDepth, ratio, imbalancePct, signal };
}

/**
 * Determine whether the order book imbalance opposes the intended trade
 * direction strongly enough to block the entry.
 *
 * For a BUY: block if asks dominate by more than `thresholdPct`%
 *   (massive sell wall the buy would have to chew through).
 * For a SELL: block if bids dominate by more than `thresholdPct`%
 *   (massive buy wall — price unlikely to drop, selling into strength).
 */
export function shouldBlockEntry(
  imbalance: OrderBookImbalance,
  side: 'buy' | 'sell',
  thresholdPct = 60,
): { blocked: boolean; reason: string } {
  if (side === 'buy' && imbalance.imbalancePct < -thresholdPct) {
    return {
      blocked: true,
      reason: `OB block: sell wall dominates (${imbalance.imbalancePct.toFixed(1)}% imbalance, threshold -${thresholdPct}%)`,
    };
  }
  if (side === 'sell' && imbalance.imbalancePct > thresholdPct) {
    return {
      blocked: true,
      reason: `OB block: buy wall dominates (+${imbalance.imbalancePct.toFixed(1)}% imbalance, threshold +${thresholdPct}%)`,
    };
  }
  return { blocked: false, reason: '' };
}
