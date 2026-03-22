'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

interface Strategy {
  id: string;
  name: string;
  type: string;
  symbol: string;
  status: string;
  exchange: { label: string };
  _count: { trades: number };
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'running') {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
        Running
      </Badge>
    );
  }
  if (status === 'error') {
    return (
      <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">
        Error
      </Badge>
    );
  }
  return (
    <Badge className="bg-zinc-700/50 text-zinc-400 border-zinc-600 text-xs">
      Stopped
    </Badge>
  );
}

export function StrategyStatusList({ strategies }: { strategies: Strategy[] }) {
  if (strategies.length === 0) {
    return (
      <p className="text-sm text-zinc-500 py-4 text-center">
        No strategies yet.{' '}
        <Link href="/strategies" className="text-emerald-400 hover:underline">
          Create one
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {strategies.slice(0, 6).map((s) => (
        <Link
          key={s.id}
          href={`/strategies`}
          className="flex items-center justify-between p-2 rounded-md hover:bg-zinc-800 transition-colors"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-100 truncate">{s.name}</p>
            <p className="text-xs text-zinc-500">
              {s.symbol} · {s.type} · {s.exchange.label}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-3">
            <span className="text-xs text-zinc-500">{s._count.trades} trades</span>
            <StatusBadge status={s.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}
