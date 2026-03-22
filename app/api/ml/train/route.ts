export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getExchangeAdapter } from '@/lib/exchange/ExchangeFactory';
import { getPredictor } from '@/lib/ml/InstancePredictor';

const TRAIN_TIMEFRAMES = ['1h', '4h', '1d'];

export async function POST(req: Request) {
  const { exchangeId, symbol } = await req.json();
  if (!exchangeId || !symbol) {
    return NextResponse.json({ error: 'exchangeId and symbol required' }, { status: 400 });
  }

  try {
    const adapter = await getExchangeAdapter(exchangeId);
    const predictor = await getPredictor(symbol);
    const results: Record<string, number> = {};

    for (const tf of TRAIN_TIMEFRAMES) {
      const candles = await adapter.fetchOHLCV(symbol, tf, 500);
      if (candles.length >= 50) {
        await predictor.trainTimeframe(tf, candles);
        results[tf] = candles.length;
      }
    }

    return NextResponse.json({ symbol, trained: results, message: `Trained on ${Object.values(results).reduce((a, b) => a + b, 0)} total candles` });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
