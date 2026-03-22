export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getExchangeAdapter } from '@/lib/exchange/ExchangeFactory';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const exchangeId = url.searchParams.get('exchangeId');
  const symbol = url.searchParams.get('symbol') ?? undefined;
  if (!exchangeId) return NextResponse.json({ error: 'exchangeId required' }, { status: 400 });

  try {
    const adapter = await getExchangeAdapter(exchangeId);
    const orders = await adapter.fetchOpenOrders(symbol);
    return NextResponse.json(orders);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const { exchangeId, symbol, type, side, amount, price, stopPrice } = body;
  if (!exchangeId || !symbol || !type || !side || !amount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    const adapter = await getExchangeAdapter(exchangeId);
    const order = await adapter.placeOrder({ symbol, type, side, amount, price, stopPrice });

    await prisma.trade.create({
      data: {
        exchangeId,
        symbol,
        side,
        type,
        quantity: amount,
        price: order.price ?? price ?? 0,
        orderId: order.id,
        status: order.status,
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
