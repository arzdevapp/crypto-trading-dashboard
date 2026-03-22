export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getExchangeAdapter } from '@/lib/exchange/ExchangeFactory';

export async function GET(req: Request, { params }: { params: Promise<{ exchangeId: string }> }) {
  try {
    const { exchangeId } = await params;
    const url = new URL(req.url);
    const symbol = url.searchParams.get('symbol') ?? 'BTC/USDT';
    const timeframe = url.searchParams.get('timeframe') ?? '1h';
    const limit = parseInt(url.searchParams.get('limit') ?? '200');

    const adapter = await getExchangeAdapter(exchangeId);
    const candles = await adapter.fetchOHLCV(symbol, timeframe, limit);
    return NextResponse.json(candles);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
