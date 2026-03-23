'use client';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '@/store';
import { formatCurrency, formatCrypto } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Zap } from 'lucide-react';

interface Trade {
  id: string;
  symbol: string;
  side: string;
  type: string;
  quantity: number;
  price: number;
  pnl: number | null;
  status: string;
  openedAt: string;
}

export function LiveFeed({ className = '' }: { className?: string }) {
  const { activeExchangeId } = useStore();

  const { data } = useQuery({
    queryKey: ['trades-feed', activeExchangeId],
    queryFn: async () => {
      const url = `/api/trades?limit=12${activeExchangeId ? `&exchangeId=${activeExchangeId}` : ''}`;
      const res = await fetch(url);
      return res.json();
    },
    refetchInterval: 30000,
    staleTime: 25000,
  });

  const trades: Trade[] = Array.isArray(data?.trades) ? data.trades : [];

  return (
    <div className={`rounded-lg border overflow-hidden ${className}`} style={{ background: '#0E1626', borderColor: '#243044' }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: '#243044', background: '#070B10' }}>
        <Zap className="w-3.5 h-3.5" style={{ color: '#00FF66' }} />
        <span className="text-[11px] font-mono font-bold tracking-widest uppercase" style={{ color: '#00FF66' }}>Live Feed</span>
        {trades.length > 0 && (
          <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: '#121C2F', color: '#8B949E' }}>
            {data?.total ?? 0} total
          </span>
        )}
      </div>
      <div className="divide-y divide-[#243044]">
        {trades.length === 0 ? (
          <div className="px-3 py-6 text-[10px] font-mono text-center" style={{ color: '#8B949E' }}>
            No trades recorded yet
          </div>
        ) : trades.map((trade) => {
          const isBuy = trade.side === 'buy';
          const hasPnl = trade.pnl !== null;
          const isProfit = (trade.pnl ?? 0) >= 0;
          const sideColor = isBuy ? '#3b82f6' : '#f97316';
          const pnlColor = isProfit ? '#00FF66' : '#ef4444';

          return (
            <div
              key={trade.id}
              className="flex items-center gap-2 px-3 py-1.5 hover:opacity-80 transition-opacity"
              style={{ borderColor: '#243044' }}
            >
              {/* Side indicator */}
              <div
                className="w-1 h-6 rounded-full flex-shrink-0"
                style={{ background: sideColor }}
              />
              {/* Symbol + type */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono font-bold" style={{ color: '#C7D1DB' }}>{trade.symbol}</span>
                  <span className="text-[9px] font-mono px-1 rounded" style={{ background: `${sideColor}20`, color: sideColor }}>
                    {trade.side.toUpperCase()}
                  </span>
                  <span className="text-[9px] font-mono capitalize" style={{ color: '#8B949E' }}>{trade.type}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono" style={{ color: '#8B949E' }}>
                    {formatCrypto(trade.quantity, 6)} @ {formatCurrency(trade.price)}
                  </span>
                </div>
              </div>
              {/* P&L + time */}
              <div className="text-right flex-shrink-0">
                {hasPnl && (
                  <div className="text-xs font-mono font-bold" style={{ color: pnlColor }}>
                    {isProfit ? '+' : ''}{formatCurrency(trade.pnl!)}
                  </div>
                )}
                <div className="text-[9px] font-mono" style={{ color: '#8B949E' }}>
                  {formatDistanceToNow(new Date(trade.openedAt), { addSuffix: true })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
