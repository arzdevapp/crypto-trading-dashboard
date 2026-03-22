import type { OHLCVCandle } from '@/types/exchange';
import { ExchangeAdapter } from '../exchange/ExchangeAdapter';

export async function loadHistoricalData(
  adapter: ExchangeAdapter,
  symbol: string,
  timeframe: string,
  startDate: Date,
  endDate: Date
): Promise<OHLCVCandle[]> {
  const allCandles: OHLCVCandle[] = [];
  const limit = 500;
  let since = startDate.getTime();
  const endTs = endDate.getTime();

  while (since < endTs) {
    const candles = await adapter.fetchOHLCV(symbol, timeframe, limit);
    if (!candles.length) break;

    const filtered = candles.filter((c) => c.timestamp >= since && c.timestamp <= endTs);
    allCandles.push(...filtered);

    const lastTs = candles[candles.length - 1].timestamp;
    if (lastTs <= since) break;
    since = lastTs + 1;

    // Rate limit
    await new Promise((r) => setTimeout(r, 200));
  }

  // Deduplicate and sort
  const seen = new Set<number>();
  return allCandles
    .filter((c) => { if (seen.has(c.timestamp)) return false; seen.add(c.timestamp); return true; })
    .sort((a, b) => a.timestamp - b.timestamp);
}
