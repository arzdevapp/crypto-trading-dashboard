export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getExchangeAdapter } from '@/lib/exchange/ExchangeFactory';

export async function GET(_req: Request, { params }: { params: Promise<{ exchangeId: string }> }) {
  try {
    const { exchangeId } = await params;
    const adapter = await getExchangeAdapter(exchangeId);
    const balance = await adapter.fetchBalance();
    return NextResponse.json(balance);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
