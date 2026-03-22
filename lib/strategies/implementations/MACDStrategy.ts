import { BaseStrategy } from '../BaseStrategy';
import { macd } from '../indicators/macd';
import type { Signal } from '@/types/strategy';
import type { OHLCVCandle } from '@/types/exchange';

export class MACDStrategy extends BaseStrategy {
  readonly type = 'MACD';
  readonly name = 'MACD Strategy';

  constructor(config: Record<string, unknown>) {
    super(config as never);
    // @ts-ignore
    this.config = config;
    this.warmupPeriod = 50;
  }

  computeSignal(candles: OHLCVCandle[]): Signal {
    const closes = candles.map((c) => c.close);
    const fastPeriod = (this.config as Record<string, unknown>).fastPeriod as number ?? 12;
    const slowPeriod = (this.config as Record<string, unknown>).slowPeriod as number ?? 26;
    const signalPeriod = (this.config as Record<string, unknown>).signalPeriod as number ?? 9;
    const quantity = (this.config as Record<string, unknown>).quantity as number ?? 0.001;

    const result = macd(closes, fastPeriod, slowPeriod, signalPeriod);
    const { histogram } = result;
    if (histogram.length < 2) return { action: 'hold', reason: 'Insufficient MACD data' };

    const curr = histogram[histogram.length - 1];
    const prev = histogram[histogram.length - 2];

    if (prev < 0 && curr > 0) {
      return { action: 'buy', quantity, reason: `MACD histogram crossed positive (${curr.toFixed(4)})` };
    }
    if (prev > 0 && curr < 0) {
      return { action: 'sell', quantity, reason: `MACD histogram crossed negative (${curr.toFixed(4)})` };
    }
    return { action: 'hold', reason: `MACD histogram: ${curr.toFixed(4)}` };
  }
}
