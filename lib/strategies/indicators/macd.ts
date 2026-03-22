import { ema } from './ema';

export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export function macd(values: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): MACDResult {
  const fastEMA = ema(values, fastPeriod);
  const slowEMA = ema(values, slowPeriod);

  const offset = slowPeriod - fastPeriod;
  const macdLine = slowEMA.map((v, i) => fastEMA[i + offset] - v);

  const signalLine = ema(macdLine, signalPeriod);
  const sigOffset = macdLine.length - signalLine.length;

  const histogram = signalLine.map((v, i) => macdLine[i + sigOffset] - v);

  return { macd: macdLine, signal: signalLine, histogram };
}
