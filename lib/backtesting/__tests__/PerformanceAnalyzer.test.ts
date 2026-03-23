import { describe, it, expect } from 'vitest';
import { PerformanceAnalyzer } from '../PerformanceAnalyzer';
import type { BacktestTrade } from '@/types/backtest';

function makeTrade(pnl: number, pnlPct: number): BacktestTrade {
  return {
    entryTime: 0,
    exitTime: 1,
    side: 'buy',
    entryPrice: 100,
    exitPrice: 100 + pnl,
    quantity: 1,
    pnl,
    pnlPct,
    commission: 0,
  };
}

function makeEquity(values: number[]): { timestamp: number; equity: number }[] {
  return values.map((equity, i) => ({ timestamp: i * 1000, equity }));
}

describe('PerformanceAnalyzer.compute', () => {
  it('returns initial capital when no trades or equity data', () => {
    const result = PerformanceAnalyzer.compute([], [], 10000);
    expect(result.finalCapital).toBe(10000);
    expect(result.totalReturn).toBe(0);
    expect(result.totalReturnPct).toBe(0);
  });

  it('computes total return correctly', () => {
    const equity = makeEquity([10000, 11000]);
    const result = PerformanceAnalyzer.compute([], equity, 10000);
    expect(result.totalReturn).toBe(1000);
    expect(result.totalReturnPct).toBeCloseTo(10);
  });

  it('computes win rate correctly', () => {
    const trades = [makeTrade(100, 10), makeTrade(50, 5), makeTrade(-30, -3)];
    const result = PerformanceAnalyzer.compute(trades, makeEquity([10000, 10120]), 10000);
    expect(result.winRate).toBeCloseTo((2 / 3) * 100);
    expect(result.winningTrades).toBe(2);
    expect(result.losingTrades).toBe(1);
  });

  it('computes profit factor as grossProfit / grossLoss', () => {
    // Wins: 100+50=150, Loss: 30 → PF = 150/30 = 5
    const trades = [makeTrade(100, 10), makeTrade(50, 5), makeTrade(-30, -3)];
    const result = PerformanceAnalyzer.compute(trades, makeEquity([10000, 10120]), 10000);
    expect(result.profitFactor).toBeCloseTo(5);
  });

  it('returns Infinity profit factor when there are no losing trades', () => {
    const trades = [makeTrade(100, 10), makeTrade(50, 5)];
    const result = PerformanceAnalyzer.compute(trades, makeEquity([10000, 10150]), 10000);
    expect(result.profitFactor).toBe(Infinity);
  });

  it('computes max drawdown correctly', () => {
    // Peak at 12000, trough at 9000 → drawdown = 3000 (25%)
    const equity = makeEquity([10000, 12000, 9000, 11000]);
    const result = PerformanceAnalyzer.compute([], equity, 10000);
    expect(result.maxDrawdown).toBe(3000);
    expect(result.maxDrawdownPct).toBeCloseTo(25);
  });

  it('maxDrawdown is 0 when equity only rises', () => {
    const equity = makeEquity([10000, 11000, 12000, 13000]);
    const result = PerformanceAnalyzer.compute([], equity, 10000);
    expect(result.maxDrawdown).toBe(0);
  });

  it('identifies best and worst trades', () => {
    const trades = [makeTrade(200, 20), makeTrade(-50, -5), makeTrade(100, 10)];
    const result = PerformanceAnalyzer.compute(trades, makeEquity([10000, 10250]), 10000);
    expect(result.bestTrade).toBe(20);
    expect(result.worstTrade).toBe(-5);
  });

  it('sharpeRatio is 0 when returns have no variance', () => {
    // Flat equity → stdReturn = 0 → sharpe = 0
    const equity = makeEquity([10000, 10000, 10000]);
    const result = PerformanceAnalyzer.compute([], equity, 10000);
    expect(result.sharpeRatio).toBe(0);
  });

  it('includes all trades in output', () => {
    const trades = [makeTrade(100, 10), makeTrade(-20, -2)];
    const result = PerformanceAnalyzer.compute(trades, makeEquity([10000, 10080]), 10000);
    expect(result.trades).toHaveLength(2);
  });
});
