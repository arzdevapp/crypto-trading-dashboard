'use client';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '@/store';
import { TrendingUp, Flame } from 'lucide-react';
import type { TrendingCoin } from '@/lib/market/trendingCoins';

const SIGNAL_CONFIG = {
  strong_buy: { label: 'STRONG BUY', color: '#00FF66', bg: '#00FF6620' },
  buy:         { label: 'BUY',         color: '#84cc16', bg: '#84cc1620' },
  neutral:     { label: 'HOLD',        color: '#8B949E', bg: '#8B949E20' },
  sell:        { label: 'SELL',        color: '#f97316', bg: '#f9731620' },
  avoid:       { label: 'AVOID',       color: '#ef4444', bg: '#ef444420' },
};

const SAFETY_COLOR = {
  Safe:     '#00FF66',
  Moderate: '#eab308',
  Caution:  '#f97316',
  Risky:    '#ef4444',
};

function formatPrice(p: number) {
  if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (p >= 1)    return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(6)}`;
}

export function TrendingPanel() {
  const { setSelectedSymbol } = useStore();

  const { data: coins = [], isLoading } = useQuery<TrendingCoin[]>({
    queryKey: ['trending'],
    queryFn: () => fetch('/api/trending').then(r => r.json()),
    refetchInterval: 10 * 60 * 1000,
    staleTime: 9 * 60 * 1000,
  });

  return (
    <div className="rounded-lg border overflow-hidden flex-shrink-0" style={{ background: '#0E1626', borderColor: '#243044' }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: '#243044', background: '#070B10' }}>
        <TrendingUp className="w-3.5 h-3.5" style={{ color: '#00FF66' }} />
        <span className="text-[11px] font-mono font-bold tracking-widest uppercase" style={{ color: '#00FF66' }}>Trending & Best Trades</span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 px-3 py-1 border-b" style={{ borderColor: '#243044' }}>
        <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: '#243044' }}>Coin</span>
        <span className="text-[9px] font-mono uppercase tracking-widest text-right" style={{ color: '#243044' }}>24h</span>
        <span className="text-[9px] font-mono uppercase tracking-widest text-right" style={{ color: '#243044' }}>Signal</span>
      </div>

      {/* Coin rows */}
      <div className="divide-y" style={{ borderColor: '#1a2538' }}>
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-3 py-2 animate-pulse">
              <div className="h-3 w-24 rounded" style={{ background: '#243044' }} />
            </div>
          ))
        ) : coins.map(coin => {
          const sig = SIGNAL_CONFIG[coin.signal];
          const safeColor = SAFETY_COLOR[coin.safety.label];
          const changeColor = coin.change24h >= 0 ? '#00FF66' : '#ef4444';

          return (
            <button
              key={coin.id}
              className="w-full grid grid-cols-[1fr_auto_auto] gap-x-2 px-3 py-2 hover:bg-[#121C2F] transition-colors text-left"
              onClick={() => setSelectedSymbol(coin.tradingPair)}
              title={`${coin.signalReason}\n\nSafety: ${coin.safety.label} (${coin.safety.score}/100)\n${coin.safety.reasons.join(' · ')}`}
            >
              {/* Coin info */}
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono font-bold" style={{ color: '#C7D1DB' }}>{coin.symbol}</span>
                  {coin.isTrending && (
                    <Flame className="w-2.5 h-2.5 flex-shrink-0" style={{ color: '#f97316' }} />
                  )}
                  {/* Safety dot */}
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: safeColor, boxShadow: `0 0 4px ${safeColor}80` }}
                    title={`${coin.safety.label} (${coin.safety.score}/100)`}
                  />
                </div>
                <span className="text-[9px] font-mono truncate" style={{ color: '#8B949E' }}>
                  {formatPrice(coin.price)} · {coin.safety.label}
                </span>
              </div>

              {/* 24h change */}
              <div className="flex flex-col items-end justify-center">
                <span className="text-[10px] font-mono font-bold" style={{ color: changeColor }}>
                  {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(1)}%
                </span>
                <span className="text-[9px] font-mono" style={{ color: '#8B949E' }}>
                  {coin.change7d >= 0 ? '+' : ''}{coin.change7d.toFixed(1)}% 7d
                </span>
              </div>

              {/* Signal badge */}
              <div className="flex items-center justify-center">
                <span
                  className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                  style={{ color: sig.color, background: sig.bg }}
                >
                  {sig.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t" style={{ borderColor: '#243044' }}>
        <p className="text-[9px] font-mono" style={{ color: '#243044' }}>
          Click a coin to load its chart · 🔥 = CoinGecko trending · Dot = safety score
        </p>
      </div>
    </div>
  );
}
