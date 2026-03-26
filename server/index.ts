import 'dotenv/config';
import { createWebSocketServer } from './websocket-server';
import { createTerminalServer } from './terminal-server';
import { setStatusCallback, startStrategy } from '../lib/strategies/StrategyRunner';
import { prisma } from '../lib/db';
import type { StrategyStatus } from '../types/strategy';
import type { Signal } from '../types/strategy';
import { broadcast } from './websocket-server';
import { initTelegramBot, notifyTrade, notifyError, notifyStopped, notifyMessage } from './telegram-bot';

const WS_PORT = parseInt(process.env.WS_PORT ?? '8080', 10);
const TERMINAL_PORT = parseInt(process.env.TERMINAL_PORT ?? '8082', 10);

createWebSocketServer(WS_PORT);
createTerminalServer(TERMINAL_PORT);
initTelegramBot();

// Cache strategy name+symbol by ID to avoid DB lookups on every signal
const strategyCache = new Map<string, { name: string; symbol: string }>();

async function getStrategyMeta(strategyId: string) {
  if (!strategyCache.has(strategyId)) {
    const s = await prisma.strategy.findUnique({ where: { id: strategyId }, select: { name: true, symbol: true } });
    if (s) strategyCache.set(strategyId, s);
  }
  return strategyCache.get(strategyId);
}

setStatusCallback(async (strategyId: string, status: StrategyStatus, signal?: Signal, error?: string) => {
  broadcast({ type: 'strategy', strategyId, status, signal, error });

  // Telegram notifications
  if (signal?.action === 'buy' || signal?.action === 'sell') {
    const meta = await getStrategyMeta(strategyId);
    if (meta && signal.price && signal.quantity) {
      notifyTrade(meta.name, meta.symbol, signal.action, signal.quantity, signal.price);
    }
  } else if (status === 'error' && error) {
    const meta = await getStrategyMeta(strategyId);
    if (meta) notifyError(meta.name, meta.symbol, error);
  } else if (status === 'stopped') {
    const meta = await getStrategyMeta(strategyId);
    if (meta) notifyStopped(meta.name, meta.symbol);
  }
});

/** On boot, resume any strategies that were running when the server last shut down.
 *  State (position, avg cost, DCA stage) was persisted to DB so they pick up
 *  exactly where they left off. */
async function resumeRunningStrategies() {
  try {
    const running = await prisma.strategy.findMany({ where: { status: 'running' } });
    if (running.length === 0) return;

    console.log(`[boot] Resuming ${running.length} strategy(s) that were running before shutdown…`);

    // Resume sequentially to avoid concurrent Prisma write timeouts on SQLite
    for (const s of running) {
      try {
        await startStrategy(s.id);
        console.log(`[boot] ✓ Resumed: ${s.name} (${s.symbol})`);
        strategyCache.set(s.id, { name: s.name, symbol: s.symbol });
        // Clear retry counter on successful resume
        const cfg = JSON.parse(s.config || '{}');
        if (cfg._resumeFailCount) {
          delete cfg._resumeFailCount;
          await prisma.strategy.update({ where: { id: s.id }, data: { config: JSON.stringify(cfg) } }).catch(() => {});
        }
      } catch (err) {
        console.error(`[boot] ✗ Failed to resume: ${s.name} — ${err}`);
        // Track resume failures in config — mark as error after 3 consecutive failures
        const config = JSON.parse(s.config || '{}');
        const retryCount = (config._resumeFailCount ?? 0) + 1;
        config._resumeFailCount = retryCount;
        if (retryCount >= 3) {
          await prisma.strategy.update({ where: { id: s.id }, data: { status: 'error', config: JSON.stringify(config) } }).catch(() => {});
          console.error(`[boot] ✗ ${s.name} failed ${retryCount} consecutive resume(s) — marking as error`);
        } else {
          await prisma.strategy.update({ where: { id: s.id }, data: { config: JSON.stringify(config) } }).catch(() => {});
        }
      }
    }

    notifyMessage(`🤖 *Server restarted*\nResumed ${running.length} strategy(s): ${running.map(s => s.name).join(', ')}`);
  } catch (err) {
    console.error('[boot] Strategy recovery failed:', err);
  }
}

resumeRunningStrategies();

console.log('Crypto trading bot server started');
