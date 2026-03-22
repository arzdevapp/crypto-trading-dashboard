'use client';
import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useMarkets } from '@/hooks/usePortfolio';
import { cn } from '@/lib/utils';

interface SymbolSelectorProps {
  exchangeId: string;
  value: string;
  onChange: (symbol: string) => void;
}

export function SymbolSelector({ exchangeId, value, onChange }: SymbolSelectorProps) {
  const [search, setSearch] = useState('');
  const { data: markets = [], isLoading } = useMarkets(exchangeId);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (markets as { symbol: string }[]).filter((m) => m.symbol.toLowerCase().includes(q)).slice(0, 100);
  }, [markets, search]);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          className="h-7 pl-7 text-xs"
          placeholder="Search symbol..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="h-32 overflow-y-auto rounded border border-border">
        {isLoading ? (
          <div className="p-2 text-xs text-muted-foreground text-center">Loading markets...</div>
        ) : filtered.length === 0 ? (
          <div className="p-2 text-xs text-muted-foreground text-center">No markets found</div>
        ) : (
          <div className="p-1">
            {filtered.map((m) => (
              <button
                key={m.symbol}
                className={cn(
                  'w-full text-left px-2 py-1 text-xs rounded hover:bg-accent transition-colors',
                  m.symbol === value && 'bg-primary text-primary-foreground hover:bg-primary'
                )}
                onClick={() => onChange(m.symbol)}
              >
                {m.symbol}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
