export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getExchangeAdapter } from '@/lib/exchange/ExchangeFactory';
import { getPredictor } from '@/lib/ml/InstancePredictor';

const TIMEFRAMES = ['1h', '4h', '1d'];

// Server-side TTL cache so repeated requests within 55s return instantly
const signalCache = new Map<string, { result: unknown; expiresAt: number }>();
const CACHE_TTL = 55_000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const exchangeId = url.searchParams.get('exchangeId');
  const symbol = url.searchParams.get('symbol');

  if (!exchangeId || !symbol) {
    return NextResponse.json({ error: 'exchangeId and symbol required' }, { status: 400 });
  }

  const cacheKey = `${exchangeId}:${symbol}`;
  const cached = signalCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.result);
  }

  try {
    const adapter = await getExchangeAdapter(exchangeId);
    const predictor = await getPredictor(symbol);

    // Fetch candles for untrained timeframes in parallel
    const untrainedTfs = TIMEFRAMES.filter(tf => !predictor.isTrainedFor(tf));
    if (untrainedTfs.length > 0) {
      const candleResults = await Promise.all(
        untrainedTfs.map(tf => adapter.fetchOHLCV(symbol, tf, 500))
      );
      await Promise.all(untrainedTfs.map((tf, i) => predictor.trainTimeframe(tf, candleResults[i])));
    }

    const [ticker, candles1h] = await Promise.all([
      adapter.fetchTicker(symbol),
      adapter.fetchOHLCV(symbol, '1h', 3),
    ]);

    const aggregated = predictor.aggregateSignals(candles1h, ticker.last);
    const result = {
      symbol,
      currentPrice: ticker.last,
      ...aggregated,
      trained: TIMEFRAMES.filter(tf => predictor.isTrainedFor(tf)),
    };

    signalCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
