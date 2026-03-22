export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const exchangeId = url.searchParams.get('exchangeId') ?? undefined;
    const symbol = url.searchParams.get('symbol') ?? undefined;
    const strategyId = url.searchParams.get('strategyId') ?? undefined;
    const limit = parseInt(url.searchParams.get('limit') ?? '50');
    const offset = parseInt(url.searchParams.get('offset') ?? '0');

    const trades = await prisma.trade.findMany({
      where: { exchangeId, symbol, strategyId },
      orderBy: { openedAt: 'desc' },
      take: limit,
      skip: offset,
      include: { strategy: { select: { name: true } } },
    });

    const total = await prisma.trade.count({ where: { exchangeId, symbol, strategyId } });
    return NextResponse.json({ trades, total });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
