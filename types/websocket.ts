import type { Ticker, OrderBook } from './exchange';
import type { Signal, StrategyStatus } from './strategy';

export interface LiveCandle {
  time: number;   // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

export type WsMessage =
  | { type: 'ticker'; symbol: string; data: Ticker }
  | { type: 'orderbook'; symbol: string; data: OrderBook }
  | { type: 'candle'; exchangeId: string; symbol: string; timeframe: string; candle: LiveCandle }
  | { type: 'strategy'; strategyId: string; status: StrategyStatus; signal?: Signal; error?: string }
  | { type: 'subscribe'; channel: 'ticker' | 'orderbook' | 'candle'; symbol: string; exchangeId: string; timeframe?: string }
  | { type: 'unsubscribe'; channel: 'ticker' | 'orderbook' | 'candle'; symbol: string; timeframe?: string }
  | { type: 'error'; message: string }
  | { type: 'pong' };
