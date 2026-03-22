export type StrategyStatus = 'running' | 'stopped' | 'error';

export interface StrategyConfig {
  symbol: string;
  timeframe: string;
  exchangeId: string;
  quantity: number;
  stopLossPct?: number;
  takeProfitPct?: number;
  [key: string]: unknown;
}

export interface Signal {
  action: 'buy' | 'sell' | 'hold';
  quantity?: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  reason: string;
}

export interface StrategyRecord {
  id: string;
  name: string;
  type: string;
  symbol: string;
  timeframe: string;
  config: string;
  status: StrategyStatus;
  exchangeId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StrategyStats {
  totalTrades: number;
  profitableTrades: number;
  totalPnl: number;
  winRate: number;
}
