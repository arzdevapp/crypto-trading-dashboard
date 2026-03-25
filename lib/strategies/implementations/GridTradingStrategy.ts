import { BaseStrategy } from '../BaseStrategy';
import type { Signal } from '@/types/strategy';
import type { OHLCVCandle } from '@/types/exchange';

export class GridTradingStrategy extends BaseStrategy {
  readonly type = 'GRID';
  readonly name = 'Grid Trading';

  private gridLevels: number[] = [];
  private lastBuyLevel: number | null = null;

  constructor(config: Record<string, unknown>) {
    super(config as never);
    // @ts-expect-error generic config assignment
    this.config = config;
    this.warmupPeriod = 5;
  }

  private buildGrid(lower: number, upper: number, levels: number): number[] {
    const step = (upper - lower) / (levels - 1);
    return Array.from({ length: levels }, (_, i) => lower + i * step);
  }

  computeSignal(candles: OHLCVCandle[]): Signal {
    const cfg = this.config as Record<string, unknown>;
    const lowerPrice = cfg.lowerPrice as number;
    const upperPrice = cfg.upperPrice as number;
    const gridLevels = cfg.gridLevels as number ?? 10;
    const quantity = cfg.quantity as number ?? 0.001;

    if (!lowerPrice || !upperPrice) return { action: 'hold', reason: 'Grid not configured' };

    if (!this.gridLevels.length) {
      this.gridLevels = this.buildGrid(lowerPrice, upperPrice, gridLevels);
    }

    const price = candles[candles.length - 1].close;
    const prevPrice = candles[candles.length - 2]?.close ?? price;

    for (const level of this.gridLevels) {
      if (prevPrice > level && price <= level && price > lowerPrice) {
        this.lastBuyLevel = level;
        return { action: 'buy', quantity, price: level, reason: `Grid buy at level ${level.toFixed(2)}` };
      }
      if (this.lastBuyLevel !== null && prevPrice < level && price >= level && price < upperPrice) {
        this.lastBuyLevel = null; // reset so we don't sell again without a new buy
        return { action: 'sell', quantity, price: level, reason: `Grid sell at level ${level.toFixed(2)}` };
      }
    }
    return { action: 'hold', reason: `Price ${price.toFixed(2)} between grid levels` };
  }
}
