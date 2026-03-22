'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { STRATEGY_TYPES, TIMEFRAMES } from '@/lib/constants';

interface Exchange {
  id: string;
  label: string;
  name: string;
}

interface CreateStrategyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateStrategyDialog({ open, onOpenChange }: CreateStrategyDialogProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    type: '',
    symbol: 'BTC/USDT',
    timeframe: '1h',
    exchangeId: '',
    quantity: '0.001',
    stopLossPct: '2',
    takeProfitPct: '4',
  });

  const { data: exchanges = [] } = useQuery<Exchange[]>({
    queryKey: ['exchanges'],
    queryFn: () => fetch('/api/exchanges').then((r) => r.json()),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          type: data.type,
          symbol: data.symbol,
          timeframe: data.timeframe,
          exchangeId: data.exchangeId,
          config: {
            quantity: parseFloat(data.quantity),
            stopLossPct: parseFloat(data.stopLossPct),
            takeProfitPct: parseFloat(data.takeProfitPct),
          },
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to create');
        return r.json();
      }),
    onSuccess: () => {
      toast.success('Strategy created');
      qc.invalidateQueries({ queryKey: ['strategies'] });
      onOpenChange(false);
      setForm({ name: '', type: '', symbol: 'BTC/USDT', timeframe: '1h', exchangeId: '', quantity: '0.001', stopLossPct: '2', takeProfitPct: '4' });
    },
    onError: (e) => toast.error(e.message),
  });

  const set = (key: keyof typeof form) => (val: string) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">New Strategy</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-zinc-300 text-xs">Name</Label>
            <Input
              value={form.name}
              onChange={(e) => set('name')(e.target.value)}
              placeholder="e.g. BTC RSI Bot"
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">Strategy Type</Label>
              <Select value={form.type} onValueChange={set('type')}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {STRATEGY_TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-zinc-100 focus:bg-zinc-700">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">Exchange</Label>
              <Select value={form.exchangeId} onValueChange={set('exchangeId')}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                  <SelectValue placeholder={exchanges.length === 0 ? 'No exchanges' : 'Select'} />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {exchanges.map((ex) => (
                    <SelectItem key={ex.id} value={ex.id} className="text-zinc-100 focus:bg-zinc-700">
                      {ex.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">Symbol</Label>
              <Input
                value={form.symbol}
                onChange={(e) => set('symbol')(e.target.value)}
                placeholder="BTC/USDT"
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">Timeframe</Label>
              <Select value={form.timeframe} onValueChange={set('timeframe')}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {TIMEFRAMES.map((tf) => (
                    <SelectItem key={tf} value={tf} className="text-zinc-100 focus:bg-zinc-700">
                      {tf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">Quantity</Label>
              <Input
                value={form.quantity}
                onChange={(e) => set('quantity')(e.target.value)}
                type="number"
                step="0.001"
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">Stop Loss %</Label>
              <Input
                value={form.stopLossPct}
                onChange={(e) => set('stopLossPct')(e.target.value)}
                type="number"
                step="0.1"
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">Take Profit %</Label>
              <Input
                value={form.takeProfitPct}
                onChange={(e) => set('takeProfitPct')(e.target.value)}
                type="number"
                step="0.1"
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
            </div>
          </div>

          {exchanges.length === 0 && (
            <p className="text-xs text-amber-400 bg-amber-950/30 border border-amber-800 rounded-md px-3 py-2">
              Add an exchange in Settings before creating a strategy.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-zinc-400 hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button
              onClick={() => mutation.mutate(form)}
              disabled={!form.name || !form.type || !form.exchangeId || mutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {mutation.isPending ? 'Creating…' : 'Create Strategy'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
