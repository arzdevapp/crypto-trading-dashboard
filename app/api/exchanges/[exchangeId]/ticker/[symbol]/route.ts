import { NextResponse } from 'next/server';
import { getExchangeAdapter } from '@/lib/exchange/ExchangeFactory';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ exchangeId: string; symbol: string }> }
) {
  try {
    const { exchangeId, symbol } = await params;
    const adapter = await getExchangeAdapter(exchangeId);
    const ticker = await adapter.fetchTicker(decodeURIComponent(symbol));
    return NextResponse.json(ticker);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
