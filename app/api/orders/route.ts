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

const VALID_SIDES = ['buy', 'sell'] as const;
const VALID_TYPES = ['market', 'limit', 'stop'] as const;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { exchangeId, symbol, type, side, amount, price, stopPrice } = body as {
    exchangeId?: string; symbol?: string; type?: string; side?: string;
    amount?: number; price?: number; stopPrice?: number;
  };

  if (!exchangeId || !symbol || !type || !side) {
    return NextResponse.json({ error: 'Missing required fields: exchangeId, symbol, type, side' }, { status: 400 });
  }
  if (!VALID_SIDES.includes(side as typeof VALID_SIDES[number])) {
    return NextResponse.json({ error: `Invalid side: must be 'buy' or 'sell'` }, { status: 400 });
  }
  if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
    return NextResponse.json({ error: `Invalid type: must be 'market', 'limit', or 'stop'` }, { status: 400 });
  }
  if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }
  if (type === 'limit' && (typeof price !== 'number' || !isFinite(price) || price <= 0)) {
    return NextResponse.json({ error: 'Limit orders require a positive price' }, { status: 400 });
  }
  if (type === 'stop' && (typeof stopPrice !== 'number' || !isFinite(stopPrice) || stopPrice <= 0)) {
    return NextResponse.json({ error: 'Stop orders require a positive stopPrice' }, { status: 400 });
  }

  try {
    const adapter = await getExchangeAdapter(exchangeId);
    const order = await adapter.placeOrder({ symbol, type: type as 'market' | 'limit' | 'stop', side: side as 'buy' | 'sell', amount, price, stopPrice });

    await prisma.trade.create({
      data: {
        exchangeId,
        symbol,
        side,
        type,
        quantity: amount,
        price: (order.price && order.price > 0) ? order.price : (price ?? 0),
        orderId: order.id,
        status: order.status,
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
