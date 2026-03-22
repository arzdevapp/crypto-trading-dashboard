import { createStrategy } from './StrategyRegistry';
import { getExchangeAdapter } from '../exchange/ExchangeFactory';
import { prisma } from '../db';
import { log } from '../logger';
import { getPredictor } from '../ml/InstancePredictor';
import type { Signal, StrategyStatus } from '@/types/strategy';
import type { BaseStrategy } from './BaseStrategy';
import type { PowerTraderStrategy } from './implementations/PowerTraderStrategy';

interface RunnerState {
  strategyId: string;
  interval: ReturnType<typeof setInterval>;
  status: StrategyStatus;
  lastSignal?: Signal;
  error?: string;
  strategy: BaseStrategy;
}

const runners = new Map<string, RunnerState>();

type StatusCallback = (strategyId: string, status: StrategyStatus, signal?: Signal, error?: string) => void;

let statusCallback: StatusCallback | null = null;

export function setStatusCallback(cb: StatusCallback) {
  statusCallback = cb;
}

export async function startStrategy(strategyId: string): Promise<void> {
  if (runners.has(strategyId)) throw new Error('Strategy already running');

  const record = await prisma.strategy.findUnique({ where: { id: strategyId } });
  if (!record) throw new Error('Strategy not found');

  const config = JSON.parse(record.config);
  const strategy = createStrategy(record.type, { ...config, symbol: record.symbol, timeframe: record.timeframe, exchangeId: record.exchangeId });
  const adapter = await getExchangeAdapter(record.exchangeId);

  await strategy.initialize((limit) => adapter.fetchOHLCV(record.symbol, record.timeframe, limit));

  await prisma.strategy.update({ where: { id: strategyId }, data: { status: 'running' } });
  statusCallback?.(strategyId, 'running');
  await log('info', `strategy:${strategyId}`, `Strategy started: ${record.name}`, { type: record.type, symbol: record.symbol, timeframe: record.timeframe });

  const intervalMs = getIntervalMs(record.timeframe);
  const interval = setInterval(async () => {
    const runner = runners.get(strategyId);
    if (!runner) return; // Runner was stopped/deleted — bail out
    try {
      const candles = await adapter.fetchOHLCV(record.symbol, record.timeframe, 2);
      if (!candles.length) return;

      // Inject live neural signals into PowerTrader before each candle
      if (record.type === 'POWER_TRADER') {
        try {
          const predictor = await getPredictor(record.symbol);
          const ticker = await adapter.fetchTicker(record.symbol);
          const candles1h = record.timeframe === '1h' ? candles : await adapter.fetchOHLCV(record.symbol, '1h', 3);
          const signals = predictor.aggregateSignals(candles1h, ticker.last);
          (strategy as unknown as PowerTraderStrategy).setNeuralLevels(signals.maxLongSignal, signals.maxShortSignal);
        } catch { /* non-fatal — strategy keeps last known levels */ }
      }

      const signal = await strategy.onCandle(candles[candles.length - 1]);
      runner.lastSignal = signal;
      statusCallback?.(strategyId, 'running', signal);

      await log('signal', `strategy:${strategyId}`, `Signal: ${signal.action.toUpperCase()} ${record.symbol}`, { action: signal.action, price: signal.price, quantity: signal.quantity });

      if (signal.action !== 'hold') {
        const amount = signal.quantity ?? config.quantity ?? 0.001;
        const order = await adapter.placeOrder({
          symbol: record.symbol,
          type: 'market',
          side: signal.action as 'buy' | 'sell',
          amount,
        });
        await log('trade', `strategy:${strategyId}`, `Order placed: ${signal.action.toUpperCase()} ${record.symbol}`, { orderId: order.id, amount, price: signal.price });
      }
    } catch (err) {
      if (!runners.has(strategyId)) return; // Deleted during execution — don't overwrite status
      const error = err instanceof Error ? err.message : String(err);
      await prisma.strategy.update({ where: { id: strategyId }, data: { status: 'error' } }).catch(() => {});
      statusCallback?.(strategyId, 'error', undefined, error);
      await log('error', `strategy:${strategyId}`, `Strategy error: ${error}`, { strategyId });
    }
  }, intervalMs);

  runners.set(strategyId, { strategyId, interval, status: 'running', strategy });
}

export async function stopStrategy(strategyId: string): Promise<void> {
  const state = runners.get(strategyId);
  if (state) {
    clearInterval(state.interval);
    runners.delete(strategyId);
    statusCallback?.(strategyId, 'stopped');
  }
  // Always sync DB regardless of whether runner was in memory — ignore if already deleted
  await prisma.strategy.update({ where: { id: strategyId }, data: { status: 'stopped' } }).catch(() => {});
  await log('info', `strategy:${strategyId}`, 'Strategy stopped');
}

export function getRunnerStatus(strategyId: string): RunnerState | undefined {
  return runners.get(strategyId);
}

export function getStrategyInstance(strategyId: string): BaseStrategy | undefined {
  return runners.get(strategyId)?.strategy;
}

export function getAllRunnerIds(): string[] {
  return Array.from(runners.keys());
}

function getIntervalMs(timeframe: string): number {
  const map: Record<string, number> = {
    '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000,
    '1h': 3600000, '4h': 14400000, '1d': 86400000,
  };
  return map[timeframe] ?? 60000;
}
