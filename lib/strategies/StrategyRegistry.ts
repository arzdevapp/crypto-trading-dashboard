import { BaseStrategy } from './BaseStrategy';
import { MACrossoverStrategy } from './implementations/MACrossoverStrategy';
import { RSIStrategy } from './implementations/RSIStrategy';
import { MACDStrategy } from './implementations/MACDStrategy';
import { BollingerBandsStrategy } from './implementations/BollingerBandsStrategy';
import { GridTradingStrategy } from './implementations/GridTradingStrategy';
import { SentimentStrategy } from './implementations/SentimentStrategy';
import { PowerTraderStrategy } from './implementations/PowerTraderStrategy';
import { DayTraderStrategy } from './implementations/DayTraderStrategy';

type StrategyConstructor = new (config: Record<string, unknown>) => BaseStrategy;

const registry = new Map<string, StrategyConstructor>([
  ['MA_CROSSOVER', MACrossoverStrategy as unknown as StrategyConstructor],
  ['RSI', RSIStrategy as unknown as StrategyConstructor],
  ['MACD', MACDStrategy as unknown as StrategyConstructor],
  ['BOLLINGER', BollingerBandsStrategy as unknown as StrategyConstructor],
  ['GRID', GridTradingStrategy as unknown as StrategyConstructor],
  ['SENTIMENT', SentimentStrategy as unknown as StrategyConstructor],
  ['POWER_TRADER', PowerTraderStrategy as unknown as StrategyConstructor],
  ['DAY_TRADER', DayTraderStrategy as unknown as StrategyConstructor],
]);

export function createStrategy(type: string, config: Record<string, unknown>): BaseStrategy {
  const StrategyClass = registry.get(type);
  if (!StrategyClass) throw new Error(`Unknown strategy type: ${type}`);
  return new StrategyClass(config);
}

export function getStrategyTypes(): string[] {
  return Array.from(registry.keys());
}
