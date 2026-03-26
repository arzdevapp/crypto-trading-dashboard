import { BaseStrategy } from '../BaseStrategy';
import type { Signal } from '@/types/strategy';
import type { OHLCVCandle } from '@/types/exchange';

export interface GridState {
  gridLevels: number[];
  activeBuyLevels: number[]; // levels where we have open buy positions
}

export class GridTradingStrategy extends BaseStrategy {
  readonly type = 'GRID';
  readonly name = 'Grid Trading';

  private gridLevels: number[] = [];
  private activeBuyLevels: Set<number> = new Set();

  constructor(config: Record<string, unknown>) {
    super(config as never);
    // @ts-expect-error generic config assignment
    this.config = config;
    this.warmupPeriod = 5;
  }

  private buildGrid(lower: number, upper: number, levels: number): number[] {
    if (lower >= upper || levels < 2) return [];
    const step = (upper - lower) / (levels - 1);
    return Array.from({ length: levels }, (_, i) => lower + i * step);
  }

  computeSignal(candles: OHLCVCandle[]): Signal {
    const cfg = this.config as Record<string, unknown>;
    const lowerPrice = cfg.lowerPrice as number;
    const upperPrice = cfg.upperPrice as number;
    const gridLevels = cfg.gridLevels as number ?? 10;
    const quantity = cfg.quantity as number ?? 0.001;

    if (!lowerPrice || !upperPrice || lowerPrice >= upperPrice) {
      return { action: 'hold', reason: 'Grid not configured (need valid lowerPrice < upperPrice)' };
    }

    if (!this.gridLevels.length) {
      this.gridLevels = this.buildGrid(lowerPrice, upperPrice, gridLevels);
    }

    const price = candles[candles.length - 1].close;
    const prevPrice = candles[candles.length - 2]?.close ?? price;

    // Check buy levels: price crossed down through a grid level that has no active position
    for (const level of this.gridLevels) {
      if (prevPrice > level && price <= level && price > lowerPrice) {
        if (!this.activeBuyLevels.has(level)) {
          this.activeBuyLevels.add(level);
          return { action: 'buy', quantity, price: level, reason: `Grid buy at level ${level.toFixed(2)} (${this.activeBuyLevels.size} active)` };
        }
      }
    }

    // Check sell levels: price crossed up through a grid level that has an active buy below it
    for (const level of this.gridLevels) {
      if (prevPrice < level && price >= level && price < upperPrice) {
        // Find the nearest active buy level below this sell level
        const matchingBuy = this.findNearestBuyBelow(level);
        if (matchingBuy !== null) {
          this.activeBuyLevels.delete(matchingBuy);
          return { action: 'sell', quantity, price: level, reason: `Grid sell at ${level.toFixed(2)} (bought at ${matchingBuy.toFixed(2)}, ${this.activeBuyLevels.size} remaining)` };
        }
      }
    }

    return { action: 'hold', reason: `Price ${price.toFixed(2)} between grid levels (${this.activeBuyLevels.size} active positions)` };
  }

  private findNearestBuyBelow(sellLevel: number): number | null {
    let nearest: number | null = null;
    for (const buyLevel of this.activeBuyLevels) {
      if (buyLevel < sellLevel) {
        if (nearest === null || buyLevel > nearest) {
          nearest = buyLevel;
        }
      }
    }
    return nearest;
  }

  getState(): GridState {
    return {
      gridLevels: [...this.gridLevels],
      activeBuyLevels: [...this.activeBuyLevels],
    };
  }

  restoreState(state: Record<string, unknown>): void {
    const s = state as unknown as GridState;
    if (Array.isArray(s.gridLevels)) {
      this.gridLevels = s.gridLevels;
    }
    if (Array.isArray(s.activeBuyLevels)) {
      this.activeBuyLevels = new Set(s.activeBuyLevels);
    }
  }
}
