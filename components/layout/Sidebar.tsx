'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard, TrendingUp, Bot, FlaskConical, History, Settings, ChevronLeft, ChevronRight, Zap, Brain, Terminal, Flame, RefreshCw, Check, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TailscaleStatusDot } from '@/components/network/TailscaleWidget';

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

const COLLAPSED_WIDTH = 56;
const MIN_WIDTH = 100;
const MAX_WIDTH = 400;

type UpdateStatus = 'idle' | 'loading' | 'done' | 'uptodate' | 'error';

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, sidebarWidth, setSidebarWidth } = useStore();
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');

  const handleRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastX = useRef(0);

  // Labels visible when expanded and wide enough
  const expanded = sidebarOpen;
  const currentWidth = sidebarOpen ? sidebarWidth : COLLAPSED_WIDTH;

  useEffect(() => {
    const el = handleRef.current;
    if (!el) return;

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      lastX.current = e.clientX;
      el.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      if (delta === 0) return;

      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, sidebarWidth + delta));

      // If dragged below threshold while open, collapse
      if (newWidth < MIN_WIDTH - 10) {
        setSidebarOpen(false);
      } else {
        if (!sidebarOpen) setSidebarOpen(true);
        setSidebarWidth(newWidth);
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    document.addEventListener('pointerup', () => { dragging.current = false; });

    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarOpen, sidebarWidth]);

  const handleToggle = () => {
    if (sidebarOpen) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
      // Restore to at least MIN_WIDTH if saved width is too small
      if (sidebarWidth < MIN_WIDTH) setSidebarWidth(224);
    }
  };

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
      <aside
        className="hidden xl:flex flex-col border-r border-border bg-card h-full relative flex-shrink-0"
        style={{ width: currentWidth, transition: dragging.current ? 'none' : 'width 0.2s' }}
      >
        <div className="flex items-center h-14 px-3 border-b border-border overflow-hidden">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            {expanded && <span className="font-bold text-sm truncate">CryptoBot</span>}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={handleToggle}>
            {sidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </Button>
        </div>

        <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-hidden">
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
                    {expanded && <span className="truncate">{label}</span>}
                  </Link>
                </TooltipTrigger>
                {!expanded && <TooltipContent side="right">{label}</TooltipContent>}
              </Tooltip>
            );
          })}
        </nav>

        {/* Tailscale status */}
        <div className="px-2 border-t border-border overflow-hidden">
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <TailscaleStatusDot expanded={expanded} />
              </div>
            </TooltipTrigger>
            {!expanded && <TooltipContent side="right">Tailscale</TooltipContent>}
          </Tooltip>
        </div>

        {/* Git Pull button */}
        <div className="px-2 py-2 border-t border-border overflow-hidden">
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
                {expanded && (
                  <span className="truncate">
                    {updateStatus === 'loading' && 'Pulling...'}
                    {updateStatus === 'done' && 'Updated!'}
                    {updateStatus === 'uptodate' && 'Up to date'}
                    {updateStatus === 'error' && 'Pull failed'}
                    {updateStatus === 'idle' && 'Pull from GitHub'}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            {!expanded && (
              <TooltipContent side="right">Pull from GitHub</TooltipContent>
            )}
          </Tooltip>
        </div>

        {/* Drag handle on right edge */}
        <div
          ref={handleRef}
          className="absolute top-0 right-0 h-full group"
          style={{ width: 6, cursor: 'col-resize', touchAction: 'none', zIndex: 20 }}
        >
          {/* Visible line */}
          <div
            className="absolute top-0 bottom-0 transition-colors duration-150"
            style={{ left: 2, width: 2, background: '#1e2d45', borderRadius: 1 }}
          />
          {/* Hover highlight */}
          <div
            className="absolute top-0 bottom-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            style={{ left: 1, width: 4, background: '#3b82f680', borderRadius: 2 }}
          />
          {/* Drag dots */}
          <div
            className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col gap-[3px]"
            style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
          >
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#3b82f6' }} />
            ))}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
