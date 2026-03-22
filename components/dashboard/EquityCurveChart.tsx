'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';

interface EquityPoint {
  timestamp: number;
  equity: number;
}

export function EquityCurveChart({
  data,
  initialCapital,
}: {
  data: EquityPoint[];
  initialCapital: number;
}) {
  const min = Math.min(...data.map((d) => d.equity));
  const max = Math.max(...data.map((d) => d.equity));
  const isProfit = data[data.length - 1]?.equity >= initialCapital;

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={isProfit ? '#10b981' : '#ef4444'}
                stopOpacity={0.2}
              />
              <stop
                offset="95%"
                stopColor={isProfit ? '#10b981' : '#ef4444'}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="timestamp"
            tickFormatter={(v) => format(new Date(v), 'MMM d')}
            tick={{ fill: '#71717a', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            minTickGap={60}
          />
          <YAxis
            domain={[min * 0.99, max * 1.01]}
            tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
            tick={{ fill: '#71717a', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={50}
          />
          <Tooltip
            contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 6 }}
            labelStyle={{ color: '#a1a1aa', fontSize: 11 }}
            itemStyle={{ color: isProfit ? '#10b981' : '#ef4444', fontSize: 12 }}
            labelFormatter={(v) => format(new Date(v), 'MMM d, yyyy')}
            formatter={(v) => [formatCurrency(Number(v)), 'Equity']}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke={isProfit ? '#10b981' : '#ef4444'}
            strokeWidth={1.5}
            fill="url(#equityGrad)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
