import { describe, it, expect } from 'vitest';
import { bollinger } from '../bollinger';

describe('bollinger', () => {
  it('returns empty arrays when data is insufficient', () => {
    const result = bollinger([1, 2, 3], 20);
    expect(result.upper).toEqual([]);
    expect(result.middle).toEqual([]);
    expect(result.lower).toEqual([]);
  });

  it('upper, middle, and lower have the same length', () => {
    const values = Array.from({ length: 30 }, (_, i) => 100 + i);
    const result = bollinger(values, 20);
    expect(result.upper.length).toBe(result.middle.length);
    expect(result.lower.length).toBe(result.middle.length);
  });

  it('middle band equals SMA', () => {
    // For constant data SMA = constant
    const values = Array(25).fill(50);
    const result = bollinger(values, 20);
    result.middle.forEach((v) => expect(v).toBeCloseTo(50));
  });

  it('upper > middle > lower always holds', () => {
    const values = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 5);
    const result = bollinger(values, 20);
    for (let i = 0; i < result.middle.length; i++) {
      expect(result.upper[i]).toBeGreaterThanOrEqual(result.middle[i]);
      expect(result.middle[i]).toBeGreaterThanOrEqual(result.lower[i]);
    }
  });

  it('bands collapse to middle when data is constant (zero std dev)', () => {
    const values = Array(25).fill(100);
    const result = bollinger(values, 20);
    result.upper.forEach((v) => expect(v).toBeCloseTo(100));
    result.lower.forEach((v) => expect(v).toBeCloseTo(100));
  });

  it('wider bands with higher volatility', () => {
    const lowVol = Array.from({ length: 25 }, (_, i) => 100 + (i % 2 === 0 ? 0.1 : -0.1));
    const highVol = Array.from({ length: 25 }, (_, i) => 100 + (i % 2 === 0 ? 10 : -10));

    const lowResult = bollinger(lowVol, 20);
    const highResult = bollinger(highVol, 20);

    const lowWidth = lowResult.upper[0] - lowResult.lower[0];
    const highWidth = highResult.upper[0] - highResult.lower[0];
    expect(highWidth).toBeGreaterThan(lowWidth);
  });

  it('respects stdDevMultiplier', () => {
    const values = Array.from({ length: 25 }, (_, i) => 100 + i);
    const result1 = bollinger(values, 20, 1);
    const result2 = bollinger(values, 20, 2);
    // With multiplier=2, bands should be exactly twice as wide
    const width1 = result1.upper[0] - result1.lower[0];
    const width2 = result2.upper[0] - result2.lower[0];
    expect(width2).toBeCloseTo(width1 * 2, 5);
  });
});
