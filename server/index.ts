import 'dotenv/config';
import { createWebSocketServer } from './websocket-server';
import { createTerminalServer } from './terminal-server';
import { setStatusCallback, startStrategy } from '../lib/strategies/StrategyRunner';
import { prisma } from '../lib/db';
import type { StrategyStatus } from '../types/strategy';
import type { Signal } from '../types/strategy';
import { broadcast } from './websocket-server';

const WS_PORT = parseInt(process.env.WS_PORT ?? '8080', 10);
const TERMINAL_PORT = parseInt(process.env.TERMINAL_PORT ?? '8082', 10);

createWebSocketServer(WS_PORT);
createTerminalServer(TERMINAL_PORT);

setStatusCallback((strategyId: string, status: StrategyStatus, signal?: Signal, error?: string) => {
  broadcast({ type: 'strategy', strategyId, status, signal, error });
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
      } catch (err) {
        console.error(`[boot] ✗ Failed to resume: ${s.name} — ${err}`);
        // Keep status as 'running' so next restart will retry (don't mark as error)
      }
    }
  } catch (err) {
    console.error('[boot] Strategy recovery failed:', err);
  }
}

resumeRunningStrategies();

console.log('Crypto trading bot server started');
