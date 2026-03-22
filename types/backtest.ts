export interface BacktestParams {
  strategyId: string;
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  commissionRate: number;
  slippagePct: number;
}

export interface BacktestTrade {
  entryTime: number;
  exitTime: number;
  side: 'buy' | 'sell';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPct: number;
  commission: number;
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
}

export interface BacktestMetrics {
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  totalReturnPct: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  bestTrade: number;
  worstTrade: number;
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
}
