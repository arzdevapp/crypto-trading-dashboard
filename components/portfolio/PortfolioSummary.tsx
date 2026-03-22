'use client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, BarChart2 } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { useStore } from '@/store';

export function PortfolioSummary() {
  const { activeExchangeId } = useStore();

  const { data: analytics } = useQuery({
    queryKey: ['analytics', activeExchangeId],
    queryFn: async () => {
      const res = await fetch(`/api/analytics${activeExchangeId ? `?exchangeId=${activeExchangeId}` : ''}`);
      return res.json();
    },
    enabled: !!activeExchangeId,
  });

  const stats = [
    {
      title: 'Total P&L',
      value: formatCurrency(analytics?.totalPnl ?? 0),
      icon: DollarSign,
      trend: analytics?.totalPnl >= 0 ? 'up' : 'down',
      sub: `${analytics?.totalTrades ?? 0} trades`,
    },
    {
      title: 'Win Rate',
      value: `${(analytics?.winRate ?? 0).toFixed(1)}%`,
      icon: BarChart2,
      trend: analytics?.winRate >= 50 ? 'up' : 'down',
      sub: `${analytics?.winningTrades ?? 0}W / ${analytics?.losingTrades ?? 0}L`,
    },
    {
      title: 'Profit Factor',
      value: (analytics?.profitFactor ?? 0).toFixed(2),
      icon: TrendingUp,
      trend: analytics?.profitFactor >= 1 ? 'up' : 'down',
      sub: analytics?.profitFactor >= 1 ? 'Profitable' : 'Unprofitable',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
            <stat.icon className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{stat.value}</span>
              {stat.trend === 'up'
                ? <TrendingUp className="w-4 h-4 text-green-500" />
                : <TrendingDown className="w-4 h-4 text-red-500" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
