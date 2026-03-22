'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateStrategy } from '@/hooks/useStrategies';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { STRATEGY_TYPES, TIMEFRAMES } from '@/lib/constants';

const STRATEGY_DEFAULTS: Record<string, Record<string, number | boolean | string>> = {
  MA_CROSSOVER: { fastPeriod: 9, slowPeriod: 21, useEMA: true, quantity: 0.001 },
  RSI: { period: 14, oversold: 30, overbought: 70, quantity: 0.001 },
  MACD: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, quantity: 0.001 },
  BOLLINGER: { period: 20, stdDev: 2, quantity: 0.001 },
  GRID: { lowerPrice: 0, upperPrice: 0, gridLevels: 10, quantity: 0.001 },
};

export function StrategyForm({ exchangeId }: { exchangeId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('MA_CROSSOVER');
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [config, setConfig] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(STRATEGY_DEFAULTS['MA_CROSSOVER']).map(([k, v]) => [k, String(v)]))
  );
  const { mutate: create, isPending } = useCreateStrategy();

  const handleTypeChange = (t: string) => {
    setType(t);
    setConfig(Object.fromEntries(Object.entries(STRATEGY_DEFAULTS[t] ?? {}).map(([k, v]) => [k, String(v)])));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedConfig: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(config)) {
      parsedConfig[k] = v === 'true' ? true : v === 'false' ? false : isNaN(Number(v)) ? v : Number(v);
    }
    create(
      { name, type, symbol, timeframe, config: parsedConfig, exchangeId },
      {
        onSuccess: () => { toast.success('Strategy created'); setOpen(false); },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> New Strategy</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Strategy</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input className="h-8 mt-1 text-xs" value={name} onChange={(e) => setName(e.target.value)} placeholder="My MA Strategy" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={handleTypeChange}>
                <SelectTrigger className="h-8 mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STRATEGY_TYPES.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Timeframe</Label>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="h-8 mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEFRAMES.map((tf) => <SelectItem key={tf} value={tf}>{tf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Symbol</Label>
            <Input className="h-8 mt-1 text-xs" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="BTC/USDT" />
          </div>
          <div>
            <Label className="text-xs mb-2 block">Parameters</Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(config).map((key) => (
                <div key={key}>
                  <Label className="text-[10px] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</Label>
                  <Input
                    className="h-7 mt-0.5 text-xs"
                    value={config[key]}
                    onChange={(e) => setConfig((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={isPending} size="sm" className="w-full">
            {isPending ? 'Creating...' : 'Create Strategy'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
