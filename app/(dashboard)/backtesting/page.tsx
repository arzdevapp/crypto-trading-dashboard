'use client';

import { useState } from 'react';
import { useStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Play, TrendingUp, AlertTriangle, Percent, ArrowRightLeft } from 'lucide-react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { BacktestMetrics } from '@/types/backtest';

export default function BacktestingPage() {
  const { activeExchangeId } = useStore();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BacktestMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  
  // Strategy Config
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [investmentPerTrade, setInvestmentPerTrade] = useState('142');
  const [tradeStartLevel, setTradeStartLevel] = useState('3');
  const [pmStartPct, setPmStartPct] = useState('5');
  const [maxDrawdownPct, setMaxDrawdownPct] = useState('25');
  const [dailyLossLimit, setDailyLossLimit] = useState('0');

  const runBacktest = async () => {
    if (!activeExchangeId) return;
    setRunning(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyType: 'POWER_TRADER',
          exchangeId: activeExchangeId,
          symbol,
          timeframe,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          initialCapital: 1000,
          config: {
            side,
            investmentPerTrade: Number(investmentPerTrade),
            tradeStartLevel: Number(tradeStartLevel),
            pmStartPct: Number(pmStartPct),
            pmStartPctDCA: Number(pmStartPct) / 2,
            maxDrawdownPct: Number(maxDrawdownPct),
            dailyLossLimit: Number(dailyLossLimit),
          }
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Backtest failed');
      setResults(data.metrics);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const chartData = results?.equityCurve.map(p => ({
    date: format(new Date(p.timestamp), 'MM/dd HH:mm'),
    equity: p.equity
  })) || [];

  if (!activeExchangeId) {
    return (
      <div className="h-full flex items-center justify-center bg-[#070B10]">
        <p className="text-sm font-mono text-[#8B949E]">SELECT AN EXCHANGE TO USE THE BACKTESTER</p>
      </div>
    );
  }

  return (
    <div className="h-full flex text-white relative">
      {/* Sidebar Configuration */}
      <div className="w-[280px] flex-shrink-0 bg-[#0A1018] border-r border-[#1a2538] flex flex-col z-10">
        <div className="px-4 py-4 border-b border-[#1a2538] flex flex-col justify-center">
          <h2 className="text-sm font-mono font-bold tracking-tight text-[#E6EDF3]">Backtester Simulator</h2>
          <p className="text-[10px] text-[#8B949E] mt-1 line-clamp-1">Simulate strategies on historical data</p>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-4">
          {error && (
            <div className="p-2 bg-red-500/10 border border-red-500/50 rounded text-red-500 text-[10px] font-mono whitespace-pre-wrap">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div className="text-[9px] font-mono uppercase tracking-widest text-[#6b7280]">Market Data</div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] font-mono text-[#9ca3af]">Symbol</Label>
                <Input className="h-7 mt-1 text-xs font-mono" value={symbol} onChange={e => setSymbol(e.target.value)} />
              </div>
              <div>
                <Label className="text-[10px] font-mono text-[#9ca3af]">Interval</Label>
                <select 
                  className="w-full h-7 mt-1 text-xs font-mono bg-transparent border rounded"
                  style={{ borderColor: '#1e2d45', color: '#c7d1db' }}
                  value={timeframe} onChange={e => setTimeframe(e.target.value)}
                >
                  <option value="15m" className="bg-[#0f172a]">15m</option>
                  <option value="1h" className="bg-[#0f172a]">1h</option>
                  <option value="4h" className="bg-[#0f172a]">4h</option>
                  <option value="1d" className="bg-[#0f172a]">1d</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] font-mono text-[#9ca3af]">Start Date</Label>
                <Input type="date" className="h-7 mt-1 text-[10px] font-mono" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-[10px] font-mono text-[#9ca3af]">End Date</Label>
                <Input type="date" className="h-7 mt-1 text-[10px] font-mono" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-[#1a2538]">
            <div className="text-[9px] font-mono uppercase tracking-widest text-[#6b7280]">Strategy Config</div>
            
            <div className="grid grid-cols-2 gap-1 mb-2">
              {(['long', 'short'] as const).map(s => {
                const active = side === s;
                const color = s === 'long' ? '#00FF66' : '#ef4444';
                return (
                  <button
                    key={s} onClick={() => setSide(s)}
                    className="py-1.5 rounded text-[10px] font-mono font-bold transition-all uppercase"
                    style={{
                      background: active ? `${color}15` : '#0d1220',
                      border: `1px solid ${active ? `${color}60` : '#1e2d45'}`,
                      color: active ? color : '#4b5563',
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>

            <div>
              <Label className="text-[10px] font-mono text-[#9ca3af]">Initial Capital ($)</Label>
              <Input className="h-7 mt-1 text-xs font-mono" value="1000" disabled />
            </div>

            <div>
              <Label className="text-[10px] font-mono text-[#9ca3af]">Investment per Trade ({side === 'short' ? symbol.split('/')[0] : '$'})</Label>
              <Input className="h-7 mt-1 text-xs font-mono" type="number" value={investmentPerTrade} onChange={e => setInvestmentPerTrade(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] font-mono text-[#9ca3af]">Entry Level</Label>
                <Input className="h-7 mt-1 text-xs font-mono" type="number" value={tradeStartLevel} onChange={e => setTradeStartLevel(e.target.value)} />
              </div>
              <div>
                <Label className="text-[10px] font-mono text-[#9ca3af]">Take Profit %</Label>
                <Input className="h-7 mt-1 text-xs font-mono" type="number" step="0.5" value={pmStartPct} onChange={e => setPmStartPct(e.target.value)} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div>
                <Label className="text-[10px] font-mono text-[#ef4444]">Drawdown Limit %</Label>
                <Input className="h-7 mt-1 text-xs font-mono border-red-900" type="number" value={maxDrawdownPct} onChange={e => setMaxDrawdownPct(e.target.value)} />
              </div>
              <div>
                <Label className="text-[10px] font-mono text-[#ef4444]">Daily Loss $</Label>
                <Input className="h-7 mt-1 text-xs font-mono border-red-900" type="number" value={dailyLossLimit} onChange={e => setDailyLossLimit(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 border-t bg-[#0a0f18] border-[#1a2538]">
          <Button 
            onClick={runBacktest} 
            disabled={running}
            className="w-full h-8 text-xs font-mono bg-[#1E3A8A] hover:bg-[#2563EB] text-white"
          >
            {running ? 'Simulating...' : <><Play className="w-3 h-3 mr-2" /> RUN BACKTEST</>}
          </Button>
        </div>
      </div>

      {/* Main Content - Results */}
      <div className="flex-1 overflow-auto bg-[#070B10] p-6">
        {!results && !running && (
          <div className="h-full flex flex-col items-center justify-center text-[#8B949E] space-y-4">
            <TrendingUp className="w-12 h-12 opacity-20" />
            <p className="text-sm font-mono">Run a simulation to view performance metrics</p>
          </div>
        )}

        {running && (
          <div className="h-full flex flex-col items-center justify-center text-[#8B949E] space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="text-sm font-mono animate-pulse">Running Simulation...</p>
          </div>
        )}

        {results && !running && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <MetricCard title="Total Return" value={`$${results.totalReturn.toFixed(2)}`} sub={`${results.totalReturnPct.toFixed(2)}%`} icon={<Percent />} positive={results.totalReturn >= 0} />
              <MetricCard title="Win Rate" value={`${results.winRate.toFixed(1)}%`} sub={`${results.winningTrades}W / ${results.losingTrades}L`} icon={<TrendingUp />} positive={results.winRate > 50} />
              <MetricCard title="Max Drawdown" value={`-${results.maxDrawdownPct.toFixed(1)}%`} sub={`-$${results.maxDrawdown.toFixed(2)}`} icon={<AlertTriangle />} positive={false} />
              <MetricCard title="Total Trades" value={results.totalTrades.toString()} sub={`Avg P&L: $${((results.avgWin + results.avgLoss)/2).toFixed(2)}`} icon={<ArrowRightLeft />} positive={true} />
            </div>

            <Card className="bg-[#0A1018] border-[#1a2538]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono text-white">Equity Curve</CardTitle>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <YAxis 
                      domain={['auto', 'auto']} 
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      tickFormatter={(v) => `$${v.toFixed(0)}`}
                      orientation="right"
                    />
                    <Tooltip
                      contentStyle={{ background: '#0E1626', border: '1px solid #243044', borderRadius: 6 }}
                      labelStyle={{ color: '#a1a1aa', fontSize: 11 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="equity" 
                      stroke={results.totalReturn >= 0 ? '#10b981' : '#ef4444'} 
                      strokeWidth={2} 
                      dot={false}
                      animationDuration={1500}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-[#0A1018] border-[#1a2538] p-4">
                <h3 className="text-xs font-mono uppercase text-[#6b7280] mb-3">Profitability Metrics</h3>
                <div className="space-y-2">
                  <StatRow label="Gross Profit" value={`$${results.trades.filter(t => t.pnl > 0).reduce((s,t) => s+t.pnl, 0).toFixed(2)}`} color="#10b981" />
                  <StatRow label="Gross Loss" value={`$${Math.abs(results.trades.filter(t => t.pnl < 0).reduce((s,t) => s+t.pnl, 0)).toFixed(2)}`} color="#ef4444" />
                  <StatRow label="Profit Factor" value={results.profitFactor.toFixed(2)} color={results.profitFactor > 1.5 ? "#10b981" : "#f59e0b"} />
                  <StatRow label="Expectancy" value={`$${results.expectancy.toFixed(2)}`} color={results.expectancy > 0 ? "#10b981" : "#ef4444"} />
                  <StatRow label="Sharpe Ratio" value={results.sharpeRatio.toFixed(2)} color="#c7d1db" />
                </div>
              </Card>

              <Card className="bg-[#0A1018] border-[#1a2538] p-4">
                <h3 className="text-xs font-mono uppercase text-[#6b7280] mb-3">Trade Metrics</h3>
                <div className="space-y-2">
                  <StatRow label="Best Trade" value={`+${results.bestTrade.toFixed(2)}%`} color="#10b981" />
                  <StatRow label="Worst Trade" value={`${results.worstTrade.toFixed(2)}%`} color="#ef4444" />
                  <StatRow label="Average Win" value={`$${results.avgWin.toFixed(2)}`} color="#10b981" />
                  <StatRow label="Average Loss" value={`-$${results.avgLoss.toFixed(2)}`} color="#ef4444" />
                  <StatRow label="Ending Capital" value={`$${results.finalCapital.toFixed(2)}`} color="#c7d1db" />
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ title, value, sub, icon, positive }: { title: string, value: string, sub: string, icon: React.ReactNode, positive: boolean }) {
  const color = positive ? 'text-[#10b981]' : 'text-[#ef4444]';
  return (
    <Card className="bg-[#0A1018] border-[#1a2538]">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-[#6b7280] mb-1">{title}</p>
          <div className={`text-xl font-mono font-bold ${title === 'Total Trades' ? 'text-white' : color}`}>
            {value}
          </div>
          <p className="text-[10px] font-mono text-[#8B949E] mt-1">{sub}</p>
        </div>
        <div className="w-8 h-8 rounded bg-[#1a2538] flex items-center justify-center text-[#8B949E]">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function StatRow({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="flex justify-between items-center text-xs font-mono border-b border-[#1a2538] pb-1">
      <span className="text-[#8B949E]">{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}
