export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createStrategy } from '@/lib/strategies/StrategyRegistry';
import { runBacktest } from '@/lib/backtesting/BacktestEngine';
import { getExchangeAdapter } from '@/lib/exchange/ExchangeFactory';

export async function POST(req: Request) {
  const body = await req.json();
  const { strategyId, symbol, timeframe, startDate, endDate, initialCapital = 10000, commissionRate = 0.001, slippagePct = 0.0005 } = body;

  if (!strategyId || !symbol || !timeframe || !startDate || !endDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    const strategyRecord = await prisma.strategy.findUnique({ where: { id: strategyId } });
    if (!strategyRecord) return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });

    const config = JSON.parse(strategyRecord.config);
    const strategy = createStrategy(strategyRecord.type, { ...config, symbol, timeframe, exchangeId: strategyRecord.exchangeId });

    const adapter = await getExchangeAdapter(strategyRecord.exchangeId);
    const candles = await adapter.fetchOHLCV(symbol, timeframe, 500);

    const metrics = await runBacktest(strategy, { candles, initialCapital, commissionRate, slippagePct });

    const result = await prisma.backtestResult.create({
      data: {
        strategyId,
        symbol,
        timeframe,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        initialCapital,
        finalCapital: metrics.finalCapital,
        totalTrades: metrics.totalTrades,
        winRate: metrics.winRate,
        sharpeRatio: metrics.sharpeRatio,
        maxDrawdown: metrics.maxDrawdownPct,
        profitFactor: metrics.profitFactor,
        tradesJson: JSON.stringify(metrics.trades),
        equityCurveJson: JSON.stringify(metrics.equityCurve),
      },
    });

    return NextResponse.json({ ...result, metrics }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
