import { BaseStrategy } from '../BaseStrategy';
import { rsi } from '../indicators/rsi';
import type { Signal } from '@/types/strategy';
import type { OHLCVCandle } from '@/types/exchange';

export class RSIStrategy extends BaseStrategy {
  readonly type = 'RSI';
  readonly name = 'RSI Strategy';

  constructor(config: Record<string, unknown>) {
    super(config as never);
    // @ts-ignore
    this.config = config;
    this.warmupPeriod = (config.period as number ?? 14) + 10;
  }

  computeSignal(candles: OHLCVCandle[]): Signal {
    const closes = candles.map((c) => c.close);
    const period = (this.config as Record<string, unknown>).period as number ?? 14;
    const oversold = (this.config as Record<string, unknown>).oversold as number ?? 30;
    const overbought = (this.config as Record<string, unknown>).overbought as number ?? 70;
    const quantity = (this.config as Record<string, unknown>).quantity as number ?? 0.001;

    const rsiValues = rsi(closes, period);
    if (rsiValues.length < 2) return { action: 'hold', reason: 'Insufficient RSI data' };

    const currentRSI = rsiValues[rsiValues.length - 1];
    const prevRSI = rsiValues[rsiValues.length - 2];

    if (prevRSI <= oversold && currentRSI > oversold) {
      return { action: 'buy', quantity, reason: `RSI crossed above oversold (${currentRSI.toFixed(1)})` };
    }
    if (prevRSI >= overbought && currentRSI < overbought) {
      return { action: 'sell', quantity, reason: `RSI crossed below overbought (${currentRSI.toFixed(1)})` };
    }
    return { action: 'hold', reason: `RSI: ${currentRSI.toFixed(1)}` };
  }
}
