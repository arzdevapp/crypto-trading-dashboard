import { BaseStrategy } from '../BaseStrategy';
import { rsi } from '../indicators/rsi';
import { fetchFearGreed } from '@/lib/sentiment/fearGreed';
import type { Signal } from '@/types/strategy';
import type { OHLCVCandle } from '@/types/exchange';

export class SentimentStrategy extends BaseStrategy {
  readonly type = 'SENTIMENT';
  readonly name = 'Sentiment + RSI';

  constructor(config: Record<string, unknown>) {
    super(config as never);
    // @ts-expect-error generic config assignment
    this.config = config;
    const rsiPeriod = (config.rsiPeriod as number) ?? 14;
    this.warmupPeriod = rsiPeriod + 10;
  }

  // computeSignal is async to allow fetching the Fear & Greed index
  async computeSignal(candles: OHLCVCandle[]): Promise<Signal> {
    const cfg = this.config as Record<string, unknown>;
    const rsiPeriod = (cfg.rsiPeriod as number) ?? 14;
    const fearBuyThreshold = (cfg.fearBuyThreshold as number) ?? 30;
    const extremeFearThreshold = (cfg.extremeFearThreshold as number) ?? 20;
    const greedSellThreshold = (cfg.greedSellThreshold as number) ?? 70;
    const extremeGreedThreshold = (cfg.extremeGreedThreshold as number) ?? 85;
    const quantity = (cfg.quantity as number) ?? 0.001;

    // Fetch current Fear & Greed value (cached server-side for 1 hour)
    const fearGreed = await fetchFearGreed();
    const fg = fearGreed.value;

    // Calculate RSI from candle closes
    const closes = candles.map((c) => c.close);
    const rsiValues = rsi(closes, rsiPeriod);
    const currentRSI = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : 50;

    // === BUY LOGIC ===

    // Deep panic entry: Extreme Fear regardless of RSI
    if (fg < extremeFearThreshold) {
      return {
        action: 'buy',
        quantity,
        reason: `Extreme Fear (F&G: ${fg}) → deep panic entry (RSI: ${currentRSI.toFixed(1)})`,
      };
    }

    // Contrarian buy: Fear zone + oversold RSI
    if (fg < fearBuyThreshold && currentRSI < 40) {
      return {
        action: 'buy',
        quantity,
        reason: `Extreme Fear (F&G: ${fg}) + oversold RSI (${currentRSI.toFixed(1)}) → contrarian buy`,
      };
    }

    // === SELL LOGIC ===

    // Bubble exit: Extreme Greed regardless of RSI
    if (fg > extremeGreedThreshold) {
      return {
        action: 'sell',
        quantity,
        reason: `Extreme Greed (F&G: ${fg}) → bubble exit (RSI: ${currentRSI.toFixed(1)})`,
      };
    }

    // Euphoria exit: Greed zone + overbought RSI
    if (fg > greedSellThreshold && currentRSI > 65) {
      return {
        action: 'sell',
        quantity,
        reason: `Greed (F&G: ${fg}) + elevated RSI (${currentRSI.toFixed(1)}) → euphoria exit`,
      };
    }

    return {
      action: 'hold',
      reason: `F&G: ${fg} (${fearGreed.label}), RSI: ${currentRSI.toFixed(1)}`,
    };
  }
}
