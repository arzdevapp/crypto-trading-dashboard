'use client';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/store';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';

export function EquityCurveChart() {
  const { activeExchangeId } = useStore();

  const { data: trades = [] } = useQuery({
    queryKey: ['trades-equity', activeExchangeId],
    queryFn: async () => {
      const url = `/api/trades?limit=200${activeExchangeId ? `&exchangeId=${activeExchangeId}` : ''}`;
      const res = await fetch(url);
      const d = await res.json();
      return d.trades ?? [];
    },
    enabled: !!activeExchangeId,
  });

  // Build cumulative equity curve from trade P&L
  interface Trade {
    openedAt: string;
    pnl: number | null;
  }
  const equityData = useMemo(() => {
    let running = 0;
    return [...trades]
      .reverse()
      .filter((t: Trade) => t.pnl !== null)
      .map((t: Trade) => {
        // eslint-disable-next-line react-hooks/immutability
        running += t.pnl ?? 0;
        return {
          date: format(new Date(t.openedAt), 'MM/dd'),
          equity: running,
          timestamp: t.openedAt,
        };
      });
  }, [trades]);

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-1 pt-2 px-3 flex-shrink-0">
        <CardTitle className="text-xs">Cumulative P&L</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-1">
        {equityData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            No trade data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={equityData} margin={{ top: 2, right: 8, bottom: 2, left: 32 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#a1a1aa' }} />
              <YAxis
                tick={{ fontSize: 9, fill: '#a1a1aa' }}
                tickFormatter={(v) => `$${v.toFixed(0)}`}
              />
              <Tooltip
                contentStyle={{ background: '#0E1626', border: '1px solid #243044', borderRadius: 6 }}
                labelStyle={{ color: '#a1a1aa', fontSize: 11 }}
                formatter={(v) => [formatCurrency(Number(v ?? 0)), 'Cumulative P&L']}
              />
              <Line
                type="monotone"
                dataKey="equity"
                stroke={equityData[equityData.length - 1]?.equity >= 0 ? '#22c55e' : '#ef4444'}
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
