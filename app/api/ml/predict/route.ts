export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getExchangeAdapter } from '@/lib/exchange/ExchangeFactory';
import { getPredictor } from '@/lib/ml/InstancePredictor';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const exchangeId = url.searchParams.get('exchangeId');
  const symbol = url.searchParams.get('symbol');
  const timeframe = url.searchParams.get('timeframe') ?? '1h';

  if (!exchangeId || !symbol) {
    return NextResponse.json({ error: 'exchangeId and symbol required' }, { status: 400 });
  }

  try {
    const adapter = await getExchangeAdapter(exchangeId);
    const predictor = await getPredictor(symbol);

    if (!predictor.isTrainedFor(timeframe)) {
      const candles = await adapter.fetchOHLCV(symbol, timeframe, 500);
      await predictor.trainTimeframe(timeframe, candles);
    }

    const candles = await adapter.fetchOHLCV(symbol, timeframe, 5);
    const ticker = await adapter.fetchTicker(symbol);
    const currentPrice = ticker.last;

    if (!candles.length) {
      return NextResponse.json({ error: 'No candle data' }, { status: 500 });
    }

    const levels = predictor.predict(timeframe, candles[candles.length - 1], currentPrice);
    return NextResponse.json({ symbol, timeframe, currentPrice, ...levels });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
