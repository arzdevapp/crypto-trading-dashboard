import 'dotenv/config';
import { createWebSocketServer } from './websocket-server';
import { setStatusCallback } from '../lib/strategies/StrategyRunner';
import type { StrategyStatus } from '../types/strategy';
import type { Signal } from '../types/strategy';
import { broadcast } from './websocket-server';

const WS_PORT = parseInt(process.env.WS_PORT ?? '8080', 10);

createWebSocketServer(WS_PORT);

setStatusCallback((strategyId: string, status: StrategyStatus, signal?: Signal, error?: string) => {
  broadcast({ type: 'strategy', strategyId, status, signal, error });
});

console.log('Crypto trading bot server started');
