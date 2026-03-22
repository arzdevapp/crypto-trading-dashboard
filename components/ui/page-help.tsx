'use client';
import { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface PageHelpProps {
  title: string;
  description: string;
  steps: { label: string; detail: string }[];
  tips?: string[];
}

export function PageHelp({ title, description, steps, tips }: PageHelpProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 flex-shrink-0"
        onClick={() => setOpen(true)}
        title="How to use this page"
      >
        <HelpCircle className="w-3.5 h-3.5" style={{ color: '#8B949E' }} />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden" style={{ background: '#0E1626', border: '1px solid #243044' }}>
          <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0" style={{ borderColor: '#243044', background: '#070B10' }}>
            <DialogTitle className="text-sm font-mono font-bold" style={{ color: '#00E5FF' }}>{title}</DialogTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
              <X className="w-3.5 h-3.5" style={{ color: '#8B949E' }} />
            </Button>
          </DialogHeader>

          <div className="px-4 py-3 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Description */}
            <p className="text-xs font-mono leading-relaxed" style={{ color: '#8B949E' }}>{description}</p>

            {/* Steps */}
            <div>
              <p className="text-[10px] font-mono font-bold tracking-widest uppercase mb-2" style={{ color: '#243044' }}>How to use</p>
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <div
                      className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-mono font-bold mt-0.5"
                      style={{ background: '#243044', color: '#00E5FF' }}
                    >
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-xs font-mono font-medium" style={{ color: '#C7D1DB' }}>{step.label}</p>
                      <p className="text-[11px] font-mono mt-0.5" style={{ color: '#8B949E' }}>{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            {tips && tips.length > 0 && (
              <div className="rounded-lg p-3" style={{ background: '#121C2F', border: '1px solid #243044' }}>
                <p className="text-[10px] font-mono font-bold tracking-widest uppercase mb-1.5" style={{ color: '#243044' }}>Tips</p>
                <ul className="space-y-1">
                  {tips.map((tip, i) => (
                    <li key={i} className="flex gap-2 text-[11px] font-mono" style={{ color: '#8B949E' }}>
                      <span style={{ color: '#00FF66' }}>·</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
