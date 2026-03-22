import type { OHLCVCandle } from '@/types/exchange';
import type { BacktestMetrics } from '@/types/backtest';
import { BaseStrategy } from '../strategies/BaseStrategy';
import { BacktestBroker } from './BacktestBroker';
import { PerformanceAnalyzer } from './PerformanceAnalyzer';

export interface BacktestEngineParams {
  candles: OHLCVCandle[];
  initialCapital: number;
  commissionRate: number;
  slippagePct: number;
}

export async function runBacktest(strategy: BaseStrategy, params: BacktestEngineParams): Promise<BacktestMetrics> {
  const broker = new BacktestBroker(params.initialCapital, params.commissionRate, params.slippagePct);

  for (let i = 1; i < params.candles.length; i++) {
    const candle = params.candles[i];
    broker.settlePendingOrders(candle.open, candle.timestamp);
    // Strategy only sees candles up to i-1 (no lookahead)
    const signal = await strategy.onCandle(params.candles[i - 1]);
    if (signal.action !== 'hold') {
      broker.submitOrder(signal, candle.open);
    }
  }

  broker.closeAllPositions(params.candles[params.candles.length - 1].close);
  return PerformanceAnalyzer.compute(broker.getTrades(), broker.getEquityCurve(), params.initialCapital);
}
