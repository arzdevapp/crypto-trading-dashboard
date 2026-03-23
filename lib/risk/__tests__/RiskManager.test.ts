import { describe, it, expect, beforeEach } from 'vitest';
import { RiskManager } from '../RiskManager';
import type { RiskProfile, PortfolioSnapshot } from '../RiskManager';
import type { Signal } from '@/types/strategy';

const defaultProfile: RiskProfile = {
  maxPositionSizePct: 10,
  maxDrawdownPct: 20,
  defaultStopLossPct: 2,
  defaultTakeProfitPct: 4,
  maxOpenPositions: 3,
};

const healthyPortfolio: PortfolioSnapshot = {
  totalValue: 10000,
  openPositionCount: 0,
  drawdownPct: 0,
  lastPrice: 100,
};

describe('RiskManager.validate', () => {
  let rm: RiskManager;

  beforeEach(() => {
    rm = new RiskManager(defaultProfile);
  });

  it('approves a valid buy signal', () => {
    const signal: Signal = { action: 'buy', quantity: 0.5, reason: 'test' }; // 0.5*100 = $50 = 0.5%
    const result = rm.validate(signal, healthyPortfolio);
    expect(result.approved).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects buy when max open positions reached', () => {
    const signal: Signal = { action: 'buy', quantity: 0.5, reason: 'test' };
    const portfolio: PortfolioSnapshot = { ...healthyPortfolio, openPositionCount: 3 };
    const result = rm.validate(signal, portfolio);
    expect(result.approved).toBe(false);
    expect(result.errors[0]).toMatch(/max open positions/i);
  });

  it('rejects buy when max drawdown exceeded', () => {
    const signal: Signal = { action: 'buy', quantity: 0.5, reason: 'test' };
    const portfolio: PortfolioSnapshot = { ...healthyPortfolio, drawdownPct: 25 };
    const result = rm.validate(signal, portfolio);
    expect(result.approved).toBe(false);
    expect(result.errors[0]).toMatch(/drawdown/i);
  });

  it('rejects buy when position size exceeds limit', () => {
    // 10% max, totalValue=10000, so max position = $1000 = 10 units at $100
    // 15 units * $100 = $1500 = 15% → rejected
    const signal: Signal = { action: 'buy', quantity: 15, price: 100, reason: 'test' };
    const result = rm.validate(signal, healthyPortfolio);
    expect(result.approved).toBe(false);
    expect(result.errors[0]).toMatch(/position size/i);
  });

  it('always approves sell signals regardless of portfolio state', () => {
    const signal: Signal = { action: 'sell', quantity: 1, reason: 'test' };
    const stressedPortfolio: PortfolioSnapshot = {
      totalValue: 100,
      openPositionCount: 99,
      drawdownPct: 99,
      lastPrice: 100,
    };
    const result = rm.validate(signal, stressedPortfolio);
    expect(result.approved).toBe(true);
  });

  it('injects stop loss and take profit into adjusted signal', () => {
    const signal: Signal = { action: 'buy', quantity: 0.5, reason: 'test' };
    const result = rm.validate(signal, healthyPortfolio);
    expect(result.adjustedSignal?.stopLoss).toBeDefined();
    expect(result.adjustedSignal?.takeProfit).toBeDefined();
  });

  it('preserves existing stop loss and take profit on the signal', () => {
    const signal: Signal = { action: 'buy', quantity: 0.5, stopLoss: 90, takeProfit: 120, reason: 'test' };
    const result = rm.validate(signal, healthyPortfolio);
    expect(result.adjustedSignal?.stopLoss).toBe(90);
    expect(result.adjustedSignal?.takeProfit).toBe(120);
  });

  it('can accumulate multiple errors', () => {
    const signal: Signal = { action: 'buy', quantity: 20, price: 100, reason: 'test' };
    const portfolio: PortfolioSnapshot = { ...healthyPortfolio, openPositionCount: 3, drawdownPct: 25 };
    const result = rm.validate(signal, portfolio);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('RiskManager.computeStopLoss', () => {
  it('places stop loss below entry for a buy', () => {
    const rm = new RiskManager(defaultProfile);
    const stop = rm.computeStopLoss(100, 'buy');
    expect(stop).toBe(98); // 100 - 2% = 98
  });

  it('places stop loss above entry for a sell', () => {
    const rm = new RiskManager(defaultProfile);
    const stop = rm.computeStopLoss(100, 'sell');
    expect(stop).toBe(102); // 100 + 2% = 102
  });
});

describe('RiskManager.computeTakeProfit', () => {
  it('places take profit above entry for a buy', () => {
    const rm = new RiskManager(defaultProfile);
    const tp = rm.computeTakeProfit(100, 'buy');
    expect(tp).toBe(104); // 100 + 4% = 104
  });

  it('places take profit below entry for a sell', () => {
    const rm = new RiskManager(defaultProfile);
    const tp = rm.computeTakeProfit(100, 'sell');
    expect(tp).toBe(96); // 100 - 4% = 96
  });
});
