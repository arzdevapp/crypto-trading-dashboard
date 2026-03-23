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

    const results = await Promise.allSettled(
      running.map(s => startStrategy(s.id))
    );

    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        console.log(`[boot] ✓ Resumed: ${running[i].name} (${running[i].symbol})`);
      } else {
        console.error(`[boot] ✗ Failed to resume: ${running[i].name} — ${r.reason}`);
        // Mark as error so the UI shows it needs attention
        prisma.strategy.update({
          where: { id: running[i].id },
          data: { status: 'error' },
        }).catch(() => {});
      }
    });
  } catch (err) {
    console.error('[boot] Strategy recovery failed:', err);
  }
}

resumeRunningStrategies();

console.log('Crypto trading bot server started');
