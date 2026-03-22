'use client';
import { useState, useMemo } from 'react';
import { useStrategies } from '@/hooks/useStrategies';
import { StrategyCard } from '@/components/strategies/StrategyCard';
import { StrategyForm } from '@/components/strategies/StrategyForm';
import { useStore } from '@/store';
import { Bot, Sparkles, RefreshCw, Filter, X } from 'lucide-react';
import { PageHelp } from '@/components/ui/page-help';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { StrategyRecord } from '@/types/strategy';

const POPULATE_TIERS = [
  { id: 'best',     label: '★ Best',     color: '#00FF66' },
  { id: 'good',     label: '◆ Good',     color: '#00E5FF' },
  { id: 'moderate', label: '● Moderate', color: '#eab308' },
];

const STATUS_FILTERS = ['all', 'running', 'stopped', 'error'] as const;
const TYPE_FILTERS   = ['all', 'POWER_TRADER', 'SENTIMENT', 'RSI', 'MACD', 'MA_CROSSOVER', 'BOLLINGER', 'GRID'] as const;
const SORT_OPTIONS   = [
  { id: 'newest',  label: 'Newest' },
  { id: 'oldest',  label: 'Oldest' },
  { id: 'name',    label: 'Name A–Z' },
  { id: 'status',  label: 'Status' },
  { id: 'type',    label: 'Type' },
] as const;

type SortId = typeof SORT_OPTIONS[number]['id'];

function FilterChip({ label, active, color, onClick }: { label: string; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[9px] font-mono px-2 py-1 rounded border transition-colors whitespace-nowrap"
      style={active
        ? { borderColor: color ?? '#00E5FF', color: color ?? '#00E5FF', background: `${color ?? '#00E5FF'}15` }
        : { borderColor: '#243044', color: '#8B949E', background: 'transparent' }
      }
    >
      {label}
    </button>
  );
}

export default function StrategiesPage() {
  const { activeExchangeId } = useStore();
  const { data: strategies = [], isLoading } = useStrategies();
  const queryClient = useQueryClient();

  // Populate state
  const [populating, setPopulating] = useState(false);
  const [selectedTiers, setSelectedTiers] = useState<string[]>(['best', 'good']);

  // Filter/sort state
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortId>('newest');
  const [search, setSearch] = useState('');

  // Derived filtered + sorted list
  const filtered = useMemo(() => {
    let list = [...strategies] as StrategyRecord[];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q));
    }
    if (filterStatus !== 'all') list = list.filter(s => s.status === filterStatus);
    if (filterType !== 'all')   list = list.filter(s => s.type === filterType);

    list.sort((a, b) => {
      if (sortBy === 'newest')  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'oldest')  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'name')    return a.name.localeCompare(b.name);
      if (sortBy === 'status')  return a.status.localeCompare(b.status);
      if (sortBy === 'type')    return a.type.localeCompare(b.type);
      return 0;
    });

    return list;
  }, [strategies, search, filterStatus, filterType, sortBy]);

  const hasActiveFilters = filterStatus !== 'all' || filterType !== 'all' || search.trim() !== '' || sortBy !== 'newest';

  function clearFilters() {
    setFilterStatus('all');
    setFilterType('all');
    setSearch('');
    setSortBy('newest');
  }

  async function handlePopulate() {
    if (!activeExchangeId) { toast.error('Select an exchange first'); return; }
    setPopulating(true);
    try {
      const res = await fetch('/api/strategies/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchangeId: activeExchangeId, tiers: selectedTiers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Added ${data.total} strategies${data.skipped.length ? ` · ${data.skipped.length} already existed` : ''}`);
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPopulating(false);
    }
  }

  return (
    <div className="h-full flex flex-col gap-2 p-2" style={{ background: '#070B10' }}>

      {/* Header bar */}
      <div className="flex items-center gap-2 flex-shrink-0 px-1 flex-wrap">
        <Bot className="w-3.5 h-3.5" style={{ color: '#00E5FF' }} />
        <span className="text-[11px] font-mono font-bold tracking-widest uppercase" style={{ color: '#00E5FF' }}>Strategies</span>
        <PageHelp
          title="Strategies"
          description="Create and manage automated trading algorithms. Use Populate to load pre-configured strategies, and Filter to organise them."
          steps={[
            { label: 'Populate best strategies', detail: 'Choose tiers (★/◆/●) then click Populate to add pre-configured strategies for top pairs.' },
            { label: 'Filter & sort', detail: 'Click the Filter button to filter by status, type, or search by name/symbol. Sort by newest, name, or status.' },
            { label: 'Start a strategy', detail: 'Click the green play button on a card.' },
            { label: 'Create custom', detail: 'Click + New Strategy for full control over parameters.' },
          ]}
          tips={[
            '★ BEST = PowerTrader DCA + Sentiment. Best starting point.',
            'Always test on Testnet before going live.',
            'Running strategies are shown first when sorted by Status.',
          ]}
        />
        {strategies.length > 0 && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: '#121C2F', color: '#8B949E' }}>
            {strategies.filter(s => s.status === 'running').length} running · {strategies.length} total
          </span>
        )}

        <div className="flex-1" />

        {/* Populate tier toggles */}
        {activeExchangeId && (
          <div className="flex items-center gap-1.5">
            {POPULATE_TIERS.map(t => (
              <FilterChip
                key={t.id}
                label={t.label}
                active={selectedTiers.includes(t.id)}
                color={t.color}
                onClick={() => setSelectedTiers(prev =>
                  prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]
                )}
              />
            ))}
            <button
              onClick={handlePopulate}
              disabled={populating || selectedTiers.length === 0}
              className="flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-1 rounded border transition-colors disabled:opacity-50"
              style={{ borderColor: '#00FF66', color: '#00FF66', background: '#00FF6615' }}
            >
              {populating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {populating ? 'Adding…' : 'Populate'}
            </button>
          </div>
        )}

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(f => !f)}
          className="flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded border transition-colors"
          style={showFilters || hasActiveFilters
            ? { borderColor: '#00E5FF', color: '#00E5FF', background: '#00E5FF15' }
            : { borderColor: '#243044', color: '#8B949E', background: 'transparent' }
          }
        >
          <Filter className="w-3 h-3" />
          Filter{hasActiveFilters ? ` (${[filterStatus !== 'all', filterType !== 'all', !!search.trim(), sortBy !== 'newest'].filter(Boolean).length})` : ''}
        </button>

        {activeExchangeId && <StrategyForm exchangeId={activeExchangeId} />}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div
          className="flex-shrink-0 rounded-lg border p-3 flex flex-col gap-3"
          style={{ background: '#0E1626', borderColor: '#243044' }}
        >
          {/* Search + clear */}
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or symbol…"
              className="flex-1 h-7 rounded border px-2 text-xs font-mono bg-transparent outline-none"
              style={{ borderColor: '#243044', color: '#C7D1DB' }}
            />
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-[9px] font-mono px-2 py-1 rounded border transition-colors"
                style={{ borderColor: '#ef4444', color: '#ef4444', background: '#ef444415' }}
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-mono uppercase tracking-widest w-10 flex-shrink-0" style={{ color: '#243044' }}>Status</span>
            {STATUS_FILTERS.map(s => (
              <FilterChip key={s} label={s.toUpperCase()} active={filterStatus === s} onClick={() => setFilterStatus(s)} />
            ))}
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-mono uppercase tracking-widest w-10 flex-shrink-0" style={{ color: '#243044' }}>Type</span>
            {TYPE_FILTERS.map(t => (
              <FilterChip key={t} label={t === 'all' ? 'ALL' : t.replace('_', ' ')} active={filterType === t} onClick={() => setFilterType(t)} />
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-mono uppercase tracking-widest w-10 flex-shrink-0" style={{ color: '#243044' }}>Sort</span>
            {SORT_OPTIONS.map(o => (
              <FilterChip key={o.id} label={o.label} active={sortBy === o.id} onClick={() => setSortBy(o.id)} />
            ))}
          </div>

          {/* Result count */}
          <p className="text-[9px] font-mono" style={{ color: '#243044' }}>
            Showing {filtered.length} of {strategies.length} strategies
          </p>
        </div>
      )}

      {/* Strategy grid */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 rounded-lg animate-pulse" style={{ background: '#0E1626' }} />
            ))}
          </div>
        ) : strategies.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <Bot className="w-10 h-10" style={{ color: '#243044' }} />
            <div className="text-center">
              <p className="text-sm font-mono" style={{ color: '#8B949E' }}>No strategies yet</p>
              <p className="text-[11px] font-mono mt-0.5" style={{ color: '#243044' }}>
                {activeExchangeId ? 'Click Populate to add pre-configured best strategies' : 'Select an exchange first'}
              </p>
            </div>
            {activeExchangeId && (
              <button
                onClick={handlePopulate}
                disabled={populating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border font-mono text-sm font-bold transition-colors"
                style={{ borderColor: '#00FF66', color: '#00FF66', background: '#00FF6615' }}
              >
                {populating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {populating ? 'Adding strategies…' : 'Populate Best Strategies'}
              </button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <Filter className="w-8 h-8" style={{ color: '#243044' }} />
            <div className="text-center">
              <p className="text-sm font-mono" style={{ color: '#8B949E' }}>No strategies match filters</p>
              <button onClick={clearFilters} className="text-[11px] font-mono mt-1 underline" style={{ color: '#00E5FF' }}>
                Clear filters
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {filtered.map(strategy => (
              <StrategyCard key={strategy.id} strategy={strategy} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
