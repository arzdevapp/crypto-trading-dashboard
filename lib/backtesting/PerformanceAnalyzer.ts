import type { BacktestTrade, EquityPoint, BacktestMetrics } from '@/types/backtest';

export class PerformanceAnalyzer {
  static compute(
    trades: BacktestTrade[],
    equityCurve: { timestamp: number; equity: number }[],
    initialCapital: number
  ): BacktestMetrics {
    const finalCapital = equityCurve[equityCurve.length - 1]?.equity ?? initialCapital;
    const totalReturn = finalCapital - initialCapital;
    const totalReturnPct = (totalReturn / initialCapital) * 100;

    const winningTrades = trades.filter((t) => t.pnl > 0);
    const losingTrades = trades.filter((t) => t.pnl <= 0);
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;
    const expectancy = winRate / 100 * avgWin - (1 - winRate / 100) * avgLoss;

    // Sharpe ratio (simplified, annualized assuming daily returns)
    const returns = equityCurve.slice(1).map((p, i) => {
      const prev = equityCurve[i].equity;
      return prev > 0 ? (p.equity - prev) / prev : 0;
    });
    const avgReturn = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
    const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length || 1));
    const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

    // Max drawdown
    let peak = initialCapital;
    let maxDrawdown = 0;
    let maxDrawdownPct = 0;
    for (const point of equityCurve) {
      if (point.equity > peak) peak = point.equity;
      const dd = peak - point.equity;
      const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
      if (dd > maxDrawdown) { maxDrawdown = dd; maxDrawdownPct = ddPct; }
    }

    const bestTrade = Math.max(...trades.map((t) => t.pnlPct), 0);
    const worstTrade = Math.min(...trades.map((t) => t.pnlPct), 0);

    return {
      initialCapital,
      finalCapital,
      totalReturn,
      totalReturnPct,
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      profitFactor,
      sharpeRatio,
      maxDrawdown,
      maxDrawdownPct,
      avgWin,
      avgLoss,
      expectancy,
      bestTrade,
      worstTrade,
      trades,
      equityCurve: equityCurve as EquityPoint[],
    };
  }
}
