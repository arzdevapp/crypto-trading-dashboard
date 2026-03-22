'use client';
import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useStore } from '@/store';

const POPULAR = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
  'ADA/USDT', 'DOGE/USDT', 'AVAX/USDT', 'DOT/USDT', 'LINK/USDT',
  'MATIC/USDT', 'UNI/USDT', 'LTC/USDT', 'ATOM/USDT', 'FIL/USDT',
  'NEAR/USDT', 'APT/USDT', 'ARB/USDT', 'OP/USDT', 'INJ/USDT',
  'SUI/USDT', 'TIA/USDT', 'SEI/USDT', 'WIF/USDT', 'PEPE/USDT',
];

export function SymbolSearch() {
  const { selectedSymbol, setSelectedSymbol } = useStore();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? POPULAR.filter(s => s.toLowerCase().includes(query.toLowerCase()))
    : POPULAR;

  // Also allow free-form entry: if user types a valid pair format, add it
  const queryUpper = query.toUpperCase().trim();
  const customPair =
    queryUpper.length >= 3 && !POPULAR.includes(queryUpper)
      ? queryUpper.includes('/') ? queryUpper : `${queryUpper}/USDT`
      : null;

  function select(symbol: string) {
    setSelectedSymbol(symbol);
    setQuery('');
    setOpen(false);
  }

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      {/* Current symbol badge */}
      <button
        className="flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-mono font-bold transition-colors hover:border-[#00E5FF]"
        style={{ borderColor: '#243044', color: '#00E5FF', background: '#0E1626' }}
        onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 50); }}
      >
        {selectedSymbol}
      </button>

      {/* Search input */}
      <div
        className="flex items-center gap-1 rounded border px-2 py-1 transition-colors"
        style={{ borderColor: open ? '#00E5FF' : '#243044', background: '#0E1626' }}
      >
        <Search className="w-3 h-3 flex-shrink-0" style={{ color: '#8B949E' }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              if (filtered.length > 0) select(filtered[0]);
              else if (customPair) select(customPair);
            }
            if (e.key === 'Escape') { setOpen(false); setQuery(''); }
          }}
          placeholder="Search pair…"
          className="bg-transparent outline-none text-[11px] font-mono w-24"
          style={{ color: '#C7D1DB' }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false); }}>
            <X className="w-3 h-3" style={{ color: '#8B949E' }} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-lg border shadow-xl overflow-hidden"
          style={{ background: '#0E1626', borderColor: '#243044', width: 220 }}
        >
          <div className="max-h-[260px] overflow-y-auto">
            {customPair && (
              <button
                className="w-full px-3 py-2 text-left text-[11px] font-mono border-b hover:bg-[#121C2F] transition-colors flex items-center gap-2"
                style={{ borderColor: '#1a2538', color: '#00E5FF' }}
                onClick={() => select(customPair)}
              >
                <Search className="w-3 h-3" />
                {customPair}
                <span className="ml-auto text-[9px]" style={{ color: '#243044' }}>custom</span>
              </button>
            )}
            {filtered.length === 0 && !customPair && (
              <div className="px-3 py-4 text-center text-[11px] font-mono" style={{ color: '#8B949E' }}>
                No matches
              </div>
            )}
            {filtered.map(s => (
              <button
                key={s}
                className="w-full px-3 py-2 text-left text-[11px] font-mono hover:bg-[#121C2F] transition-colors flex items-center justify-between"
                style={{ color: s === selectedSymbol ? '#00E5FF' : '#C7D1DB' }}
                onClick={() => select(s)}
              >
                <span>{s}</span>
                {s === selectedSymbol && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#00E5FF20', color: '#00E5FF' }}>ACTIVE</span>
                )}
              </button>
            ))}
          </div>
          <div className="px-3 py-1.5 border-t text-[9px] font-mono" style={{ borderColor: '#243044', color: '#243044' }}>
            Type any pair e.g. SHIB/USDT · Enter to confirm
          </div>
        </div>
      )}
    </div>
  );
}
