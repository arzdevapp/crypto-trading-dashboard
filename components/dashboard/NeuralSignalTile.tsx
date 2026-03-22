'use client';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '@/store';
import { Brain } from 'lucide-react';

interface SignalData {
  symbol: string;
  maxLongSignal: number;
  maxShortSignal: number;
  aggregatedLongLevels: number[];
  aggregatedShortLevels: number[];
}

function SegmentBar({ filled, total, color, label }: { filled: number; total: number; color: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[9px] font-mono font-bold" style={{ color }}>{label}</span>
      <div className="flex flex-col-reverse gap-0.5">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className="w-3 h-2 rounded-sm transition-all duration-300"
            style={{
              background: i < filled ? color : '#243044',
              boxShadow: i < filled ? `0 0 4px ${color}60` : 'none',
            }}
          />
        ))}
      </div>
      <span className="text-[9px] font-mono font-bold" style={{ color: filled > 0 ? color : '#8B949E' }}>
        N{filled}
      </span>
    </div>
  );
}

function Tile({ exchangeId, symbol }: { exchangeId: string; symbol: string }) {
  const { data } = useQuery<SignalData>({
    queryKey: ['neural-signals', exchangeId, symbol],
    queryFn: async () => {
      const res = await fetch(`/api/ml/signals?exchangeId=${exchangeId}&symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 60000,
    staleTime: 55000,
    retry: false,
  });

  const base = symbol.split('/')[0];
  const longLevel = data?.maxLongSignal ?? 0;
  const shortLevel = data?.maxShortSignal ?? 0;

  return (
    <div
      className="flex flex-col items-center gap-1.5 p-2 rounded border cursor-default transition-all hover:border-[#00E5FF] group"
      style={{ background: '#121C2F', borderColor: '#243044', minWidth: 60 }}
    >
      <span className="text-[10px] font-mono font-bold group-hover:text-[#00E5FF] transition-colors" style={{ color: '#C7D1DB' }}>{base}</span>
      <div className="flex gap-2">
        <SegmentBar filled={longLevel} total={7} color="#3b82f6" label="L" />
        <SegmentBar filled={shortLevel} total={7} color="#f97316" label="S" />
      </div>
    </div>
  );
}

const WATCH_SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'];

export function NeuralSignalMatrix() {
  const { activeExchangeId } = useStore();

  return (
    <div className="rounded-lg border overflow-hidden" style={{ background: '#0E1626', borderColor: '#243044' }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: '#243044', background: '#070B10' }}>
        <Brain className="w-3.5 h-3.5" style={{ color: '#00E5FF' }} />
        <span className="text-[11px] font-mono font-bold tracking-widest uppercase" style={{ color: '#00E5FF' }}>Neural Signals</span>
        <div className="ml-auto flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-blue-500" />
          <span className="text-[9px] font-mono" style={{ color: '#8B949E' }}>LONG</span>
          <div className="w-2 h-2 rounded-sm bg-orange-500 ml-1" />
          <span className="text-[9px] font-mono" style={{ color: '#8B949E' }}>SHORT</span>
        </div>
      </div>
      <div className="p-2">
        {!activeExchangeId ? (
          <div className="text-[10px] font-mono text-center py-3" style={{ color: '#8B949E' }}>No exchange selected</div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {WATCH_SYMBOLS.map(sym => (
              <Tile key={sym} exchangeId={activeExchangeId} symbol={sym} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
