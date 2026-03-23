import { createStrategy } from './StrategyRegistry';
import { getExchangeAdapter } from '../exchange/ExchangeFactory';
import { prisma } from '../db';
import { log } from '../logger';
import { getPredictor } from '../ml/InstancePredictor';
import { getNewsSentiment } from '../news/NewsSentimentScorer';
import type { Signal, StrategyStatus } from '@/types/strategy';
import type { BaseStrategy } from './BaseStrategy';

// Shared interface for strategies that accept injected neural + news signals
interface NeuralAwareStrategy {
  setNeuralLevels(long: number, short: number): void;
  setNewsSentiment(score: number, label: string): void;
}

// Stateful strategies that can persist/restore position state across restarts
interface StatefulStrategy {
  getState(): Record<string, unknown>;
  restoreState(state: Record<string, unknown>): void;
}

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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Returns true for errors likely caused by transient conditions that are worth retrying. */
function isTransientError(err: Error): boolean {
  const msg = err.message.toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('temporary')
  );
}

/** Returns true for errors that mean the order was definitely not placed (no retry needed). */
function isPermanentError(err: Error): boolean {
  const msg = err.message.toLowerCase();
  return (
    msg.includes('insufficient') ||
    msg.includes('not enough') ||
    msg.includes('balance') ||
    msg.includes('minimum') ||
    msg.includes('invalid symbol') ||
    msg.includes('market is closed') ||
    msg.includes('permission')
  );
}

/** Persist the strategy's in-memory position state to the DB config so it
 *  survives server restarts. Only called after confirmed buy/sell orders. */
async function persistState(strategyId: string, config: Record<string, unknown>, strategy: BaseStrategy): Promise<void> {
  if (!('getState' in strategy)) return;
  const savedState = (strategy as unknown as StatefulStrategy).getState();
  const updatedConfig = { ...config, _savedState: savedState };
  await prisma.strategy.update({
    where: { id: strategyId },
    data: { config: JSON.stringify(updatedConfig) },
  }).catch(() => {}); // non-fatal — worst case state is lost on restart
}

export async function startStrategy(strategyId: string): Promise<void> {
  if (runners.has(strategyId)) throw new Error('Strategy already running');

  const record = await prisma.strategy.findUnique({ where: { id: strategyId } });
  if (!record) throw new Error('Strategy not found');

  const config = JSON.parse(record.config);
  const strategy = createStrategy(record.type, { ...config, symbol: record.symbol, timeframe: record.timeframe, exchangeId: record.exchangeId });
  const adapter = await getExchangeAdapter(record.exchangeId);

  await strategy.initialize((limit) => adapter.fetchOHLCV(record.symbol, record.timeframe, limit));

  // Restore persisted position state (survives server restarts)
  if (config._savedState && 'restoreState' in strategy) {
    (strategy as unknown as StatefulStrategy).restoreState(config._savedState);
    await log('info', `strategy:${strategyId}`, 'Restored saved position state from DB');
  }

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

      // Inject live neural signals + news sentiment into PowerTrader / DayTrader before each candle
      if (record.type === 'POWER_TRADER' || record.type === 'DAY_TRADER') {
        try {
          const predictor = await getPredictor(record.symbol);
          const ticker = await adapter.fetchTicker(record.symbol);
          const candles1h = record.timeframe === '1h' ? candles : await adapter.fetchOHLCV(record.symbol, '1h', 3);
          const signals = predictor.aggregateSignals(candles1h, ticker.last);
          (strategy as unknown as NeuralAwareStrategy).setNeuralLevels(signals.maxLongSignal, signals.maxShortSignal);
        } catch { /* non-fatal — strategy keeps last known levels */ }

        try {
          const sentiment = await getNewsSentiment(record.symbol);
          (strategy as unknown as NeuralAwareStrategy).setNewsSentiment(sentiment.score, sentiment.label);
        } catch { /* non-fatal */ }
      }

      // Snapshot state BEFORE computing the signal so we can revert if the order fails.
      // computeSignal() mutates internal state (sets inPosition, updates avgCostBasis, etc.)
      // before the actual exchange order is placed, which would leave the bot desynced.
      const stateSnapshot = ('getState' in strategy)
        ? (strategy as unknown as StatefulStrategy).getState()
        : null;

      const signal = await strategy.onCandle(candles[candles.length - 1]);
      runner.lastSignal = signal;
      statusCallback?.(strategyId, 'running', signal);

      await log('signal', `strategy:${strategyId}`, `Signal: ${signal.action.toUpperCase()} ${record.symbol}`, { action: signal.action, price: signal.price, quantity: signal.quantity });

      if (signal.action !== 'hold') {
        const amount = signal.quantity ?? config.quantity ?? 0.001;

        // Guard: skip if amount is invalid
        if (!amount || isNaN(amount) || amount <= 0) {
          // Revert state — no order will be placed
          if (stateSnapshot && 'restoreState' in strategy) {
            (strategy as unknown as StatefulStrategy).restoreState(stateSnapshot);
            await persistState(strategyId, config, strategy);
          }
          await log('warn', `strategy:${strategyId}`, `Skipping ${signal.action} — invalid amount: ${amount}`);
          return;
        }

        // Attempt order with retry for transient failures (max 3 attempts, exponential backoff)
        const MAX_RETRIES = 3;
        let lastErr: Error | null = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            const order = await adapter.placeOrder({
              symbol: record.symbol,
              type: 'market',
              side: signal.action as 'buy' | 'sell',
              amount,
            });

            await log('trade', `strategy:${strategyId}`,
              `Order placed: ${signal.action.toUpperCase()} ${amount} ${record.symbol}${attempt > 1 ? ` (attempt ${attempt})` : ''}`,
              { orderId: order.id, amount, price: signal.price });

            // Order confirmed — persist the new state
            await persistState(strategyId, config, strategy);
            lastErr = null;
            break; // success
          } catch (err) {
            lastErr = err instanceof Error ? err : new Error(String(err));

            // Permanent error (e.g. insufficient funds) — no point retrying
            if (isPermanentError(lastErr)) break;

            // Transient error — wait and retry
            if (isTransientError(lastErr) && attempt < MAX_RETRIES) {
              const wait = attempt * 2000; // 2s → 4s
              await log('warn', `strategy:${strategyId}`,
                `Order attempt ${attempt} failed (${lastErr.message}) — retrying in ${wait / 1000}s`);
              await sleep(wait);
              continue;
            }

            break; // unknown error — don't retry
          }
        }

        // All attempts failed — revert strategy state to keep it in sync with the exchange
        if (lastErr) {
          if (stateSnapshot && 'restoreState' in strategy) {
            (strategy as unknown as StatefulStrategy).restoreState(stateSnapshot);
            await persistState(strategyId, config, strategy); // persist reverted state
          }

          const isSell = signal.action === 'sell';
          await log('error', `strategy:${strategyId}`,
            `${isSell ? '⚠️ SELL' : 'BUY'} order failed after ${MAX_RETRIES} attempt(s): ${lastErr.message} — state reverted`,
            { action: signal.action, amount, symbol: record.symbol });

          // Sell failures need special handling — the bot is still holding coins but
          // the trailing stop fired. Keep the runner alive so it can re-attempt on the
          // next candle when the price crosses the trailing line again.
          if (isSell) {
            statusCallback?.(strategyId, 'running', undefined,
              `Sell failed: ${lastErr.message} — still holding position, will retry`);
          }
        }
      }
    } catch (err) {
      if (!runners.has(strategyId)) return; // Deleted during execution — don't overwrite status
      const error = err instanceof Error ? err.message : String(err);
      // Stop the runner so we don't keep spamming errors on every interval tick
      clearInterval(interval);
      runners.delete(strategyId);
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
