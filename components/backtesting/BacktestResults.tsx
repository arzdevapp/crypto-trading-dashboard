'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPercent } from '@/lib/utils';
import type { BacktestMetrics } from '@/types/backtest';

export function BacktestResults({ metrics }: { metrics: BacktestMetrics }) {
  const stats = [
    { label: 'Total Return', value: formatPercent(metrics.totalReturnPct), positive: metrics.totalReturnPct >= 0 },
    { label: 'Final Capital', value: formatCurrency(metrics.finalCapital), positive: metrics.finalCapital >= metrics.initialCapital },
    { label: 'Total Trades', value: metrics.totalTrades.toString(), positive: metrics.totalTrades > 0 },
    { label: 'Win Rate', value: `${metrics.winRate.toFixed(1)}%`, positive: metrics.winRate >= 50 },
    { label: 'Profit Factor', value: metrics.profitFactor.toFixed(2), positive: metrics.profitFactor >= 1 },
    { label: 'Sharpe Ratio', value: metrics.sharpeRatio.toFixed(2), positive: metrics.sharpeRatio >= 1 },
    { label: 'Max Drawdown', value: `${metrics.maxDrawdownPct.toFixed(1)}%`, positive: metrics.maxDrawdownPct < 10 },
    { label: 'Expectancy', value: formatCurrency(metrics.expectancy), positive: metrics.expectancy >= 0 },
    { label: 'Avg Win', value: formatCurrency(metrics.avgWin), positive: true },
    { label: 'Avg Loss', value: formatCurrency(metrics.avgLoss), positive: false },
    { label: 'Best Trade', value: `${metrics.bestTrade.toFixed(2)}%`, positive: true },
    { label: 'Worst Trade', value: `${metrics.worstTrade.toFixed(2)}%`, positive: false },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Backtest Results</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">{stat.label}</div>
              <div className={`text-sm font-bold mt-0.5 ${stat.positive ? 'text-green-500' : 'text-red-500'}`}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
