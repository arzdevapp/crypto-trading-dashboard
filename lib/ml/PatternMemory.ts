export interface PatternEntry {
  pctChange: number;       // current candle % change (open-to-close)
  nextHighPct: number;     // next candle high % move from open
  nextLowPct: number;      // next candle low % move from open
  volumeRatio: number;     // volume / 20-candle avg (1.0 = average volume)
  hlRangePct: number;      // (high-low)/open * 100 — candle volatility
  bodyPct: number;         // |close-open|/open * 100 — candle body size
}

export interface PatternMemory {
  patterns: PatternEntry[];
  weights: number[];         // direction accuracy weights
  weightsHigh: number[];     // high prediction weights
  weightsLow: number[];      // low prediction weights
  perfectThreshold: number;  // base similarity threshold (adaptive)
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
  nextLowPct: number,
  volumeRatio = 1.0,
  hlRangePct = 0,
  bodyPct = 0,
): void {
  memory.patterns.push({ pctChange, nextHighPct, nextLowPct, volumeRatio, hlRangePct, bodyPct });
  memory.weights.push(1.0);
  memory.weightsHigh.push(1.0);
  memory.weightsLow.push(1.0);
}

// Weighted Euclidean distance across all features.
// pctChange is primary (weight 1.0); volume/range/body are secondary signals.
function featureDistance(
  p: PatternEntry,
  pctChange: number,
  volumeRatio: number,
  hlRangePct: number,
  bodyPct: number,
): number {
  const dPct  = (pctChange   - p.pctChange)             * 1.0;
  const dVol  = (volumeRatio - (p.volumeRatio ?? 1.0))  * 0.5;
  const dRange = (hlRangePct  - (p.hlRangePct  ?? 0))   * 0.4;
  const dBody  = (bodyPct     - (p.bodyPct     ?? 0))   * 0.3;
  return Math.sqrt(dPct * dPct + dVol * dVol + dRange * dRange + dBody * dBody);
}

export function buildFromOHLCV(
  candles: { open: number; high: number; low: number; close: number; volume?: number }[]
): PatternMemory {
  const memory = createPatternMemory();
  const VOL_WINDOW = 20;

  for (let i = 0; i < candles.length - 1; i++) {
    const c    = candles[i];
    const next = candles[i + 1];
    if (c.open === 0) continue;

    const pctChange  = ((c.close - c.open) / c.open) * 100;
    const nextHighPct = ((next.high - next.open) / next.open) * 100;
    const nextLowPct  = ((next.low  - next.open) / next.open) * 100;
    const hlRangePct  = ((c.high - c.low) / c.open) * 100;
    const bodyPct     = (Math.abs(c.close - c.open) / c.open) * 100;

    let volumeRatio = 1.0;
    if (c.volume !== undefined && c.volume > 0) {
      const start      = Math.max(0, i - VOL_WINDOW);
      const recentVols = candles.slice(start, i).map(x => x.volume ?? 0).filter(v => v > 0);
      const avgVol     = recentVols.length
        ? recentVols.reduce((a, b) => a + b, 0) / recentVols.length
        : c.volume;
      volumeRatio = avgVol > 0 ? c.volume / avgVol : 1.0;
    }

    addPattern(memory, pctChange, nextHighPct, nextLowPct, volumeRatio, hlRangePct, bodyPct);
  }
  return memory;
}

// Minimum 3 matches required. Threshold widens up to 4× if needed (prevents dead zones).
export function predictNextLevels(
  memory: PatternMemory,
  currentPctChange: number,
  volumeRatio = 1.0,
  hlRangePct = 0,
  bodyPct = 0,
): { predictedHighPct: number; predictedLowPct: number; matchCount: number } {
  if (!memory.patterns.length) {
    return { predictedHighPct: 0, predictedLowPct: 0, matchCount: 0 };
  }

  for (const multiplier of [1, 2, 4]) {
    const threshold = memory.perfectThreshold * multiplier;
    const highMoves: number[] = [];
    const lowMoves:  number[] = [];

    for (let i = 0; i < memory.patterns.length; i++) {
      const p    = memory.patterns[i];
      const dist = featureDistance(p, currentPctChange, volumeRatio, hlRangePct, bodyPct);
      if (dist <= threshold) {
        highMoves.push(p.nextHighPct * memory.weightsHigh[i]);
        lowMoves.push( p.nextLowPct  * memory.weightsLow[i]);
      }
    }

    if (highMoves.length >= 3) {
      const predictedHighPct = highMoves.reduce((a, b) => a + b, 0) / highMoves.length;
      const predictedLowPct  = lowMoves.reduce( (a, b) => a + b, 0) / lowMoves.length;
      return { predictedHighPct, predictedLowPct, matchCount: highMoves.length };
    }
  }

  return { predictedHighPct: 0, predictedLowPct: 0, matchCount: 0 };
}

// Bidirectional weight update: reward accurate predictions, penalize inaccurate ones.
// Original only penalized — this allows patterns to gain influence over time.
export function updateWeights(
  memory: PatternMemory,
  patternIndex: number,
  actualHighPct: number,
  actualLowPct: number,
): void {
  const p = memory.patterns[patternIndex];
  if (!p) return;

  const highError = Math.abs(actualHighPct - p.nextHighPct);
  const lowError  = Math.abs(actualLowPct  - p.nextLowPct);

  // <0.5% error: reward | 0.5–1.5%: neutral | >1.5%: penalize
  const highAdjust = highError < 0.5 ? 1.1 : highError < 1.5 ? 1.0 : 0.9;
  const lowAdjust  = lowError  < 0.5 ? 1.1 : lowError  < 1.5 ? 1.0 : 0.9;

  memory.weightsHigh[patternIndex] = Math.min(2.0, Math.max(0.1, memory.weightsHigh[patternIndex] * highAdjust));
  memory.weightsLow[patternIndex]  = Math.min(2.0, Math.max(0.1, memory.weightsLow[patternIndex]  * lowAdjust));
}

// Enforce minimum spacing between price levels (gap enforcement pass)
export function enforceGapSpacing(prices: number[], minGapPct = 0.25): number[] {
  if (!prices.length) return [];
  const sorted = [...prices].sort((a, b) => a - b);
  const result: number[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev          = result[result.length - 1];
    const gapMultiplier = 1 + result.length * 0.25;
    const requiredGap   = prev * ((minGapPct * gapMultiplier) / 100);
    if (sorted[i] - prev >= requiredGap) {
      result.push(sorted[i]);
    }
  }
  return result;
}
