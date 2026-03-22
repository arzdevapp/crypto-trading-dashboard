import type { Signal, StrategyConfig } from '@/types/strategy';
import type { OHLCVCandle } from '@/types/exchange';

export abstract class BaseStrategy {
  abstract readonly type: string;
  abstract readonly name: string;

  protected config: StrategyConfig;
  protected candles: OHLCVCandle[] = [];
  protected warmupPeriod: number = 50;

  constructor(config: StrategyConfig) {
    this.config = config;
  }

  abstract computeSignal(candles: OHLCVCandle[]): Signal | Promise<Signal>;

  async initialize(fetchCandles: (limit: number) => Promise<OHLCVCandle[]>): Promise<void> {
    this.candles = await fetchCandles(this.warmupPeriod + 10);
  }

  async onCandle(candle: OHLCVCandle): Promise<Signal> {
    this.candles.push(candle);
    if (this.candles.length > 500) this.candles.shift();
    if (this.candles.length < this.warmupPeriod) {
      return { action: 'hold', reason: 'Warming up' };
    }
    return this.computeSignal(this.candles);
  }

  getConfig(): StrategyConfig {
    return this.config;
  }
}
