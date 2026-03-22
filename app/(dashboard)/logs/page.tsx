'use client';
import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Terminal, Trash2, RefreshCw } from 'lucide-react';
import { PageHelp } from '@/components/ui/page-help';

type LogLevel = 'all' | 'info' | 'warn' | 'error' | 'trade' | 'signal';

interface SystemLog {
  id: string;
  level: string;
  source: string;
  message: string;
  meta?: string | null;
  createdAt: string;
}

const LEVEL_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  info:   { color: '#00E5FF', bg: '#00E5FF15', label: 'INFO' },
  warn:   { color: '#eab308', bg: '#eab30815', label: 'WARN' },
  error:  { color: '#ef4444', bg: '#ef444415', label: 'ERR' },
  trade:  { color: '#00FF66', bg: '#00FF6615', label: 'TRADE' },
  signal: { color: '#a855f7', bg: '#a855f715', label: 'SIG' },
};

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

export default function LogsPage() {
  const [level, setLevel] = useState<LogLevel>('all');
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching } = useQuery<{ logs: SystemLog[] }>({
    queryKey: ['logs', level],
    queryFn: () => fetch(`/api/logs?level=${level}&limit=200`).then(r => r.json()),
    refetchInterval: 5000,
    staleTime: 4000,
  });

  const logs = data?.logs ?? [];

  const handleClear = useCallback(async () => {
    if (!confirm(`Clear all ${level === 'all' ? '' : level + ' '}logs?`)) return;
    await fetch(`/api/logs?level=${level}`, { method: 'DELETE' });
    queryClient.invalidateQueries({ queryKey: ['logs'] });
  }, [level, queryClient]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['logs'] });
  }, [queryClient]);

  return (
    <div className="h-full flex flex-col p-2 gap-2" style={{ background: '#070B10' }}>

      {/* Header */}
      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
        <Terminal className="w-4 h-4" style={{ color: '#00FF66' }} />
        <span className="text-sm font-mono font-bold tracking-widest uppercase" style={{ color: '#00FF66' }}>
          System Logs
        </span>
        {isFetching && (
          <span className="text-[9px] font-mono animate-pulse" style={{ color: '#8B949E' }}>LIVE</span>
        )}
        <div className="flex-1" />

        {/* Level filter */}
        <div className="flex gap-1">
          {(['all', 'info', 'warn', 'error', 'trade', 'signal'] as LogLevel[]).map(l => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className="text-[9px] font-mono px-2 py-0.5 rounded border transition-colors"
              style={level === l
                ? { borderColor: '#00E5FF', color: '#00E5FF', background: '#00E5FF15' }
                : { borderColor: '#243044', color: '#8B949E', background: 'transparent' }
              }
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <button
          onClick={refresh}
          className="p-1 rounded transition-colors hover:bg-[#121C2F]"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" style={{ color: '#8B949E' }} />
        </button>
        <button
          onClick={handleClear}
          className="p-1 rounded transition-colors hover:bg-[#121C2F]"
          title="Clear logs"
        >
          <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
        </button>
        <PageHelp
          title="System Logs"
          description="Real-time log stream from all running strategies, ML engine, order placement, and system events."
          steps={[
            { label: 'Filter by level', detail: 'Use the level buttons to filter: INFO = general events, WARN = issues, ERR = failures, TRADE = orders placed, SIG = strategy signals.' },
            { label: 'Start a strategy', detail: 'Run a strategy from the Strategies page — you will see INFO, SIGNAL, and TRADE entries appear here within seconds.' },
            { label: 'Expand a row', detail: 'Click any log entry to see the full JSON metadata (price, quantity, order ID, etc.).' },
            { label: 'Clear logs', detail: 'The trash icon clears logs for the current filter level (or all if "ALL" is selected).' },
          ]}
          tips={[
            'Logs auto-refresh every 5 seconds.',
            'TRADE entries confirm real orders were placed on your exchange.',
            'ERR entries with strategy source usually mean the exchange rejected an order or lost connection.',
          ]}
        />
      </div>

      {/* Log table */}
      <div
        className="flex-1 min-h-0 rounded-lg border overflow-hidden flex flex-col"
        style={{ background: '#0E1626', borderColor: '#243044' }}
      >
        {/* Column headers */}
        <div
          className="hidden xl:grid gap-2 px-3 py-1.5 border-b flex-shrink-0 font-mono text-[9px] uppercase tracking-widest"
          style={{ borderColor: '#243044', color: '#243044', gridTemplateColumns: '70px 60px 160px 1fr' }}
        >
          <span>Time</span>
          <span>Level</span>
          <span>Source</span>
          <span>Message</span>
        </div>

        {/* Rows */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center font-mono text-xs" style={{ color: '#8B949E' }}>Loading…</div>
          ) : logs.length === 0 ? (
            <div className="p-4 text-center font-mono text-xs" style={{ color: '#8B949E' }}>
              No logs yet. Start a strategy to see events here.
            </div>
          ) : (
            logs.map(entry => <LogRow key={entry.id} entry={entry} />)
          )}
        </div>
      </div>

      {/* Footer count */}
      <div className="flex-shrink-0 text-[9px] font-mono" style={{ color: '#243044' }}>
        {logs.length} entries · auto-refreshes every 5s
      </div>
    </div>
  );
}

function LogRow({ entry }: { entry: SystemLog }) {
  const [open, setOpen] = useState(false);
  const style = LEVEL_STYLE[entry.level] ?? LEVEL_STYLE.info;

  return (
    <div
      className="border-b cursor-pointer hover:bg-[#121C2F] transition-colors"
      style={{ borderColor: '#1a2538' }}
      onClick={() => setOpen(o => !o)}
    >
      {/* Desktop row */}
      <div
        className="hidden xl:grid gap-2 px-3 py-1.5 font-mono text-[10px] items-start"
        style={{ gridTemplateColumns: '70px 60px 160px 1fr' }}
      >
        <span style={{ color: '#8B949E' }}>{fmt(entry.createdAt)}</span>
        <span
          className="text-[9px] px-1.5 py-0.5 rounded text-center font-bold self-start"
          style={{ color: style.color, background: style.bg }}
        >
          {style.label}
        </span>
        <span className="truncate" style={{ color: '#8B949E' }}>{entry.source}</span>
        <span style={{ color: '#C7D1DB' }}>{entry.message}</span>
      </div>
      {/* Mobile row */}
      <div className="xl:hidden px-3 py-2 font-mono text-[10px]">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="text-[8px] px-1 py-0.5 rounded font-bold"
            style={{ color: style.color, background: style.bg }}
          >
            {style.label}
          </span>
          <span style={{ color: '#8B949E' }}>{fmt(entry.createdAt)}</span>
        </div>
        <div className="truncate" style={{ color: '#C7D1DB' }}>{entry.message}</div>
      </div>
      {open && entry.meta && (
        <pre
          className="mx-3 mb-2 p-2 rounded text-[9px] font-mono overflow-x-auto"
          style={{ background: '#070B10', color: '#00E5FF', border: '1px solid #243044' }}
        >
          {JSON.stringify(JSON.parse(entry.meta), null, 2)}
        </pre>
      )}
    </div>
  );
}
