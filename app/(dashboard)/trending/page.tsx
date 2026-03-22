'use client';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '@/store';
import { TrendingUp, Flame, RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown, Zap } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { PageHelp } from '@/components/ui/page-help';
import type { TrendingCoin } from '@/lib/market/trendingCoins';

const SIGNAL_CONFIG = {
  strong_buy: { label: 'STRONG BUY', color: '#00FF66', bg: '#00FF6620', rank: 4 },
  buy:         { label: 'BUY',         color: '#84cc16', bg: '#84cc1620', rank: 3 },
  neutral:     { label: 'HOLD',        color: '#8B949E', bg: '#8B949E20', rank: 2 },
  sell:        { label: 'SELL',        color: '#f97316', bg: '#f9731620', rank: 1 },
  avoid:       { label: 'AVOID',       color: '#ef4444', bg: '#ef444420', rank: 0 },
};

const SAFETY_COLOR = {
  Safe:     '#00FF66',
  Moderate: '#eab308',
  Caution:  '#f97316',
  Risky:    '#ef4444',
};

type SortKey = 'default' | 'price' | 'change24h' | 'change7d' | 'safety' | 'signal';
type SortDir = 'asc' | 'desc';

function formatPrice(p: number) {
  if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (p >= 1)    return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(6)}`;
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
  return sortDir === 'desc'
    ? <ChevronDown className="w-3 h-3" style={{ color: '#00E5FF' }} />
    : <ChevronUp className="w-3 h-3" style={{ color: '#00E5FF' }} />;
}

export default function TrendingPage() {
  const { setSelectedSymbol } = useStore();
  const queryClient = useQueryClient();
  const router = useRouter();

  function openForTrading(coin: TrendingCoin) {
    setSelectedSymbol(coin.tradingPair);
    router.push('/trading');
  }
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data: coins = [], isLoading, isFetching } = useQuery<TrendingCoin[]>({
    queryKey: ['trending'],
    queryFn: () => fetch('/api/trending').then(r => r.json()),
    refetchInterval: 10 * 60 * 1000,
    staleTime: 9 * 60 * 1000,
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = useMemo(() => {
    if (sortKey === 'default') return coins;
    return [...coins].sort((a, b) => {
      let va = 0, vb = 0;
      if (sortKey === 'price')     { va = a.price;              vb = b.price; }
      if (sortKey === 'change24h') { va = a.change24h;          vb = b.change24h; }
      if (sortKey === 'change7d')  { va = a.change7d;           vb = b.change7d; }
      if (sortKey === 'safety')    { va = a.safety.score;       vb = b.safety.score; }
      if (sortKey === 'signal')    { va = SIGNAL_CONFIG[a.signal].rank; vb = SIGNAL_CONFIG[b.signal].rank; }
      return sortDir === 'desc' ? vb - va : va - vb;
    });
  }, [coins, sortKey, sortDir]);

  function ColHeader({ col, label, className = '' }: { col: SortKey; label: string; className?: string }) {
    const active = sortKey === col;
    return (
      <button
        className={`flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest transition-colors hover:opacity-100 ${className}`}
        style={{ color: active ? '#00E5FF' : '#243044' }}
        onClick={() => toggleSort(col)}
      >
        {label}
        <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
      </button>
    );
  }

  return (
    <div className="h-full flex flex-col p-2 gap-2" style={{ background: '#070B10' }}>

      {/* Header */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <TrendingUp className="w-4 h-4" style={{ color: '#00FF66' }} />
        <span className="text-sm font-mono font-bold tracking-widest uppercase" style={{ color: '#00FF66' }}>
          Trending & Best Trades
        </span>
        {isFetching && (
          <span className="text-[9px] font-mono animate-pulse" style={{ color: '#8B949E' }}>UPDATING</span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['trending'] })}
          className="p-1 rounded transition-colors hover:bg-[#121C2F]"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" style={{ color: '#8B949E' }} />
        </button>
        <PageHelp
          title="Trending & Best Trades"
          description="Top coins ranked by trading signal, safety score, and CoinGecko trending status. Click any row to load that coin's chart on the Dashboard."
          steps={[
            { label: 'Sort columns', detail: 'Click any column header to sort high→low or low→high. Click again to flip direction. The active sort column turns cyan.' },
            { label: 'Read the signal', detail: 'STRONG BUY / BUY = entry opportunity. HOLD = wait. SELL = take profit zone. AVOID = too risky.' },
            { label: 'Check the safety dot', detail: 'Green = Safe, Yellow = Moderate, Orange = Caution, Red = Risky. Based on market cap rank, volatility, and liquidity.' },
            { label: 'Click a row', detail: 'Clicking a coin sets it as the active symbol on the Dashboard chart.' },
          ]}
          tips={[
            '🔥 flame = currently on CoinGecko trending list.',
            'Data refreshes every 10 minutes from CoinGecko.',
            'Sort by Signal desc to see the best buy opportunities at the top.',
          ]}
        />
      </div>

      {/* Table */}
      <div
        className="flex-1 min-h-0 rounded-lg border flex flex-col overflow-hidden"
        style={{ background: '#0E1626', borderColor: '#243044' }}
      >
        {/* Column headers */}
        <div
          className="grid gap-x-3 px-4 py-2 border-b flex-shrink-0 items-center"
          style={{ borderColor: '#243044', gridTemplateColumns: '2fr 1fr 90px 90px 100px 100px 60px' }}
        >
          <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#243044' }}>Coin</span>
          <ColHeader col="price"     label="Price" />
          <div className="flex justify-end"><ColHeader col="change24h" label="24h" /></div>
          <div className="flex justify-end"><ColHeader col="change7d"  label="7d" /></div>
          <div className="flex justify-center"><ColHeader col="safety" label="Safety" /></div>
          <div className="flex justify-end"><ColHeader col="signal"   label="Signal" /></div>
          <span className="font-mono text-[9px] uppercase tracking-widest text-right" style={{ color: '#243044' }}>Trade</span>
        </div>

        {/* Rows */}
        <div className="flex-1 min-h-0 overflow-y-auto divide-y" style={{ borderColor: '#1a2538' }}>
          {isLoading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="px-4 py-3 animate-pulse">
                <div className="h-4 w-32 rounded" style={{ background: '#243044' }} />
              </div>
            ))
          ) : sorted.map((coin, idx) => {
            const sig = SIGNAL_CONFIG[coin.signal];
            const safeColor = SAFETY_COLOR[coin.safety.label];
            const changeColor24 = coin.change24h >= 0 ? '#00FF66' : '#ef4444';
            const changeColor7d = coin.change7d >= 0 ? '#00FF66' : '#ef4444';

            return (
              <div
                key={coin.id}
                className="grid gap-x-3 px-4 py-3 hover:bg-[#121C2F] transition-colors items-center group"
                style={{ gridTemplateColumns: '2fr 1fr 90px 90px 100px 100px 60px' }}
                title={`${coin.signalReason}\n\nSafety: ${coin.safety.label} (${coin.safety.score}/100)\n${coin.safety.reasons.join(' · ')}`}
              >
                {/* Rank + Coin — clicking row sets symbol on dashboard */}
                <button
                  className="flex items-center gap-2 min-w-0 text-left"
                  onClick={() => setSelectedSymbol(coin.tradingPair)}
                >
                  <span className="text-[9px] font-mono w-4 text-right flex-shrink-0" style={{ color: '#243044' }}>{idx + 1}</span>
                  <span className="text-xs font-mono font-bold truncate" style={{ color: '#C7D1DB' }}>{coin.symbol}</span>
                  <span className="text-[9px] font-mono truncate hidden sm:block" style={{ color: '#8B949E' }}>{coin.name}</span>
                  {coin.isTrending && (
                    <Flame className="w-3 h-3 flex-shrink-0" style={{ color: '#f97316' }} />
                  )}
                </button>

                {/* Price */}
                <span className="text-xs font-mono" style={{ color: '#C7D1DB' }}>{formatPrice(coin.price)}</span>

                {/* 24h */}
                <span className="text-[10px] font-mono font-bold text-right" style={{ color: changeColor24 }}>
                  {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(1)}%
                </span>

                {/* 7d */}
                <span className="text-[10px] font-mono text-right" style={{ color: changeColor7d }}>
                  {coin.change7d >= 0 ? '+' : ''}{coin.change7d.toFixed(1)}%
                </span>

                {/* Safety */}
                <div className="flex items-center justify-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: safeColor, boxShadow: `0 0 5px ${safeColor}80` }}
                  />
                  <span className="text-[9px] font-mono" style={{ color: safeColor }}>{coin.safety.label}</span>
                </div>

                {/* Signal */}
                <div className="flex justify-end">
                  <span
                    className="text-[9px] font-mono font-bold px-2 py-0.5 rounded"
                    style={{ color: sig.color, background: sig.bg }}
                  >
                    {sig.label}
                  </span>
                </div>

                {/* Trade button */}
                <div className="flex justify-end">
                  <button
                    className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono font-bold transition-all opacity-0 group-hover:opacity-100 hover:scale-105"
                    style={{ background: '#00FF6620', color: '#00FF66', border: '1px solid #00FF6640' }}
                    onClick={() => openForTrading(coin)}
                    title={`Open ${coin.tradingPair} in Trading`}
                  >
                    <Zap className="w-2.5 h-2.5" />
                    TRADE
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 text-[9px] font-mono" style={{ color: '#243044' }}>
        Click coin name to load chart on Dashboard · Hover row for TRADE button · 🔥 = CoinGecko trending · Click headers to sort
      </div>
    </div>
  );
}
