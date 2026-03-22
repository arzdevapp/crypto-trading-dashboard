import { BaseStrategy } from '../BaseStrategy';
import { bollinger } from '../indicators/bollinger';
import type { Signal } from '@/types/strategy';
import type { OHLCVCandle } from '@/types/exchange';

export class BollingerBandsStrategy extends BaseStrategy {
  readonly type = 'BOLLINGER';
  readonly name = 'Bollinger Bands Strategy';

  constructor(config: Record<string, unknown>) {
    super(config as never);
    // @ts-ignore
    this.config = config;
    this.warmupPeriod = (config.period as number ?? 20) + 5;
  }

  computeSignal(candles: OHLCVCandle[]): Signal {
    const closes = candles.map((c) => c.close);
    const period = (this.config as Record<string, unknown>).period as number ?? 20;
    const stdDev = (this.config as Record<string, unknown>).stdDev as number ?? 2;
    const quantity = (this.config as Record<string, unknown>).quantity as number ?? 0.001;

    const bands = bollinger(closes, period, stdDev);
    if (!bands.upper.length) return { action: 'hold', reason: 'Insufficient data' };

    const price = closes[closes.length - 1];
    const prevPrice = closes[closes.length - 2];
    const upper = bands.upper[bands.upper.length - 1];
    const lower = bands.lower[bands.lower.length - 1];
    const prevUpper = bands.upper[bands.upper.length - 2] ?? upper;
    const prevLower = bands.lower[bands.lower.length - 2] ?? lower;

    if (prevPrice <= prevLower && price > lower) {
      return { action: 'buy', quantity, reason: `Price bounced off lower band (${lower.toFixed(2)})` };
    }
    if (prevPrice >= prevUpper && price < upper) {
      return { action: 'sell', quantity, reason: `Price rejected from upper band (${upper.toFixed(2)})` };
    }
    return { action: 'hold', reason: `Price: ${price.toFixed(2)}, Bands: ${lower.toFixed(2)}-${upper.toFixed(2)}` };
  }
}
