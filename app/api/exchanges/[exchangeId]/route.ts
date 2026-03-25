export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { stopStrategy } from '@/lib/strategies/StrategyRunner';

export async function GET(_req: Request, { params }: { params: Promise<{ exchangeId: string }> }) {
  try {
    const { exchangeId } = await params;
    const exchange = await prisma.exchangeConfig.findUnique({ where: { id: exchangeId } });
    if (!exchange) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { apiKey, apiSecret, ...safe } = exchange;
    return NextResponse.json(safe);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ exchangeId: string }> }) {
  try {
    const { exchangeId } = await params;

    // Stop all running strategies for this exchange
    const strategies = await prisma.strategy.findMany({ where: { exchangeId }, select: { id: true } });
    await Promise.all(strategies.map(s => stopStrategy(s.id).catch(() => {})));

    // Clean up related records
    for (const s of strategies) {
      await prisma.backtestResult.deleteMany({ where: { strategyId: s.id } });
      await prisma.trade.updateMany({ where: { strategyId: s.id }, data: { strategyId: null } });
    }
    await prisma.strategy.deleteMany({ where: { exchangeId } });
    await prisma.exchangeConfig.delete({ where: { id: exchangeId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
