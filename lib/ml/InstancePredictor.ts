import type { OHLCVCandle } from '@/types/exchange';
import { buildFromOHLCV, predictNextLevels, enforceGapSpacing, type PatternMemory } from './PatternMemory';
import { prisma } from '@/lib/db';

export interface PriceLevels {
  longLevels: number[];   // predicted lows (blue lines — buy zones)
  shortLevels: number[];  // predicted highs (orange lines — sell zones)
  longSignalCount: number;  // 0-7: how many long levels price is below
  shortSignalCount: number; // 0-7: how many short levels price is above
  predictedHigh: number;
  predictedLow: number;
}

export interface TimeframeMemory {
  timeframe: string;
  memory: PatternMemory;
  lastCandle?: OHLCVCandle;
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
      where: { symbol_timeframe: { symbol: this.symbol, timeframe } },
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
        this.memories.set(row.timeframe, { timeframe: row.timeframe, memory });
      } catch {
        console.error(`[InstancePredictor] corrupt JSON for ${this.symbol}/${row.timeframe}, skipping`);
      }
    }
  }

  // Generate price levels from current candle % change
  predict(timeframe: string, currentCandle: OHLCVCandle, currentPrice: number): PriceLevels {
    const tfMemory = this.memories.get(timeframe);
    if (!tfMemory || !tfMemory.memory.patterns.length) {
      return { longLevels: [], shortLevels: [], longSignalCount: 0, shortSignalCount: 0, predictedHigh: 0, predictedLow: 0 };
    }

    const pctChange = currentCandle.open > 0
      ? ((currentCandle.close - currentCandle.open) / currentCandle.open) * 100
      : 0;

    const { predictedHighPct, predictedLowPct, matchCount } = predictNextLevels(
      tfMemory.memory,
      pctChange
    );

    if (!matchCount) {
      return { longLevels: [], shortLevels: [], longSignalCount: 0, shortSignalCount: 0, predictedHigh: 0, predictedLow: 0 };
    }

    const predictedHigh = currentCandle.open * (1 + predictedHighPct / 100);
    const predictedLow = currentCandle.open * (1 + predictedLowPct / 100);

    const rawLongLevels: number[] = [];
    const rawShortLevels: number[] = [];

    for (let i = 1; i <= 7; i++) {
      rawLongLevels.push(currentCandle.open * (1 + (predictedLowPct * i / 7) / 100));
      rawShortLevels.push(currentCandle.open * (1 + (predictedHighPct * i / 7) / 100));
    }

    const longLevels = enforceGapSpacing(rawLongLevels.filter(p => p < currentPrice));
    const shortLevels = enforceGapSpacing(rawShortLevels.filter(p => p > currentPrice));

    const longSignalCount = longLevels.filter(l => currentPrice <= l * 1.001).length;
    const shortSignalCount = shortLevels.filter(s => currentPrice >= s * 0.999).length;

    return { longLevels, shortLevels, longSignalCount, shortSignalCount, predictedHigh, predictedLow };
  }

  // Aggregate signals across all trained timeframes
  aggregateSignals(candles: OHLCVCandle[], currentPrice: number): {
    aggregatedLongLevels: number[];
    aggregatedShortLevels: number[];
    maxLongSignal: number;
    maxShortSignal: number;
  } {
    const allLong: number[] = [];
    const allShort: number[] = [];
    let maxLongSignal = 0;
    let maxShortSignal = 0;

    for (const [tf, { memory }] of this.memories) {
      if (!candles.length) continue;
      const latest = candles[candles.length - 1];
      const result = this.predict(tf, latest, currentPrice);
      allLong.push(...result.longLevels);
      allShort.push(...result.shortLevels);
      if (result.longSignalCount > maxLongSignal) maxLongSignal = result.longSignalCount;
      if (result.shortSignalCount > maxShortSignal) maxShortSignal = result.shortSignalCount;
    }

    return {
      aggregatedLongLevels: enforceGapSpacing(allLong),
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
// Max 20 symbols to prevent memory leaks in long-running servers
const MAX_CACHE_SIZE = 20;
const predictorCache = new Map<string, InstancePredictor>();
const accessOrder: string[] = [];

export async function getPredictor(symbol: string): Promise<InstancePredictor> {
  if (predictorCache.has(symbol)) {
    // Move to end (most recently used)
    const idx = accessOrder.indexOf(symbol);
    if (idx > -1) accessOrder.splice(idx, 1);
    accessOrder.push(symbol);
    return predictorCache.get(symbol)!;
  }

  // Evict oldest if at capacity
  if (predictorCache.size >= MAX_CACHE_SIZE) {
    const oldest = accessOrder.shift();
    if (oldest) {
      predictorCache.delete(oldest);
    }
  }

  const predictor = new InstancePredictor(symbol);
  await predictor.loadFromDB();
  predictorCache.set(symbol, predictor);
  accessOrder.push(symbol);
  return predictor;
}
