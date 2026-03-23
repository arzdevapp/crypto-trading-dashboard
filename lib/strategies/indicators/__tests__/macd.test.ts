import { describe, it, expect } from 'vitest';
import { macd } from '../macd';

// Enough data for MACD(12, 26, 9): need at least 26 + 9 - 1 = 34 values
const prices = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.4) * 10);

describe('macd', () => {
  it('returns empty arrays when data is insufficient', () => {
    const result = macd([1, 2, 3], 12, 26, 9);
    expect(result.macd).toEqual([]);
    expect(result.signal).toEqual([]);
    expect(result.histogram).toEqual([]);
  });

  it('signal and histogram have same length', () => {
    const result = macd(prices);
    expect(result.signal.length).toBe(result.histogram.length);
  });

  it('histogram equals macd line minus signal line', () => {
    const result = macd(prices);
    const sigOffset = result.macd.length - result.signal.length;
    result.histogram.forEach((h, i) => {
      expect(h).toBeCloseTo(result.macd[i + sigOffset] - result.signal[i], 8);
    });
  });

  it('macd line length equals slowPeriod EMA length', () => {
    // slowEMA length = values.length - slowPeriod + 1
    const n = prices.length;
    const slowPeriod = 26;
    const result = macd(prices, 12, slowPeriod, 9);
    expect(result.macd.length).toBe(n - slowPeriod + 1);
  });

  it('positive macd when fast EMA > slow EMA (rising prices)', () => {
    // Strongly trending up: fast EMA should exceed slow EMA
    const rising = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
    const result = macd(rising, 12, 26, 9);
    const last = result.macd[result.macd.length - 1];
    expect(last).toBeGreaterThan(0);
  });

  it('negative macd when prices are falling', () => {
    const falling = Array.from({ length: 50 }, (_, i) => 200 - i * 2);
    const result = macd(falling, 12, 26, 9);
    const last = result.macd[result.macd.length - 1];
    expect(last).toBeLessThan(0);
  });
});
