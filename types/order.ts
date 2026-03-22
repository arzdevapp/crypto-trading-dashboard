export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop';
export type OrderStatus = 'open' | 'filled' | 'cancelled' | 'rejected';

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  amount: number;
  price?: number;
  stopPrice?: number;
  status: OrderStatus;
  filled: number;
  remaining: number;
  fee?: { cost: number; currency: string };
  timestamp: number;
}

export interface Position {
  symbol: string;
  side: OrderSide;
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  percentage: number;
  liquidationPrice?: number;
}

export interface PlaceOrderParams {
  symbol: string;
  type: OrderType;
  side: OrderSide;
  amount: number;
  price?: number;
  stopPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
}
