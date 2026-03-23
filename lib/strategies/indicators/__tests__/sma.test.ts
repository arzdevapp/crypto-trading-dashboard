import { describe, it, expect } from 'vitest';
import { sma } from '../sma';

describe('sma', () => {
  it('returns empty array when values are fewer than period', () => {
    expect(sma([1, 2, 3], 5)).toEqual([]);
    expect(sma([], 3)).toEqual([]);
  });

  it('returns single value when length equals period', () => {
    expect(sma([1, 2, 3], 3)).toEqual([2]);
  });

  it('computes a simple 3-period moving average correctly', () => {
    // [1,2,3] → 2, [2,3,4] → 3, [3,4,5] → 4
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([2, 3, 4]);
  });

  it('computes a 2-period moving average', () => {
    expect(sma([10, 20, 30, 40], 2)).toEqual([15, 25, 35]);
  });

  it('handles constant values', () => {
    const result = sma([5, 5, 5, 5, 5], 3);
    result.forEach((v) => expect(v).toBeCloseTo(5));
  });

  it('output length equals values.length - period + 1', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const period = 4;
    expect(sma(values, period)).toHaveLength(values.length - period + 1);
  });
});
