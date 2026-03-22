export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getExchangeAdapter } from '@/lib/exchange/ExchangeFactory';

export async function GET(_req: Request, { params }: { params: Promise<{ exchangeId: string }> }) {
  try {
    const { exchangeId } = await params;
    const adapter = await getExchangeAdapter(exchangeId);
    const markets = await adapter.fetchMarkets();
    const simplified = markets
      .filter((m): m is NonNullable<typeof m> => !!m && m.active !== false)
      .map((m) => ({ symbol: m.symbol, base: m.base, quote: m.quote }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
    return NextResponse.json(simplified);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
