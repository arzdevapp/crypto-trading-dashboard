export interface PerformanceMetrics {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  totalPnlPct: number;
  sharpeRatio: number;
  maxDrawdown: number;
  profitFactor: number;
  avgTradeReturn: number;
  bestTrade: number;
  worstTrade: number;
}

export interface DailyPnL {
  date: string;
  pnl: number;
  trades: number;
}

export interface TradeRecord {
  id: string;
  symbol: string;
  side: string;
  type: string;
  quantity: number;
  price: number;
  fee: number;
  pnl: number | null;
  orderId: string;
  status: string;
  openedAt: Date;
  closedAt: Date | null;
  strategyId: string | null;
  exchangeId: string;
}
