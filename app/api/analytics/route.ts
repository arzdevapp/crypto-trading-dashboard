export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const exchangeId = url.searchParams.get('exchangeId') ?? undefined;

    const where = { exchangeId, status: 'filled', pnl: { not: null } };

    // Push aggregation into the DB — avoids loading all rows into JS memory
    const [totalTrades, pnlAgg, winCount] = await Promise.all([
      prisma.trade.count({ where }),
      prisma.trade.aggregate({ where, _sum: { pnl: true } }),
      prisma.trade.count({ where: { ...where, pnl: { gt: 0 } } }),
    ]);

    const losingCount = totalTrades - winCount;
    const totalPnl = pnlAgg._sum.pnl ?? 0;
    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

    // Profit factor needs gross profit / gross loss — two aggregations
    const [profitAgg, lossAgg] = await Promise.all([
      prisma.trade.aggregate({ where: { ...where, pnl: { gt: 0 } }, _sum: { pnl: true } }),
      prisma.trade.aggregate({ where: { ...where, pnl: { lte: 0 } }, _sum: { pnl: true } }),
    ]);
    const grossProfit = profitAgg._sum.pnl ?? 0;
    const grossLoss = Math.abs(lossAgg._sum.pnl ?? 0);
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

    return NextResponse.json({
      totalTrades,
      winRate,
      totalPnl,
      profitFactor,
      winningTrades: winCount,
      losingTrades: losingCount,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
