'use client';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PriceChart, type ActiveIndicators } from '@/components/charts/PriceChart';
import { NeuralLevelsOverlay } from '@/components/charts/NeuralLevelsOverlay';
import { SymbolSelector } from '@/components/trading/SymbolSelector';
import { useStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Brain, RefreshCw, Zap, Square, Activity, Eye, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { NewsSentimentWidget } from '@/components/news/NewsSentimentWidget';
import { HorizontalSplit, VerticalSplit } from '@/components/ui/resizable';
import { PageHelp } from '@/components/ui/page-help';
import { formatCurrency, formatCrypto, formatPercent } from '@/lib/utils';

interface BotStatus {
  running: boolean;
  strategy: { id: string; name: string; status: string; timeframe: string; config: Record<string, unknown> } | null;
  lastSignal: { action: string; quantity?: number; price?: number; reason?: string } | null;
  error: string | null;
  currentPrice: number;
  powerState: {
    inPosition: boolean;
    avgCostBasis: number;
    positionSize: number;
    dcaStage: number;
    dcaCount: number;
    trailingPMLine: number;
    pmActive: boolean;
    lastSignalLevel: number;
  } | null;
}

interface BotListItem {
  id: string;
  symbol: string;
  timeframe: string;
  status: string;
  running: boolean;
  lastSignal: { action: string; reason?: string } | null;
  error: string | null;
  powerState: BotStatus['powerState'];
  config: Record<string, unknown>;
  createdAt: string;
}

// Signal strength bar: filled segments 0–7
function SignalBar({ count, max = 7, color, label }: { count: number; max?: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono w-10 text-right flex-shrink-0" style={{ color }}>{label}</span>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className="rounded-sm transition-all duration-300"
            style={{
              width: 10,
              height: i < count ? 16 - (max - 1 - i) : 12,
              background: i < count ? color : '#1e2d45',
              opacity: i < count ? 1 : 0.4,
              boxShadow: i < count && i === count - 1 ? `0 0 6px ${color}` : 'none',
            }}
          />
        ))}
      </div>
      <span className="text-[10px] font-mono font-bold" style={{ color: count > 0 ? color : '#4a5568' }}>
        {count > 0 ? `${count}/${max}` : '—'}
      </span>
    </div>
  );
}

// DCA stage progress track
function DcaTrack({ stage, max = 7, active }: { stage: number; max?: number; active: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < stage;
        const isCurrent = i === stage - 1;
        return (
          <div
            key={i}
            className="rounded-sm transition-all duration-300"
            style={{
              flex: 1,
              height: 6,
              background: filled
                ? isCurrent && active ? '#f97316' : '#3b82f6'
                : '#1e2d45',
              boxShadow: isCurrent && active ? '0 0 8px #f97316' : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

export default function DCABotPage() {
  const { activeExchangeId, selectedSymbol, setSelectedSymbol } = useStore();
  const [longLevels, setLongLevels] = useState<number[]>([]);
  const [shortLevels, setShortLevels] = useState<number[]>([]);
  const [timeframe, setTimeframe] = useState('1h');
  const [tradeStartLevel, setTradeStartLevel] = useState('3');
  const [quantity, setQuantity] = useState('0.001');
  const [pmStartPct, setPmStartPct] = useState('5');
  const [indicators, setIndicators] = useState<ActiveIndicators>({});
  const queryClient = useQueryClient();

  const handleLevelsUpdate = useCallback((long: number[], short: number[]) => {
    setLongLevels(long);
    setShortLevels(short);
  }, []);

  // Poll current bot status
  const { data: botStatus } = useQuery<BotStatus>({
    queryKey: ['dca-bot', activeExchangeId, selectedSymbol],
    queryFn: () => fetch(`/api/dca-bot?exchangeId=${activeExchangeId}&symbol=${encodeURIComponent(selectedSymbol)}`).then(r => r.json()),
    enabled: !!activeExchangeId,
    refetchInterval: 5000,
    staleTime: 4000,
  });

  // Poll all bots list
  const { data: allBotsData } = useQuery<{ bots: BotListItem[] }>({
    queryKey: ['dca-bot-list', activeExchangeId],
    queryFn: () => fetch(`/api/dca-bot?exchangeId=${activeExchangeId}&all=1`).then(r => r.json()),
    enabled: !!activeExchangeId,
    refetchInterval: 5000,
    staleTime: 4000,
  });
  const allBots = allBotsData?.bots ?? [];

  // Train
  const { mutate: trainModel, isPending: training } = useMutation({
    mutationFn: async () => {
      if (!activeExchangeId) throw new Error('No exchange selected');
      const res = await fetch('/api/ml/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchangeId: activeExchangeId, symbol: selectedSymbol }),
      });
      if (!res.ok) throw new Error('Training failed');
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Model trained: ${data.message}`);
      queryClient.invalidateQueries({ queryKey: ['dca-bot'] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  // Start
  const { mutate: startBot, isPending: starting } = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/dca-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          exchangeId: activeExchangeId,
          symbol: selectedSymbol,
          timeframe,
          config: {
            tradeStartLevel: Number(tradeStartLevel),
            quantity: Number(quantity),
            pmStartPct: Number(pmStartPct),
            pmStartPctDCA: Number(pmStartPct) / 2,
          },
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      toast.success('DCA Bot started');
      queryClient.invalidateQueries({ queryKey: ['dca-bot'] });
      queryClient.invalidateQueries({ queryKey: ['dca-bot-list'] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  // Stop (by symbol or by strategyId)
  const { mutate: stopBot, isPending: stopping } = useMutation({
    mutationFn: async (targetSymbol?: string) => {
      const sym = targetSymbol ?? selectedSymbol;
      const res = await fetch('/api/dca-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop', exchangeId: activeExchangeId, symbol: sym }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      toast.success('DCA Bot stopped');
      queryClient.invalidateQueries({ queryKey: ['dca-bot'] });
      queryClient.invalidateQueries({ queryKey: ['dca-bot-list'] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  // Delete bot
  const { mutate: deleteBot } = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/strategies/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      toast.success('Bot removed');
      queryClient.invalidateQueries({ queryKey: ['dca-bot'] });
      queryClient.invalidateQueries({ queryKey: ['dca-bot-list'] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  if (!activeExchangeId) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: '#070B10' }}>
        <p className="text-sm font-mono" style={{ color: '#8B949E' }}>SELECT AN EXCHANGE TO USE THE DCA BOT</p>
      </div>
    );
  }

  const ps = botStatus?.powerState;
  const running = botStatus?.running ?? false;
  const currentPrice = botStatus?.currentPrice ?? 0;
  const pnl = ps?.inPosition && (ps?.avgCostBasis ?? 0) > 0
    ? (currentPrice - ps.avgCostBasis) * ps.positionSize : 0;
  const pnlPct = (ps?.avgCostBasis ?? 0) > 0
    ? ((currentPrice - (ps?.avgCostBasis ?? 0)) / (ps?.avgCostBasis ?? 1)) * 100 : 0;
  const positionValue = ps?.inPosition ? (ps.positionSize * currentPrice) : 0;
  const costBasisValue = ps?.inPosition ? (ps.positionSize * ps.avgCostBasis) : 0;

  const longSignalCount = longLevels.length;
  const shortSignalCount = shortLevels.length;

  const sidebarContent = (
      <div className="flex flex-col gap-0 h-full overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0" style={{ borderColor: '#1a2538', background: '#070B10' }}>
          <div className="flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[11px] font-mono font-bold tracking-widest uppercase" style={{ color: '#00E5FF' }}>DCA Bot</span>
            <PageHelp
              title="DCA Bot"
              description="Automated DCA bot powered by a kNN neural model. Run multiple instances on different symbols simultaneously."
              steps={[
                { label: 'Train the model', detail: 'Click Train to build pattern memory for the selected symbol.' },
                { label: 'Configure & Start', detail: 'Set params and click START BOT.' },
                { label: 'Monitor active bots', detail: 'The Active Bots panel shows all running instances.' },
                { label: 'Stop a bot', detail: 'Click STOP on any active bot.' },
              ]}
              tips={[
                'You can run multiple bots on different symbols at the same time.',
                'Each bot is independent — different symbols, timeframes, and settings.',
                'The bot places REAL orders. Use Testnet first.',
              ]}
            />
          </div>
          <Button
            size="sm" variant="ghost"
            className="h-6 px-2 text-[10px] gap-1"
            onClick={() => trainModel()}
            disabled={training || running}
          >
            {training ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            {training ? 'Training…' : 'Train'}
          </Button>
        </div>

        {/* Symbol selector */}
        <div className="px-3 py-2 border-b flex-shrink-0" style={{ borderColor: '#1a2538' }}>
          <div className="text-[9px] font-mono uppercase tracking-widest mb-1.5" style={{ color: '#6b7280' }}>Market</div>
          <SymbolSelector exchangeId={activeExchangeId} value={selectedSymbol} onChange={setSelectedSymbol} />
        </div>

        {/* Bot settings */}
        <div className="px-3 py-3 border-b flex-shrink-0 space-y-3" style={{ borderColor: '#1a2538' }}>
          <div className="text-[9px] font-mono uppercase tracking-widest" style={{ color: '#6b7280' }}>Bot Configuration</div>

          <div>
            <Label className="text-[10px] font-mono" style={{ color: '#9ca3af' }}>Candle Interval</Label>
            <select
              value={timeframe}
              onChange={e => setTimeframe(e.target.value)}
              disabled={running}
              className="w-full mt-1 h-7 text-xs font-mono rounded border px-2"
              style={{ background: '#121C2F', borderColor: '#243044', color: '#C7D1DB' }}
            >
              {['1m','5m','15m','1h','4h'].map(tf => <option key={tf} value={tf}>{tf}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-mono" style={{ color: '#9ca3af' }}>Entry Signal Strength</Label>
              <span className="text-[9px] font-mono" style={{ color: '#6b7280' }}>1–7 (higher = stricter)</span>
            </div>
            <Input
              className="h-7 mt-1 text-xs"
              type="number" min="1" max="7"
              value={tradeStartLevel}
              onChange={e => setTradeStartLevel(e.target.value)}
              disabled={running}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-mono" style={{ color: '#9ca3af' }}>Order Size</Label>
              <span className="text-[9px] font-mono" style={{ color: '#6b7280' }}>{selectedSymbol.split('/')[0]}</span>
            </div>
            <Input
              className="h-7 mt-1 text-xs font-mono"
              type="number" step="0.0001"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              disabled={running}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-mono" style={{ color: '#9ca3af' }}>Take Profit %</Label>
              <span className="text-[9px] font-mono" style={{ color: '#6b7280' }}>trailing after hit</span>
            </div>
            <Input
              className="h-7 mt-1 text-xs font-mono"
              type="number" step="0.5"
              value={pmStartPct}
              onChange={e => setPmStartPct(e.target.value)}
              disabled={running}
            />
          </div>
        </div>

        {/* Chart Indicators */}
        <div className="px-3 py-3 border-b flex-shrink-0 space-y-2" style={{ borderColor: '#1a2538' }}>
          <div className="text-[9px] font-mono uppercase tracking-widest" style={{ color: '#6b7280' }}>Chart Indicators</div>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              { key: 'ema9', label: 'EMA 9', color: '#f59e0b' },
              { key: 'ema21', label: 'EMA 21', color: '#8b5cf6' },
              { key: 'sma50', label: 'SMA 50', color: '#06b6d4' },
              { key: 'sma200', label: 'SMA 200', color: '#ec4899' },
              { key: 'bollinger', label: 'Bollinger', color: '#6366f1' },
            ] as const).map(({ key, label, color }) => {
              const active = !!indicators[key];
              return (
                <button
                  key={key}
                  onClick={() => setIndicators(prev => ({ ...prev, [key]: !prev[key] }))}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-mono font-bold transition-all"
                  style={{
                    background: active ? `${color}20` : '#0d1220',
                    border: `1px solid ${active ? `${color}60` : '#1e2d45'}`,
                    color: active ? color : '#4b5563',
                  }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ background: active ? color : '#1e2d45' }}
                  />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Start / Stop */}
        <div className="px-3 py-3 border-b flex-shrink-0" style={{ borderColor: '#1a2538' }}>
          {running ? (
            <Button
              className="w-full h-9 font-mono text-xs font-bold gap-2"
              style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}
              onClick={() => stopBot(selectedSymbol)}
              disabled={stopping}
            >
              {stopping ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
              {stopping ? 'STOPPING…' : 'STOP BOT'}
            </Button>
          ) : (
            <Button
              className="w-full h-9 font-mono text-xs font-bold gap-2"
              style={{ background: '#00FF6620', color: '#00FF66', border: '1px solid #00FF6640' }}
              onClick={() => startBot()}
              disabled={starting || training}
            >
              {starting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
              {starting ? 'STARTING…' : 'START BOT'}
            </Button>
          )}
        </div>

        {/* News Sentiment */}
        <div className="flex-shrink-0">
          <NewsSentimentWidget symbol={selectedSymbol} />
        </div>

        {/* Active Bots Panel */}
        <div className="flex-shrink-0 border-t" style={{ borderColor: '#1a2538' }}>
          <div className="px-3 py-2 flex items-center justify-between border-b" style={{ borderColor: '#1a2538', background: '#070B10' }}>
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase" style={{ color: '#9ca3af' }}>Active Bots</span>
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold"
              style={{
                background: allBots.filter(b => b.running).length > 0 ? '#00FF6615' : '#1a2538',
                color: allBots.filter(b => b.running).length > 0 ? '#00FF66' : '#6b7280',
              }}
            >
              {allBots.filter(b => b.running).length} running
            </span>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {allBots.length === 0 ? (
              <div className="px-3 py-5 text-center">
                <p className="text-[10px] font-mono" style={{ color: '#6b7280' }}>No bots created yet</p>
                <p className="text-[9px] font-mono mt-1" style={{ color: '#374151' }}>Select a symbol and click START BOT</p>
              </div>
            ) : (
              allBots.map(bot => (
                <BotRow
                  key={bot.id}
                  bot={bot}
                  isSelected={bot.symbol === selectedSymbol}
                  onView={() => setSelectedSymbol(bot.symbol)}
                  onStop={() => stopBot(bot.symbol)}
                  onDelete={() => {
                    if (confirm(`Delete ${bot.symbol} bot?`)) deleteBot(bot.id);
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>
  );

  // ── Ticker bar (shared between chart and position panel) ──
  const tickerBar = (
    <div className="flex items-center gap-4 px-4 py-2 border-b flex-shrink-0 flex-wrap gap-y-1" style={{ borderColor: '#1a2538', background: '#070B10' }}>
      <div className="flex items-center gap-2">
        <span className="text-base font-mono font-bold" style={{ color: '#E6EDF3' }}>
          {currentPrice > 0 ? formatCurrency(currentPrice) : '—'}
        </span>
        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: '#1a2538', color: '#9ca3af' }}>
          {selectedSymbol}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full" style={{ background: running ? '#00FF66' : '#374151', boxShadow: running ? '0 0 6px #00FF66' : 'none' }} />
        <span className="text-[10px] font-mono font-bold" style={{ color: running ? '#00FF66' : '#6b7280' }}>
          {running ? 'RUNNING' : 'STOPPED'}
        </span>
      </div>
      {ps?.inPosition ? (
        <div className="flex items-center gap-3 ml-2">
          <span className="text-[10px] font-mono" style={{ color: '#6b7280' }}>IN POSITION</span>
          <span className="text-[10px] font-mono font-bold" style={{ color: pnl >= 0 ? '#00FF66' : '#ef4444' }}>
            {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)} ({pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
          </span>
        </div>
      ) : running ? (
        <span className="text-[10px] font-mono" style={{ color: '#6b7280' }}>waiting for entry signal…</span>
      ) : null}
      {botStatus?.lastSignal && (
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[9px] font-mono" style={{ color: '#6b7280' }}>LAST SIGNAL</span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded" style={{
            background: botStatus.lastSignal.action === 'buy' ? '#00FF6615' : botStatus.lastSignal.action === 'sell' ? '#ef444415' : '#1a2538',
            color: botStatus.lastSignal.action === 'buy' ? '#00FF66' : botStatus.lastSignal.action === 'sell' ? '#ef4444' : '#6b7280',
          }}>
            {botStatus.lastSignal.action.toUpperCase()}
          </span>
          {botStatus.lastSignal.reason && (
            <span className="text-[9px] font-mono" style={{ color: '#6b7280' }}>{botStatus.lastSignal.reason}</span>
          )}
        </div>
      )}
      {botStatus?.error && (
        <span className="text-[10px] font-mono ml-auto" style={{ color: '#ef4444' }}>⚠ {botStatus.error}</span>
      )}
    </div>
  );

  // ── Position dashboard panel ──
  const positionPanel = (
    <div className="h-full overflow-auto border-t" style={{ borderColor: '#1a2538' }}>
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0" style={{ borderColor: '#1a2538', background: '#0A1220' }}>
        <div className="px-4 py-3" style={{ borderColor: '#1a2538' }}>
          <div className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: '#6b7280' }}>Current Price</div>
          <div className="text-sm font-mono font-bold" style={{ color: '#E6EDF3' }}>
            {currentPrice > 0 ? formatCurrency(currentPrice) : '—'}
          </div>
          {ps?.inPosition && ps.avgCostBasis > 0 && (
            <div className="text-[9px] font-mono mt-0.5" style={{ color: '#6b7280' }}>
              Avg entry: <span style={{ color: '#9ca3af' }}>{formatCurrency(ps.avgCostBasis)}</span>
            </div>
          )}
        </div>
        <div className="px-4 py-3" style={{ borderColor: '#1a2538' }}>
          <div className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: '#6b7280' }}>Position Size</div>
          <div className="text-sm font-mono font-bold" style={{ color: ps?.inPosition ? '#C7D1DB' : '#374151' }}>
            {ps?.inPosition ? formatCrypto(ps.positionSize, 6) : '—'}
          </div>
          {ps?.inPosition && (
            <div className="text-[9px] font-mono mt-0.5" style={{ color: '#6b7280' }}>
              Value: <span style={{ color: '#9ca3af' }}>{formatCurrency(positionValue)}</span>
              {' · '}Cost: <span style={{ color: '#9ca3af' }}>{formatCurrency(costBasisValue)}</span>
            </div>
          )}
        </div>
        <div className="px-4 py-3" style={{ borderColor: '#1a2538' }}>
          <div className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: '#6b7280' }}>Unrealised P&L</div>
          {ps?.inPosition ? (
            <>
              <div className="flex items-center gap-1.5">
                {pnl > 0 ? <TrendingUp className="w-4 h-4" style={{ color: '#00FF66' }} /> :
                 pnl < 0 ? <TrendingDown className="w-4 h-4" style={{ color: '#ef4444' }} /> :
                 <Minus className="w-4 h-4" style={{ color: '#6b7280' }} />}
                <span className="text-sm font-mono font-bold" style={{ color: pnl >= 0 ? '#00FF66' : '#ef4444' }}>
                  {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                </span>
              </div>
              <div className="text-[9px] font-mono mt-0.5 font-bold" style={{ color: pnlPct >= 0 ? '#00FF66' : '#ef4444' }}>
                {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
              </div>
            </>
          ) : (
            <div className="text-sm font-mono font-bold" style={{ color: '#374151' }}>—</div>
          )}
        </div>
        <div className="px-4 py-3" style={{ borderColor: '#1a2538' }}>
          <div className="flex items-center justify-between mb-1">
            <div className="text-[9px] font-mono uppercase tracking-widest" style={{ color: '#6b7280' }}>DCA Progress</div>
            {ps && ps.dcaStage > 0 && (
              <span className="text-[9px] font-mono font-bold" style={{ color: '#9ca3af' }}>{ps.dcaStage}/7</span>
            )}
          </div>
          <DcaTrack stage={ps?.dcaStage ?? 0} active={ps?.inPosition ?? false} />
          <div className="text-[9px] font-mono mt-1.5" style={{ color: '#6b7280' }}>
            {ps?.pmActive
              ? <span style={{ color: '#00FF66' }}>Trailing TP @ {formatCurrency(ps.trailingPMLine)}</span>
              : ps?.inPosition
                ? <span style={{ color: '#9ca3af' }}>Waiting for profit margin</span>
                : <span style={{ color: '#374151' }}>No open position</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-6 px-4 py-3 border-t flex-wrap" style={{ borderColor: '#1a2538', background: '#070B10' }}>
        <div className="text-[9px] font-mono uppercase tracking-widest" style={{ color: '#6b7280' }}>Neural Signals</div>
        <SignalBar count={longSignalCount} color="#3b82f6" label="LONG" />
        <SignalBar count={shortSignalCount} color="#f97316" label="SHORT" />
        {running && (
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#00FF66' }} />
            <span className="text-[9px] font-mono" style={{ color: '#00FF66' }}>LIVE</span>
          </div>
        )}
      </div>
    </div>
  );

  const rightContent = (
    <div className="flex flex-col h-full min-w-0">
      {tickerBar}
      <VerticalSplit
        className="flex-1 min-h-0"
        defaultBottomHeight={180}
        minBottom={100}
        maxBottom={350}
        top={
          <div className="h-full">
            <PriceChart
              exchangeId={activeExchangeId}
              symbol={selectedSymbol}
              longLevels={longLevels}
              shortLevels={shortLevels}
              indicators={indicators}
              overlay={
                <NeuralLevelsOverlay
                  exchangeId={activeExchangeId}
                  symbol={selectedSymbol}
                  onLevelsUpdate={handleLevelsUpdate}
                />
              }
            />
          </div>
        }
        bottom={positionPanel}
      />
    </div>
  );

  return (
    <div className="h-full" style={{ background: '#070B10' }}>
      {/* Mobile: stacked, scrollable */}
      <div className="xl:hidden h-full overflow-y-auto flex flex-col gap-0">
        {sidebarContent}
        {rightContent}
      </div>

      {/* Desktop: resizable horizontal split */}
      <div className="hidden xl:block h-full">
        <HorizontalSplit
          className="h-full"
          defaultLeftWidth={240}
          minLeft={200}
          maxLeft={420}
          left={sidebarContent}
          right={rightContent}
        />
      </div>
    </div>
  );
}

/* ── Active bot row ── */
function BotRow({ bot, isSelected, onView, onStop, onDelete }: {
  bot: BotListItem;
  isSelected: boolean;
  onView: () => void;
  onStop: () => void;
  onDelete: () => void;
}) {
  const ps = bot.powerState;

  return (
    <div
      className="px-3 py-2 border-b transition-colors"
      style={{
        borderColor: '#1a2538',
        background: isSelected ? '#0d1a2d' : 'transparent',
      }}
    >
      {/* Top: symbol + status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{
              background: bot.running ? '#00FF66' : bot.status === 'error' ? '#ef4444' : '#374151',
              boxShadow: bot.running ? '0 0 4px #00FF66' : 'none',
            }}
          />
          <span className="text-[11px] font-mono font-bold truncate" style={{ color: isSelected ? '#E6EDF3' : '#C7D1DB' }}>
            {bot.symbol}
          </span>
          <span className="text-[9px] font-mono px-1 rounded" style={{ background: '#1a2538', color: '#6b7280' }}>
            {bot.timeframe}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!isSelected && (
            <button
              onClick={onView}
              className="p-0.5 rounded transition-colors hover:bg-[#00E5FF20]"
              style={{ color: '#00E5FF' }}
              title="View this bot"
            >
              <Eye className="w-3 h-3" />
            </button>
          )}
          {bot.running && (
            <button
              onClick={onStop}
              className="p-0.5 rounded transition-colors hover:bg-[#ef444420]"
              style={{ color: '#ef4444' }}
              title="Stop"
            >
              <Square className="w-3 h-3" />
            </button>
          )}
          {!bot.running && (
            <button
              onClick={onDelete}
              className="p-0.5 rounded transition-colors hover:bg-[#ef444420]"
              style={{ color: '#4b5563' }}
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Position + signal info */}
      <div className="flex items-center gap-3 mt-1">
        {ps?.inPosition ? (
          <>
            <span className="text-[9px] font-mono" style={{ color: '#6b7280' }}>
              <span style={{ color: '#9ca3af' }}>{formatCrypto(ps.positionSize, 4)}</span>
            </span>
            <span className="text-[9px] font-mono" style={{ color: '#6b7280' }}>
              DCA <span style={{ color: ps.dcaStage > 3 ? '#f97316' : '#9ca3af' }}>{ps.dcaStage}/7</span>
            </span>
            {ps.pmActive && (
              <span className="text-[9px] font-mono font-bold" style={{ color: '#00FF66' }}>TP TRAILING</span>
            )}
          </>
        ) : (
          <span className="text-[9px] font-mono" style={{ color: '#374151' }}>
            {bot.running ? 'watching…' : bot.status === 'error' ? '⚠ error' : 'idle'}
          </span>
        )}
        {bot.lastSignal && bot.lastSignal.action !== 'hold' && (
          <span
            className="text-[9px] font-mono ml-auto font-bold"
            style={{ color: bot.lastSignal.action === 'buy' ? '#00FF66' : '#ef4444' }}
          >
            {bot.lastSignal.action.toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}
