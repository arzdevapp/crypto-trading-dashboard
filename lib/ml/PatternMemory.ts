export interface PatternEntry {
  pctChange: number;       // current candle % change (open-to-close)
  nextHighPct: number;     // next candle high % move from open
  nextLowPct: number;      // next candle low % move from open
}

export interface PatternMemory {
  patterns: PatternEntry[];
  weights: number[];         // direction accuracy weights
  weightsHigh: number[];     // high prediction weights
  weightsLow: number[];      // low prediction weights
  perfectThreshold: number;  // similarity threshold for matching (starts 1.0%)
}

export function createPatternMemory(): PatternMemory {
  return {
    patterns: [],
    weights: [],
    weightsHigh: [],
    weightsLow: [],
    perfectThreshold: 1.0,
  };
}

export function addPattern(
  memory: PatternMemory,
  pctChange: number,
  nextHighPct: number,
  nextLowPct: number
): void {
  memory.patterns.push({ pctChange, nextHighPct, nextLowPct });
  memory.weights.push(1.0);
  memory.weightsHigh.push(1.0);
  memory.weightsLow.push(1.0);
}

export function buildFromOHLCV(
  candles: { open: number; high: number; low: number; close: number }[]
): PatternMemory {
  const memory = createPatternMemory();
  for (let i = 0; i < candles.length - 1; i++) {
    const c = candles[i];
    const next = candles[i + 1];
    if (c.open === 0) continue;

    const pctChange = ((c.close - c.open) / c.open) * 100;
    const nextHighPct = ((next.high - next.open) / next.open) * 100;
    const nextLowPct = ((next.low - next.open) / next.open) * 100;

    addPattern(memory, pctChange, nextHighPct, nextLowPct);
  }
  return memory;
}

export function predictNextLevels(
  memory: PatternMemory,
  currentPctChange: number
): { predictedHighPct: number; predictedLowPct: number; matchCount: number } {
  if (!memory.patterns.length) {
    return { predictedHighPct: 0, predictedLowPct: 0, matchCount: 0 };
  }

  const moves: number[] = [];
  const highMoves: number[] = [];
  const lowMoves: number[] = [];

  for (let i = 0; i < memory.patterns.length; i++) {
    const p = memory.patterns[i];
    // Absolute % difference: "moved by ~X%" matching, not relative ratio.
    // Relative comparison (old code) made a 0.5% candle only match 0.495-0.505%
    // candles — almost never finding any patterns. Absolute threshold=1.0 means
    // "any candle within 1% of the current move is a similar candle."
    const difference = Math.abs(currentPctChange - p.pctChange);

    if (difference <= memory.perfectThreshold) {
      moves.push(p.pctChange * memory.weights[i]);
      highMoves.push(p.nextHighPct * memory.weightsHigh[i]);
      lowMoves.push(p.nextLowPct * memory.weightsLow[i]);
    }
  }

  if (!moves.length) {
    return { predictedHighPct: 0, predictedLowPct: 0, matchCount: 0 };
  }

  const predictedHighPct = highMoves.reduce((a, b) => a + b, 0) / highMoves.length;
  const predictedLowPct = lowMoves.reduce((a, b) => a + b, 0) / lowMoves.length;

  return { predictedHighPct, predictedLowPct, matchCount: moves.length };
}

export function updateWeights(
  memory: PatternMemory,
  patternIndex: number,
  actualHighPct: number,
  actualLowPct: number
): void {
  const p = memory.patterns[patternIndex];
  if (!p) return;

  const highError = Math.abs(actualHighPct - p.nextHighPct);
  const lowError = Math.abs(actualLowPct - p.nextLowPct);

  // Reward accurate predictions, penalize inaccurate ones
  memory.weightsHigh[patternIndex] = Math.max(0.1, memory.weightsHigh[patternIndex] - highError * 0.01);
  memory.weightsLow[patternIndex] = Math.max(0.1, memory.weightsLow[patternIndex] - lowError * 0.01);
}

// Enforce minimum spacing between price levels (gap enforcement pass)
export function enforceGapSpacing(prices: number[], minGapPct = 0.25): number[] {
  if (!prices.length) return [];
  const sorted = [...prices].sort((a, b) => a - b);
  const result: number[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = result[result.length - 1];
    const gapMultiplier = 1 + result.length * 0.25;
    const requiredGap = prev * ((minGapPct * gapMultiplier) / 100);
    if (sorted[i] - prev >= requiredGap) {
      result.push(sorted[i]);
    }
  }
  return result;
}
