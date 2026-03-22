import type { OHLCVCandle } from '@/types/exchange';
import { buildFromOHLCV, predictNextLevels, updateWeights, enforceGapSpacing, type PatternMemory } from './PatternMemory';
import { prisma } from '@/lib/db';

export interface PriceLevels {
  longLevels: number[];     // predicted support zones (buy zones — below current price)
  shortLevels: number[];    // predicted resistance zones (sell zones — above current price)
  longSignalCount: number;  // 0-7: how many long levels price has broken through (buy pressure)
  shortSignalCount: number; // 0-7: how many short levels price has risen through (sell pressure)
  predictedHigh: number;
  predictedLow: number;
}

export interface TimeframeMemory {
  timeframe: string;
  memory: PatternMemory;
  lastCandle?: OHLCVCandle;
  // Stored for online learning: what we predicted for the previous candle
  pendingHigh?: number;
  pendingLow?: number;
  pendingOpenPrice?: number;
}

const VOL_WINDOW = 20;

// Compute volume ratio for current candle relative to recent average
function computeVolumeRatio(candles: OHLCVCandle[], currentIndex: number): number {
  const current = candles[currentIndex];
  if (!current.volume || current.volume === 0) return 1.0;
  const start      = Math.max(0, currentIndex - VOL_WINDOW);
  const recentVols = candles.slice(start, currentIndex).map(c => c.volume).filter(v => v > 0);
  const avgVol     = recentVols.length
    ? recentVols.reduce((a, b) => a + b, 0) / recentVols.length
    : current.volume;
  return avgVol > 0 ? current.volume / avgVol : 1.0;
}

export class InstancePredictor {
  private memories: Map<string, TimeframeMemory> = new Map();
  private symbol: string;

  constructor(symbol: string) {
    this.symbol = symbol;
  }

  // Train on historical candles and persist to DB
  async trainTimeframe(timeframe: string, candles: OHLCVCandle[]): Promise<void> {
    const memory = buildFromOHLCV(candles);
    this.memories.set(timeframe, { timeframe, memory });

    await prisma.modelMemory.upsert({
      where:  { symbol_timeframe: { symbol: this.symbol, timeframe } },
      update: { memoryJson: JSON.stringify(memory), candleCount: candles.length, trainedAt: new Date() },
      create: { symbol: this.symbol, timeframe, memoryJson: JSON.stringify(memory), candleCount: candles.length },
    });
  }

  // Load all saved timeframes for this symbol from DB
  async loadFromDB(): Promise<void> {
    const rows = await prisma.modelMemory.findMany({ where: { symbol: this.symbol } });
    for (const row of rows) {
      try {
        const memory: PatternMemory = JSON.parse(row.memoryJson);
        // Back-fill missing fields for patterns trained with the old 1-feature schema
        for (const p of memory.patterns) {
          if (p.volumeRatio === undefined) p.volumeRatio = 1.0;
          if (p.hlRangePct  === undefined) p.hlRangePct  = 0;
          if (p.bodyPct     === undefined) p.bodyPct     = 0;
        }
        this.memories.set(row.timeframe, { timeframe: row.timeframe, memory });
      } catch {
        console.error(`[InstancePredictor] corrupt JSON for ${this.symbol}/${row.timeframe}, skipping`);
      }
    }
  }

  // Generate price levels from current candle context.
  // BUG FIX: original code pre-filtered levels before counting, which made counts always 0.
  // Correct logic: count levels that price has reached or broken through.
  predict(timeframe: string, candles: OHLCVCandle[], currentPrice: number): PriceLevels {
    const tfMemory = this.memories.get(timeframe);
    if (!tfMemory || !tfMemory.memory.patterns.length) {
      return { longLevels: [], shortLevels: [], longSignalCount: 0, shortSignalCount: 0, predictedHigh: 0, predictedLow: 0 };
    }

    const currentCandle = candles[candles.length - 1];
    if (!currentCandle || currentCandle.open === 0) {
      return { longLevels: [], shortLevels: [], longSignalCount: 0, shortSignalCount: 0, predictedHigh: 0, predictedLow: 0 };
    }

    // Online learning: if we stored a prediction for the previous candle, update weights now
    if (
      tfMemory.pendingHigh !== undefined &&
      tfMemory.pendingLow  !== undefined &&
      tfMemory.lastCandle  !== undefined &&
      tfMemory.pendingOpenPrice !== undefined
    ) {
      const open       = tfMemory.pendingOpenPrice;
      const actualHigh = open > 0 ? ((currentCandle.high - open) / open) * 100 : 0;
      const actualLow  = open > 0 ? ((currentCandle.low  - open) / open) * 100 : 0;
      // Update all patterns that were close to the last candle's features
      const lastPctChange  = tfMemory.lastCandle.open > 0
        ? ((tfMemory.lastCandle.close - tfMemory.lastCandle.open) / tfMemory.lastCandle.open) * 100
        : 0;
      const threshold = tfMemory.memory.perfectThreshold * 4; // use widest threshold for update sweep
      for (let i = 0; i < tfMemory.memory.patterns.length; i++) {
        const pDiff = Math.abs(tfMemory.memory.patterns[i].pctChange - lastPctChange);
        if (pDiff <= threshold) {
          updateWeights(tfMemory.memory, i, actualHigh, actualLow);
        }
      }
    }

    const pctChange  = ((currentCandle.close - currentCandle.open) / currentCandle.open) * 100;
    const hlRangePct = ((currentCandle.high  - currentCandle.low)  / currentCandle.open) * 100;
    const bodyPct    = (Math.abs(currentCandle.close - currentCandle.open) / currentCandle.open) * 100;
    const volumeRatio = computeVolumeRatio(candles, candles.length - 1);

    const { predictedHighPct, predictedLowPct, matchCount } = predictNextLevels(
      tfMemory.memory,
      pctChange,
      volumeRatio,
      hlRangePct,
      bodyPct,
    );

    if (!matchCount) {
      return { longLevels: [], shortLevels: [], longSignalCount: 0, shortSignalCount: 0, predictedHigh: 0, predictedLow: 0 };
    }

    const predictedHigh = currentCandle.open * (1 + predictedHighPct / 100);
    const predictedLow  = currentCandle.open * (1 + predictedLowPct  / 100);

    // Generate 7 interpolated levels between open and predicted extremes
    const rawLongLevels:  number[] = [];
    const rawShortLevels: number[] = [];
    for (let i = 1; i <= 7; i++) {
      rawLongLevels.push( currentCandle.open * (1 + (predictedLowPct  * i / 7) / 100));
      rawShortLevels.push(currentCandle.open * (1 + (predictedHighPct * i / 7) / 100));
    }

    const longLevels  = enforceGapSpacing(rawLongLevels);
    const shortLevels = enforceGapSpacing(rawShortLevels);

    // FIX: count levels the current price has broken through (reached or passed).
    // Long: price has dropped to/through support level → currentPrice <= level (within 0.1% buffer)
    // Short: price has risen to/through resistance level → currentPrice >= level (within 0.1% buffer)
    const longSignalCount  = longLevels.filter( l => currentPrice <= l * 1.001).length;
    const shortSignalCount = shortLevels.filter(s => currentPrice * 1.001 >= s).length;

    // Store prediction for online learning on next candle
    tfMemory.lastCandle       = currentCandle;
    tfMemory.pendingHigh      = predictedHighPct;
    tfMemory.pendingLow       = predictedLowPct;
    tfMemory.pendingOpenPrice = currentCandle.open;

    return { longLevels, shortLevels, longSignalCount, shortSignalCount, predictedHigh, predictedLow };
  }

  // Aggregate signals across all trained timeframes
  aggregateSignals(candles: OHLCVCandle[], currentPrice: number): {
    aggregatedLongLevels:  number[];
    aggregatedShortLevels: number[];
    maxLongSignal:  number;
    maxShortSignal: number;
  } {
    const allLong:  number[] = [];
    const allShort: number[] = [];
    let maxLongSignal  = 0;
    let maxShortSignal = 0;

    for (const [tf] of this.memories) {
      if (!candles.length) continue;
      const result = this.predict(tf, candles, currentPrice);
      allLong.push( ...result.longLevels);
      allShort.push(...result.shortLevels);
      if (result.longSignalCount  > maxLongSignal)  maxLongSignal  = result.longSignalCount;
      if (result.shortSignalCount > maxShortSignal) maxShortSignal = result.shortSignalCount;
    }

    return {
      aggregatedLongLevels:  enforceGapSpacing(allLong),
      aggregatedShortLevels: enforceGapSpacing(allShort),
      maxLongSignal,
      maxShortSignal,
    };
  }

  isTrainedFor(timeframe: string): boolean {
    return this.memories.has(timeframe) && (this.memories.get(timeframe)!.memory.patterns.length > 0);
  }

  getTrainedTimeframes(): string[] {
    return Array.from(this.memories.keys());
  }

  getSymbol(): string {
    return this.symbol;
  }
}

// Global in-memory cache — populated from DB on first access
const predictorCache = new Map<string, InstancePredictor>();

export async function getPredictor(symbol: string): Promise<InstancePredictor> {
  if (!predictorCache.has(symbol)) {
    const predictor = new InstancePredictor(symbol);
    await predictor.loadFromDB();
    predictorCache.set(symbol, predictor);
  }
  return predictorCache.get(symbol)!;
}
