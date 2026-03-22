import { BaseStrategy } from '../BaseStrategy';
import { ema } from '../indicators/ema';
import { sma } from '../indicators/sma';
import type { Signal } from '@/types/strategy';
import type { OHLCVCandle } from '@/types/exchange';

export class MACrossoverStrategy extends BaseStrategy {
  readonly type = 'MA_CROSSOVER';
  readonly name = 'Moving Average Crossover';

  private previousCross: 'above' | 'below' | null = null;

  constructor(config: Record<string, unknown>) {
    super(config as unknown as import('@/types/strategy').StrategyConfig);
    this.warmupPeriod = (config.slowPeriod as number ?? 21) + 5;
  }

  computeSignal(candles: OHLCVCandle[]): Signal {
    const closes = candles.map((c) => c.close);
    const fastPeriod = (this.config as Record<string, unknown>).fastPeriod as number ?? 9;
    const slowPeriod = (this.config as Record<string, unknown>).slowPeriod as number ?? 21;
    const useEMA = (this.config as Record<string, unknown>).useEMA as boolean ?? true;
    const quantity = (this.config as Record<string, unknown>).quantity as number ?? 0.001;

    const maFn = useEMA ? ema : sma;
    const fastValues = maFn(closes, fastPeriod);
    const slowValues = maFn(closes, slowPeriod);

    if (fastValues.length < 2 || slowValues.length < 2) return { action: 'hold', reason: 'Insufficient data' };

    const fastCurrent = fastValues[fastValues.length - 1];
    const slowCurrent = slowValues[slowValues.length - 1];
    const currentCross = fastCurrent > slowCurrent ? 'above' : 'below';

    let signal: Signal;
    if (this.previousCross === 'below' && currentCross === 'above') {
      signal = { action: 'buy', quantity, reason: `Fast MA crossed above Slow MA (${fastCurrent.toFixed(2)} > ${slowCurrent.toFixed(2)})` };
    } else if (this.previousCross === 'above' && currentCross === 'below') {
      signal = { action: 'sell', quantity, reason: `Fast MA crossed below Slow MA (${fastCurrent.toFixed(2)} < ${slowCurrent.toFixed(2)})` };
    } else {
      signal = { action: 'hold', reason: `No crossover (${currentCross})` };
    }

    this.previousCross = currentCross;
    return signal;
  }
}
