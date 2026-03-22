export interface Market {
  symbol: string;
  base: string;
  quote: string;
  active: boolean;
  precision: { amount: number; price: number };
  limits: { amount: { min: number; max: number }; price: { min: number; max: number } };
}

export interface Ticker {
  symbol: string;
  last: number;
  bid: number;
  ask: number;
  high: number;
  low: number;
  volume: number;
  change: number;
  percentage: number;
  timestamp: number;
}

export interface OHLCVCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Balance {
  free: number;
  used: number;
  total: number;
}

export interface BalanceSheet {
  [asset: string]: Balance;
}

export interface OrderBookEntry {
  price: number;
  amount: number;
}

export interface OrderBook {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp: number;
}
