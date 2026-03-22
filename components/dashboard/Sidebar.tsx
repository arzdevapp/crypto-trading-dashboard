'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Bot,
  FlaskConical,
  History,
  LayoutDashboard,
  Settings,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWebSocket } from '@/components/providers/WebSocketProvider';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/strategies', label: 'Strategies', icon: Bot },
  { href: '/markets', label: 'Markets', icon: BarChart3 },
  { href: '/backtests', label: 'Backtests', icon: FlaskConical },
  { href: '/trades', label: 'Trades', icon: History },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { connected } = useWebSocket();

  return (
    <aside className="flex flex-col w-56 shrink-0 border-r border-zinc-800 bg-zinc-950 h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-zinc-800">
        <div className="w-7 h-7 rounded-md bg-emerald-500 flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-white text-sm tracking-tight">CryptoBot</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                active
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Connection status */}
      <div className="px-5 py-4 border-t border-zinc-800">
        <div className="flex items-center gap-2 text-xs">
          {connected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Live</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-zinc-500">Disconnected</span>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
