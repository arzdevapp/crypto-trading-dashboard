export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getExchangeAdapter } from '@/lib/exchange/ExchangeFactory';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const url = new URL(req.url);
  const symbol = url.searchParams.get('symbol');
  const exchangeId = url.searchParams.get('exchangeId');

  if (!symbol || !exchangeId) {
    return NextResponse.json({ error: 'symbol and exchangeId required' }, { status: 400 });
  }

  try {
    const adapter = await getExchangeAdapter(exchangeId);
    await adapter.cancelOrder(orderId, symbol);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
