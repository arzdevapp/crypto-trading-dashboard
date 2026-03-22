'use client';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { Button } from '@/components/ui/button';
import { navItems } from './Sidebar';

export function MobileMenu() {
  const pathname = usePathname();
  const { mobileMenuOpen, setMobileMenuOpen } = useStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !mobileMenuOpen) return null;

  return createPortal(
    <div className="xl:hidden" style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999 }}
        onClick={() => setMobileMenuOpen(false)}
      />
      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '16rem',
          maxWidth: 'calc(100% - 2rem)',
          zIndex: 10000,
          background: '#0E1626',
          borderRight: '1px solid #243044',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="flex items-center h-14 px-3" style={{ borderBottom: '1px solid #243044' }}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm" style={{ color: '#C7D1DB' }}>CryptoBot</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => setMobileMenuOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-2 py-2.5 rounded-md text-sm transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>,
    document.body
  );
}
