import type { Ticker, OrderBook } from './exchange';
import type { Signal, StrategyStatus } from './strategy';

export type WsMessage =
  | { type: 'ticker'; symbol: string; data: Ticker }
  | { type: 'orderbook'; symbol: string; data: OrderBook }
  | { type: 'strategy'; strategyId: string; status: StrategyStatus; signal?: Signal; error?: string }
  | { type: 'subscribe'; channel: 'ticker' | 'orderbook'; symbol: string; exchangeId: string }
  | { type: 'unsubscribe'; channel: 'ticker' | 'orderbook'; symbol: string }
  | { type: 'error'; message: string }
  | { type: 'pong' };
