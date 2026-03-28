export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getExchangeAdapter } from '@/lib/exchange/ExchangeFactory';
import type { PowerTraderState } from '@/lib/strategies/implementations/PowerTraderStrategy';

// ── Sidecar control helpers ───────────────────────────────────────────────────
// Strategies must only run in the sidecar (server/index.ts), never in the
// hot-reloading Next.js process. All runner start/stop/status calls go here.
const CONTROL_BASE = `http://127.0.0.1:${process.env.CONTROL_PORT ?? '8081'}`;

interface RunnerInfo { running: boolean; lastSignal: unknown; error: string | null; powerState: unknown }

async function controlPost(path: string, body: Record<string, string>): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await fetch(`${CONTROL_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    return res.json() as Promise<{ ok?: boolean; error?: string }>;
  } catch {
    return { error: 'Sidecar not reachable — is the server running? (npm run dev:server)' };
  }
}

async function controlGet(path: string): Promise<RunnerInfo | RunnerInfo[] | null> {
  try {
    const res = await fetch(`${CONTROL_BASE}${path}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return res.json() as Promise<RunnerInfo | RunnerInfo[]>;
  } catch {
    return null; // sidecar unreachable — degrade gracefully
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// GET — current bot status for a given exchange+symbol, or list all bots
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const exchangeId = searchParams.get('exchangeId');
  const symbol = searchParams.get('symbol');
  const listAll = searchParams.get('all') === '1';
  const sanity = searchParams.get('sanity') === '1';

  if (!exchangeId) {
    return NextResponse.json({ error: 'exchangeId required' }, { status: 400 });
  }

  try {
    // === SANITY CHECK: Full health snapshot for a running bot ===
    if (sanity && symbol) {
      const strategy = await prisma.strategy.findFirst({
        where: { exchangeId, symbol, type: 'POWER_TRADER' },
        orderBy: { createdAt: 'desc' },
      });

      if (!strategy) {
        return NextResponse.json({ ok: false, error: 'No DCA bot found for this symbol' });
      }

      const cfg = JSON.parse(strategy.config) as Record<string, unknown>;
      const sidecarStatus = await controlGet(`/strategy/status?strategyId=${strategy.id}`) as RunnerInfo | null;
      const powerState = (sidecarStatus?.powerState ?? null) as PowerTraderState | null;

      // Extract injected signal values
      const neuralLongLevel = (cfg._neuralLongLevel as number) ?? 0;
      const neuralShortLevel = (cfg._neuralShortLevel as number) ?? 0;
      const newsSentiment = (cfg._newsSentiment as number) ?? null;
      const newsSentimentLabel = (cfg._newsSentimentLabel as string) ?? null;
      const macroTrend = (cfg._macroTrend as string) ?? null;
      const tradeStartLevel = (cfg.tradeStartLevel as number) ?? 3;
      const side = (cfg.side as string) ?? 'long';

      // Evaluate entry condition
      const newsAdjustment = side === 'short'
        ? (typeof newsSentiment === 'number' ? (newsSentiment >= 0.5 ? 2 : newsSentiment >= 0.2 ? 1 : newsSentiment !== null && newsSentiment <= -0.4 ? -1 : 0) : 0)
        : (typeof newsSentiment === 'number' ? (newsSentiment <= -0.5 ? 2 : newsSentiment <= -0.2 ? 1 : newsSentiment >= 0.4 ? -1 : 0) : 0);
      const effectiveStartLevel = Math.max(1, tradeStartLevel + newsAdjustment);

      const entryMet = side === 'short'
        ? neuralShortLevel >= effectiveStartLevel && neuralLongLevel < neuralShortLevel
        : neuralLongLevel >= effectiveStartLevel && neuralShortLevel < neuralLongLevel;

      // Collect active blocks
      const blocks: string[] = [];
      if (newsSentiment !== null) {
        if (side === 'short' && newsSentiment >= 0.5) blocks.push(`News block: ${newsSentimentLabel} (${newsSentiment.toFixed(2)}) — too bullish for short`);
        if (side === 'long'  && newsSentiment <= -0.5) blocks.push(`News block: ${newsSentimentLabel} (${newsSentiment.toFixed(2)}) — too bearish for long`);
      }
      if (macroTrend && cfg.filterMacroTrend) {
        if (side === 'short' && macroTrend === 'bullish') blocks.push('Macro block: bullish HTF trend blocks short');
        if (side === 'long'  && macroTrend === 'bearish') blocks.push('Macro block: bearish HTF trend blocks long');
      }
      if (powerState && cfg.dailyLossLimit) {
        const limit = cfg.dailyLossLimit as number;
        if (powerState.dailyLossTotal >= limit) blocks.push(`Daily loss limit: $${powerState.dailyLossTotal.toFixed(2)} >= $${limit}`);
      }

      // Signal-level diagnosis
      const signalDiag = side === 'short'
        ? `short signal ${neuralShortLevel} needs >= ${effectiveStartLevel}${neuralShortLevel >= effectiveStartLevel && neuralLongLevel >= neuralShortLevel ? ` (blocked: long=${neuralLongLevel} >= short=${neuralShortLevel})` : ''}`
        : `long signal ${neuralLongLevel} needs >= ${effectiveStartLevel}${neuralLongLevel >= effectiveStartLevel && neuralShortLevel >= neuralLongLevel ? ` (blocked: short=${neuralShortLevel} >= long=${neuralLongLevel})` : ''}`;

      return NextResponse.json({
        ok: true,
        running: sidecarStatus?.running ?? false,
        status: strategy.status,
        symbol,
        side,
        signals: {
          neuralLongLevel,
          neuralShortLevel,
          newsSentiment,
          newsSentimentLabel,
          macroTrend: macroTrend ?? 'not computed',
        },
        entry: {
          tradeStartLevel,
          newsAdjustment,
          effectiveStartLevel,
          entryMet,
          diagnosis: entryMet ? 'Entry conditions met — would trade on next tick' : `Not met: ${signalDiag}`,
          activeBlocks: blocks,
        },
        position: powerState ?? 'bot not running (no in-memory state)',
        lastSignal: sidecarStatus?.lastSignal ?? null,
        configuredFilters: {
          filterMacroTrend: cfg.filterMacroTrend ?? false,
          filterMaTrend: cfg.filterMaTrend ?? false,
          macroTimeframe: cfg.macroTimeframe ?? null,
          useAtrSizing: cfg.useAtrSizing ?? false,
          dailyLossLimit: cfg.dailyLossLimit ?? 0,
          maxDrawdownPct: cfg.maxDrawdownPct ?? 25,
        },
      });
    }

    // List all POWER_TRADER bots for this exchange
    if (listAll || !symbol) {
      const strategies = await prisma.strategy.findMany({
        where: { exchangeId, type: 'POWER_TRADER' },
        orderBy: { createdAt: 'desc' },
      });

      // Fetch all runner statuses from sidecar in one call
      const allStatuses = (await controlGet('/strategy/status/all') ?? []) as RunnerInfo[] & { strategyId?: string }[];
      const statusById = new Map<string, RunnerInfo>(
        (allStatuses as (RunnerInfo & { strategyId: string })[]).map(s => [s.strategyId, s])
      );

      const bots = strategies.map(s => {
        const rs = statusById.get(s.id);
        return {
          id: s.id,
          symbol: s.symbol,
          timeframe: s.timeframe,
          status: s.status,
          running: rs?.running ?? false,
          lastSignal: rs?.lastSignal ?? null,
          error: rs?.error ?? null,
          powerState: (rs?.powerState ?? null) as PowerTraderState | null,
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

    const [singleStatus, currentPrice] = await Promise.all([
      controlGet(`/strategy/status?strategyId=${strategy.id}`) as Promise<RunnerInfo | null>,
      getExchangeAdapter(exchangeId).then(a => a.fetchTicker(symbol!)).then(t => t.last).catch(() => 0),
    ]);

    return NextResponse.json({
      running: singleStatus?.running ?? false,
      strategy: {
        id: strategy.id,
        name: strategy.name,
        status: strategy.status,
        timeframe: strategy.timeframe,
        config: JSON.parse(strategy.config),
      },
      lastSignal: singleStatus?.lastSignal ?? null,
      error: singleStatus?.error ?? null,
      powerState: (singleStatus?.powerState ?? null) as PowerTraderState | null,
      currentPrice,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
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

      // Delegate start to the sidecar — strategies must only run in the stable sidecar process
      const result = await controlPost('/strategy/start', { strategyId: strategy.id });
      if (result.error) throw new Error(result.error);

      return NextResponse.json({ success: true, strategyId: strategy.id });
    }

    if (action === 'stop') {
      const strategy = await prisma.strategy.findFirst({
        where: { exchangeId, symbol, type: 'POWER_TRADER' },
        orderBy: { createdAt: 'desc' },
      });
      if (strategy) {
        const result = await controlPost('/strategy/stop', { strategyId: strategy.id });
        if (result.error) throw new Error(result.error);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
