import { describe, it, expect } from 'vitest';
import { ema } from '../ema';

describe('ema', () => {
  it('returns empty array when values are fewer than period', () => {
    expect(ema([1, 2], 3)).toEqual([]);
    expect(ema([], 5)).toEqual([]);
  });

  it('first value equals SMA of the initial period', () => {
    // period=3, first 3 values [2,4,6] → SMA = 4
    const result = ema([2, 4, 6, 8], 3);
    expect(result[0]).toBeCloseTo(4);
  });

  it('output length equals values.length - period + 1', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8];
    const period = 3;
    expect(ema(values, period)).toHaveLength(values.length - period + 1);
  });

  it('responds faster to recent prices than SMA', () => {
    // Flat series then a spike — EMA should track the spike more closely
    const values = [10, 10, 10, 10, 10, 100];
    const result = ema(values, 3);
    const last = result[result.length - 1];
    expect(last).toBeGreaterThan(40); // EMA reacts strongly to the 100
  });

  it('converges on constant data', () => {
    const values = Array(20).fill(50);
    const result = ema(values, 5);
    result.forEach((v) => expect(v).toBeCloseTo(50));
  });

  it('applies correct multiplier k = 2/(period+1)', () => {
    // period=2, k=2/3, seed=avg([10,20])=15, next=30*2/3 + 15*1/3 = 20+5 = 25
    const result = ema([10, 20, 30], 2);
    expect(result[0]).toBeCloseTo(15);
    expect(result[1]).toBeCloseTo(25);
  });
});
