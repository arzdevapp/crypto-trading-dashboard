'use client';
import { useQuery } from '@tanstack/react-query';
import { useBalance } from '@/hooks/usePortfolio';
import { useStore } from '@/store';
import { formatCurrency } from '@/lib/utils';
import { Activity } from 'lucide-react';

export function AccountMetrics() {
  const { activeExchangeId } = useStore();
  const { data: balance } = useBalance(activeExchangeId);

  const { data: analytics } = useQuery({
    queryKey: ['analytics', activeExchangeId],
    queryFn: async () => {
      const res = await fetch(`/api/analytics${activeExchangeId ? `?exchangeId=${activeExchangeId}` : ''}`);
      return res.json();
    },
    enabled: !!activeExchangeId,
    refetchInterval: 30000,
  });

  // Calculate total USDT/USD balance
  const usdBalance = balance?.USDT?.total ?? balance?.USD?.total ?? balance?.BUSD?.total ?? 0;
  const totalPnl = analytics?.totalPnl ?? 0;
  const isPnlUp = totalPnl >= 0;

  const rows = [
    { label: 'BUYING POWER', value: formatCurrency(usdBalance), color: '#00E5FF' },
    { label: 'TOTAL P&L', value: formatCurrency(totalPnl), color: isPnlUp ? '#00FF66' : '#ef4444' },
    { label: 'WIN RATE', value: `${(analytics?.winRate ?? 0).toFixed(1)}%`, color: (analytics?.winRate ?? 0) >= 50 ? '#00FF66' : '#ef4444' },
    { label: 'PROFIT FACTOR', value: (analytics?.profitFactor ?? 0).toFixed(2), color: (analytics?.profitFactor ?? 0) >= 1 ? '#00FF66' : '#ef4444' },
    { label: 'TOTAL TRADES', value: String(analytics?.totalTrades ?? 0), color: '#C7D1DB' },
    { label: 'WIN / LOSS', value: `${analytics?.winningTrades ?? 0} / ${analytics?.losingTrades ?? 0}`, color: '#C7D1DB' },
  ];

  return (
    <div className="rounded-lg border overflow-hidden" style={{ background: '#0E1626', borderColor: '#243044' }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: '#243044', background: '#070B10' }}>
        <Activity className="w-3.5 h-3.5" style={{ color: '#00FF66' }} />
        <span className="text-[11px] font-mono font-bold tracking-widest uppercase" style={{ color: '#00FF66' }}>Account</span>
      </div>
      <div className="p-2 space-y-0.5">
        {rows.map(({ label, value, color }) => (
          <div key={label} className="flex items-center justify-between px-1 py-1 rounded" style={{ background: '#121C2F' }}>
            <span className="text-[10px] font-mono tracking-wider" style={{ color: '#8B949E' }}>{label}</span>
            <span className="text-xs font-mono font-bold" style={{ color }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
