'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, TrendingUp, Bot, FlaskConical, History, Settings, ChevronLeft, ChevronRight, Zap, Brain, Terminal, Flame, RefreshCw, Check, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/trading', label: 'Trading', icon: TrendingUp },
  { href: '/trending', label: 'Trending', icon: Flame },
  { href: '/dca-bot', label: 'DCA Bot', icon: Brain },
  { href: '/strategies', label: 'Strategies', icon: Bot },
  { href: '/backtesting', label: 'Backtesting', icon: FlaskConical },
  { href: '/history', label: 'History', icon: History },
  { href: '/logs', label: 'Logs', icon: Terminal },
  { href: '/settings', label: 'Settings', icon: Settings },
];

type UpdateStatus = 'idle' | 'loading' | 'done' | 'uptodate' | 'error';

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useStore();
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');

  const handleUpdate = async () => {
    setUpdateStatus('loading');
    try {
      const res = await fetch('/api/admin/update', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setUpdateStatus(data.alreadyUpToDate ? 'uptodate' : 'done');
      } else {
        setUpdateStatus('error');
      }
    } catch {
      setUpdateStatus('error');
    }
    setTimeout(() => setUpdateStatus('idle'), 4000);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside className={cn(
        'hidden xl:flex flex-col border-r border-border bg-card transition-all duration-300 h-full',
        sidebarOpen ? 'w-56' : 'w-14'
      )}>
        <div className="flex items-center h-14 px-3 border-b border-border">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            {sidebarOpen && <span className="font-bold text-sm truncate">CryptoBot</span>}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </Button>
        </div>

        <nav className="flex-1 py-2 px-2 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Tooltip key={href}>
                <TooltipTrigger asChild>
                  <Link href={href} className={cn(
                    'flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}>
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {sidebarOpen && <span>{label}</span>}
                  </Link>
                </TooltipTrigger>
                {!sidebarOpen && <TooltipContent side="right">{label}</TooltipContent>}
              </Tooltip>
            );
          })}
        </nav>

        {/* Git Pull button */}
        <div className="px-2 py-2 border-t border-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleUpdate}
                disabled={updateStatus === 'loading'}
                className={cn(
                  'flex items-center gap-3 px-2 py-2 rounded-md text-xs w-full transition-colors',
                  updateStatus === 'done' && 'text-green-400',
                  updateStatus === 'uptodate' && 'text-muted-foreground',
                  updateStatus === 'error' && 'text-red-400',
                  updateStatus === 'idle' || updateStatus === 'loading'
                    ? 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    : ''
                )}
              >
                {updateStatus === 'loading' && <RefreshCw className="w-4 h-4 flex-shrink-0 animate-spin" />}
                {updateStatus === 'done' && <Check className="w-4 h-4 flex-shrink-0" />}
                {updateStatus === 'uptodate' && <Check className="w-4 h-4 flex-shrink-0" />}
                {updateStatus === 'error' && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                {(updateStatus === 'idle') && <RefreshCw className="w-4 h-4 flex-shrink-0" />}
                {sidebarOpen && (
                  <span>
                    {updateStatus === 'loading' && 'Pulling...'}
                    {updateStatus === 'done' && 'Updated!'}
                    {updateStatus === 'uptodate' && 'Up to date'}
                    {updateStatus === 'error' && 'Pull failed'}
                    {updateStatus === 'idle' && 'Pull from GitHub'}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            {!sidebarOpen && (
              <TooltipContent side="right">Pull from GitHub</TooltipContent>
            )}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
