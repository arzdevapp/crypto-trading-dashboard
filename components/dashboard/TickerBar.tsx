'use client';
import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '@/store';
import { TrendingUp, TrendingDown } from 'lucide-react';

const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT'];

interface TickerItem {
  symbol: string;
  last: number;
  percentage: number;
  volume: number;
}

const TickerEntry = memo(function TickerEntry({ symbol, last, percentage, isActive, onClick }: TickerItem & { isActive: boolean; onClick: () => void }) {
  const isUp = percentage >= 0;
  const base = symbol.split('/')[0];
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-1.5 border-r flex-shrink-0 transition-all"
      style={{
        borderColor: '#243044',
        background: isActive ? '#0d1e35' : 'transparent',
        borderBottom: isActive ? '2px solid #00E5FF' : '2px solid transparent',
        cursor: 'pointer',
      }}
    >
      <span className="font-mono text-xs font-bold" style={{ color: isActive ? '#00E5FF' : '#C7D1DB' }}>{base}</span>
      <span className="font-mono text-xs font-bold" style={{ color: isUp ? '#00FF66' : '#ef4444' }}>
        ${last.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: last >= 1 ? 2 : 6 })}
      </span>
      <div className="flex items-center gap-0.5">
        {isUp ? <TrendingUp className="w-2.5 h-2.5" style={{ color: '#00FF66' }} /> : <TrendingDown className="w-2.5 h-2.5 text-red-500" />}
        <span className="text-[10px] font-mono" style={{ color: isUp ? '#00FF66' : '#ef4444' }}>
          {isUp ? '+' : ''}{percentage.toFixed(2)}%
        </span>
      </div>
    </button>
  );
});

export function TickerBar() {
  const { activeExchangeId, selectedSymbol, setSelectedSymbol } = useStore();

  const { data: tickers = [] } = useQuery<TickerItem[]>({
    queryKey: ['ticker-bar', activeExchangeId],
    queryFn: async () => {
      if (!activeExchangeId) return [];
      const results = await Promise.allSettled(
        SYMBOLS.map(async (sym) => {
          const res = await fetch(`/api/exchanges/${activeExchangeId}/ticker/${encodeURIComponent(sym)}`);
          if (!res.ok) return null;
          return res.json();
        })
      );
      return results
        .filter((r): r is PromiseFulfilledResult<TickerItem> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);
    },
    enabled: !!activeExchangeId,
    refetchInterval: 30000,
    staleTime: 25000,
  });

  if (!activeExchangeId || tickers.length === 0) {
    return (
      <div className="h-9 border-b flex items-center px-4 gap-4" style={{ borderColor: '#243044', background: '#070B10' }}>
        <span className="text-[10px] font-mono" style={{ color: '#8B949E' }}>
          {activeExchangeId ? 'Loading market data...' : 'Connect an exchange to see live prices'}
        </span>
      </div>
    );
  }

  return (
    <div className="h-9 border-b flex items-center overflow-x-auto scrollbar-none" style={{ borderColor: '#243044', background: '#070B10' }}>
      <div className="flex items-center h-full">
        <div className="px-3 border-r h-full flex items-center flex-shrink-0" style={{ borderColor: '#243044' }}>
          <span className="text-[10px] font-mono font-bold" style={{ color: '#00E5FF' }}>LIVE</span>
          <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
        </div>
        {tickers.map((t) => (
          <TickerEntry
            key={t.symbol}
            {...t}
            isActive={t.symbol === selectedSymbol}
            onClick={() => setSelectedSymbol(t.symbol)}
          />
        ))}
      </div>
    </div>
  );
}
