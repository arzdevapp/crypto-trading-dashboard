'use client';

import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Trade {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  pnl: number | null;
  status: string;
  openedAt: string;
  strategy: { name: string } | null;
}

export function RecentTradesTable({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
    return (
      <p className="text-sm text-zinc-500 py-8 text-center">No trades recorded yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left text-zinc-500 font-medium px-4 py-2">Symbol</th>
            <th className="text-left text-zinc-500 font-medium px-4 py-2">Side</th>
            <th className="text-right text-zinc-500 font-medium px-4 py-2">Price</th>
            <th className="text-right text-zinc-500 font-medium px-4 py-2">P&L</th>
            <th className="text-right text-zinc-500 font-medium px-4 py-2">Time</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
              <td className="px-4 py-2 font-medium text-zinc-100">{t.symbol}</td>
              <td className="px-4 py-2">
                <span
                  className={cn(
                    'font-medium',
                    t.side === 'buy' ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  {t.side.toUpperCase()}
                </span>
              </td>
              <td className="px-4 py-2 text-right text-zinc-300">
                {formatCurrency(t.price)}
              </td>
              <td className="px-4 py-2 text-right">
                {t.pnl !== null ? (
                  <span className={t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {formatCurrency(t.pnl)}
                  </span>
                ) : (
                  <span className="text-zinc-500">—</span>
                )}
              </td>
              <td className="px-4 py-2 text-right text-zinc-500">
                {format(new Date(t.openedAt), 'MM/dd HH:mm')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
