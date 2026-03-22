'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStrategies } from '@/hooks/useStrategies';
import { TIMEFRAMES } from '@/lib/constants';
import { toast } from 'sonner';
import type { BacktestMetrics } from '@/types/backtest';

export function BacktestForm({ onResult }: { onResult: (metrics: BacktestMetrics) => void }) {
  const { data: strategies = [] } = useStrategies();
  const [strategyId, setStrategyId] = useState('');
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [timeframe, setTimeframe] = useState('1d');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');
  const [capital, setCapital] = useState('10000');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strategyId) { toast.error('Select a strategy'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId, symbol, timeframe, startDate, endDate, initialCapital: parseFloat(capital) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onResult(data.metrics);
      toast.success('Backtest complete');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Run Backtest</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs">Strategy</Label>
            <Select value={strategyId} onValueChange={setStrategyId}>
              <SelectTrigger className="h-8 mt-1 text-xs">
                <SelectValue placeholder="Select strategy..." />
              </SelectTrigger>
              <SelectContent>
                {strategies.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Symbol</Label>
              <Input className="h-8 mt-1 text-xs" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
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
            <div>
              <Label className="text-xs">Start Date</Label>
              <Input className="h-8 mt-1 text-xs" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">End Date</Label>
              <Input className="h-8 mt-1 text-xs" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Initial Capital ($)</Label>
            <Input className="h-8 mt-1 text-xs" type="number" value={capital} onChange={(e) => setCapital(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading} size="sm" className="w-full">
            {loading ? 'Running...' : 'Run Backtest'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
