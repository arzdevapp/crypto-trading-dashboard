export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { startStrategy, stopStrategy, getRunnerStatus, getStrategyInstance } from '@/lib/strategies/StrategyRunner';
import { getExchangeAdapter } from '@/lib/exchange/ExchangeFactory';
import type { PowerTraderState } from '@/lib/strategies/implementations/PowerTraderStrategy';

// GET — current bot status for a given exchange+symbol, or list all bots
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const exchangeId = searchParams.get('exchangeId');
  const symbol = searchParams.get('symbol');
  const listAll = searchParams.get('all') === '1';

  if (!exchangeId) {
    return NextResponse.json({ error: 'exchangeId required' }, { status: 400 });
  }

  try {
    // List all POWER_TRADER bots for this exchange
    if (listAll || !symbol) {
      const strategies = await prisma.strategy.findMany({
        where: { exchangeId, type: 'POWER_TRADER' },
        orderBy: { createdAt: 'desc' },
      });

      const bots = strategies.map(s => {
        const runner = getRunnerStatus(s.id);
        const instance = getStrategyInstance(s.id);
        const powerState = instance && 'getState' in instance ? (instance as { getState: () => PowerTraderState }).getState() : null;
        return {
          id: s.id,
          symbol: s.symbol,
          timeframe: s.timeframe,
          status: s.status,
          running: !!runner,
          lastSignal: runner?.lastSignal ?? null,
          error: runner?.error ?? null,
          powerState,
          config: JSON.parse(s.config),
          createdAt: s.createdAt,
        };
      });

      return NextResponse.json({ bots });
    }

    // Single bot status
    const strategy = await prisma.strategy.findFirst({
      where: { exchangeId, symbol, type: 'POWER_TRADER' },
      orderBy: { createdAt: 'desc' },
    });

    if (!strategy) {
      return NextResponse.json({ running: false, strategy: null });
    }

    const runner = getRunnerStatus(strategy.id);
    const instance = getStrategyInstance(strategy.id);
    const powerState = instance && 'getState' in instance ? (instance as { getState: () => PowerTraderState }).getState() : null;

    // Fetch live price
    let currentPrice = 0;
    try {
      const adapter = await getExchangeAdapter(exchangeId);
      const ticker = await adapter.fetchTicker(symbol);
      currentPrice = ticker.last;
    } catch { /* non-fatal */ }

    return NextResponse.json({
      running: !!runner,
      strategy: {
        id: strategy.id,
        name: strategy.name,
        status: strategy.status,
        timeframe: strategy.timeframe,
        config: JSON.parse(strategy.config),
      },
      lastSignal: runner?.lastSignal ?? null,
      error: runner?.error ?? null,
      powerState,
      currentPrice,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// POST — start or stop the DCA bot
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, exchangeId, symbol, timeframe = '1h', config = {} } = body;

  if (!exchangeId || !symbol || !action) {
    return NextResponse.json({ error: 'action, exchangeId and symbol required' }, { status: 400 });
  }

  try {
    if (action === 'start') {
      // Validate configuration: ensure there is a quantity or budget
      const qty = Number(config.quantity);
      const budget = Number(config.investmentPerTrade);
      if ((isNaN(qty) || qty <= 0) && (isNaN(budget) || budget <= 0)) {
        return NextResponse.json({ error: 'Order size or Total budget must be greater than 0' }, { status: 400 });
      }

      // Upsert the strategy record
      let strategy = await prisma.strategy.findFirst({
        where: { exchangeId, symbol, type: 'POWER_TRADER' },
        orderBy: { createdAt: 'desc' },
      });

      if (!strategy) {
        strategy = await prisma.strategy.create({
          data: {
            name: `DCA Bot — ${symbol}`,
            type: 'POWER_TRADER',
            symbol,
            timeframe,
            config: JSON.stringify(config),
            exchangeId,
            status: 'stopped',
          },
        });
      } else {
        // Merge new config with existing — preserve internal fields like _savedState, _neuralLongLevel, etc.
        const existingConfig = JSON.parse(strategy.config || '{}');
        const internalKeys = Object.keys(existingConfig).filter(k => k.startsWith('_'));
        const preserved = Object.fromEntries(internalKeys.map(k => [k, existingConfig[k]]));
        strategy = await prisma.strategy.update({
          where: { id: strategy.id },
          data: { config: JSON.stringify({ ...config, ...preserved }), timeframe, status: 'stopped' },
        });
      }

      // Start if not already running
      if (!getRunnerStatus(strategy.id)) {
        await startStrategy(strategy.id);
      }

      return NextResponse.json({ success: true, strategyId: strategy.id });
    }

    if (action === 'stop') {
      const strategy = await prisma.strategy.findFirst({
        where: { exchangeId, symbol, type: 'POWER_TRADER' },
        orderBy: { createdAt: 'desc' },
      });
      if (strategy) await stopStrategy(strategy.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
