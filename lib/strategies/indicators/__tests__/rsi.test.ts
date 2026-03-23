import { describe, it, expect } from 'vitest';
import { rsi } from '../rsi';

describe('rsi', () => {
  it('returns empty array when insufficient data', () => {
    expect(rsi([1, 2, 3], 14)).toEqual([]);
    expect(rsi([], 14)).toEqual([]);
  });

  it('returns 100 when all moves are gains (no losses)', () => {
    const ascending = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    const result = rsi(ascending, 14);
    expect(result[0]).toBeCloseTo(100);
  });

  it('returns 0 when all moves are losses (no gains)', () => {
    const descending = [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    const result = rsi(descending, 14);
    expect(result[0]).toBeCloseTo(0);
  });

  it('returns ~50 for alternating equal up/down moves', () => {
    // Perfectly alternating +1/-1 gives equal avg gain and avg loss → RSI ≈ 50
    const alternating: number[] = [100];
    for (let i = 0; i < 30; i++) {
      alternating.push(alternating[i] + (i % 2 === 0 ? 1 : -1));
    }
    const result = rsi(alternating, 14);
    const last = result[result.length - 1];
    expect(last).toBeGreaterThan(40);
    expect(last).toBeLessThan(60);
  });

  it('output length equals values.length - period', () => {
    const values = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(rsi(values, 14)).toHaveLength(6); // 20 - 14 = 6
  });

  it('all values stay within [0, 100]', () => {
    const values = [50, 51, 49, 52, 48, 55, 45, 60, 40, 65, 35, 70, 30, 75, 25, 80, 20];
    const result = rsi(values, 5);
    result.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});
