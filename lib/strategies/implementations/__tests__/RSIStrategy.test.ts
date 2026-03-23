import { describe, it, expect } from 'vitest';
import { RSIStrategy } from '../RSIStrategy';
import type { OHLCVCandle } from '@/types/exchange';

function makeCandles(closes: number[]): OHLCVCandle[] {
  return closes.map((close, i) => ({
    timestamp: i * 60000,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1000,
  }));
}

// Build enough candles to pass the warmup (period + 10 = 24 by default)
// and have at least 2 RSI values (need period+2 closes = 16 for period=14)
function makeStrategy(config: Record<string, unknown> = {}) {
  return new RSIStrategy({ period: 14, oversold: 30, overbought: 70, quantity: 0.5, ...config });
}

describe('RSIStrategy.computeSignal', () => {
  it('returns hold when there are insufficient candles for RSI', () => {
    const strategy = makeStrategy();
    const candles = makeCandles([100, 101, 102]); // far too few
    const signal = strategy.computeSignal(candles);
    expect(signal.action).toBe('hold');
  });

  it('generates a buy signal when RSI crosses above oversold threshold', () => {
    // Create a series that goes oversold then recovers
    // Start with declining prices to push RSI below 30, then recover
    const closes: number[] = [];
    // 20 declining candles to push RSI very low
    for (let i = 0; i < 20; i++) closes.push(100 - i * 3);
    // Then 5 strong recovery candles to push RSI back above oversold
    for (let i = 0; i < 5; i++) closes.push(closes[closes.length - 1] + 15);

    const strategy = makeStrategy({ period: 14, oversold: 30 });
    const candles = makeCandles(closes);
    // Scan through candles looking for a buy signal
    let buyFound = false;
    for (let i = 15; i < candles.length; i++) {
      const signal = strategy.computeSignal(candles.slice(0, i + 1));
      if (signal.action === 'buy') { buyFound = true; break; }
    }
    expect(buyFound).toBe(true);
  });

  it('generates a sell signal when RSI crosses below overbought threshold', () => {
    const closes: number[] = [];
    // 20 rising candles to push RSI very high
    for (let i = 0; i < 20; i++) closes.push(100 + i * 3);
    // Then 5 declining candles to push RSI back below overbought
    for (let i = 0; i < 5; i++) closes.push(closes[closes.length - 1] - 15);

    const strategy = makeStrategy({ period: 14, overbought: 70 });
    const candles = makeCandles(closes);
    let sellFound = false;
    for (let i = 15; i < candles.length; i++) {
      const signal = strategy.computeSignal(candles.slice(0, i + 1));
      if (signal.action === 'sell') { sellFound = true; break; }
    }
    expect(sellFound).toBe(true);
  });

  it('uses configured quantity in buy signal', () => {
    const closes: number[] = [];
    for (let i = 0; i < 20; i++) closes.push(100 - i * 3);
    for (let i = 0; i < 5; i++) closes.push(closes[closes.length - 1] + 15);

    const strategy = makeStrategy({ period: 14, oversold: 30, quantity: 2.5 });
    const candles = makeCandles(closes);
    let buySignal = null;
    for (let i = 15; i < candles.length; i++) {
      const signal = strategy.computeSignal(candles.slice(0, i + 1));
      if (signal.action === 'buy') { buySignal = signal; break; }
    }
    if (buySignal) {
      expect(buySignal.quantity).toBe(2.5);
    }
  });

  it('hold signal includes current RSI value in reason', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + Math.sin(i) * 2);
    const strategy = makeStrategy();
    const signal = strategy.computeSignal(makeCandles(closes));
    if (signal.action === 'hold') {
      expect(signal.reason).toMatch(/RSI:/);
    }
  });
});

describe('RSIStrategy via onCandle (warmup guard)', () => {
  it('returns hold during warmup period', async () => {
    const strategy = makeStrategy({ period: 14 }); // warmup = 24
    // Feed only 10 candles — below warmupPeriod
    for (let i = 0; i < 10; i++) {
      const signal = await strategy.onCandle(makeCandles([100 + i])[0]);
      expect(signal.action).toBe('hold');
      expect(signal.reason).toBe('Warming up');
    }
  });
});
