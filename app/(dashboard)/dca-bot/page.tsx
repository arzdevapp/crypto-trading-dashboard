'use client';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PriceChart } from '@/components/charts/PriceChart';
import { NeuralLevelsOverlay } from '@/components/charts/NeuralLevelsOverlay';
import { SymbolSelector } from '@/components/trading/SymbolSelector';
import { useStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Brain, RefreshCw, Zap, Square, Activity, Eye, Trash2 } from 'lucide-react';
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

export default function DCABotPage() {
  const { activeExchangeId, selectedSymbol, setSelectedSymbol } = useStore();
  const [longLevels, setLongLevels] = useState<number[]>([]);
  const [shortLevels, setShortLevels] = useState<number[]>([]);
  const [timeframe, setTimeframe] = useState('1h');
  const [tradeStartLevel, setTradeStartLevel] = useState('3');
  const [quantity, setQuantity] = useState('0.001');
  const [pmStartPct, setPmStartPct] = useState('5');
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

  return (
    <div className="h-full flex flex-col xl:flex-row gap-2 p-2 overflow-y-auto xl:overflow-hidden" style={{ background: '#070B10' }}>

      {/* Left panel — controls + active bots list */}
      <div className="flex flex-col gap-2 xl:w-64 flex-shrink-0 xl:overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[11px] font-mono font-bold tracking-widest uppercase" style={{ color: '#00E5FF' }}>DCA Bot</span>
            <PageHelp
              title="DCA Bot"
              description="Automated DCA bot powered by a kNN neural model. Run multiple instances on different symbols simultaneously."
              steps={[
                { label: 'Train the model', detail: 'Click Train to build pattern memory for the selected symbol.' },
                { label: 'Configure & Start', detail: 'Set params and click START BOT. Each symbol gets its own bot instance.' },
                { label: 'Monitor active bots', detail: 'The Active Bots panel shows all running instances. Click VIEW to switch to that bot.' },
                { label: 'Stop a bot', detail: 'Click STOP on any active bot, or use the main STOP button for the selected symbol.' },
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

        {/* Symbol */}
        <div className="rounded-lg border overflow-hidden flex-shrink-0" style={{ background: '#0E1626', borderColor: '#243044' }}>
          <div className="px-3 py-1.5 border-b text-[10px] font-mono font-bold tracking-widest uppercase" style={{ borderColor: '#243044', background: '#070B10', color: '#8B949E' }}>Symbol</div>
          <div className="p-2">
            <SymbolSelector exchangeId={activeExchangeId} value={selectedSymbol} onChange={setSelectedSymbol} />
          </div>
        </div>

        {/* Settings */}
        <div className="rounded-lg border overflow-hidden flex-shrink-0" style={{ background: '#0E1626', borderColor: '#243044' }}>
          <div className="px-3 py-1.5 border-b text-[10px] font-mono font-bold tracking-widest uppercase" style={{ borderColor: '#243044', background: '#070B10', color: '#8B949E' }}>Settings</div>
          <div className="p-3 space-y-3">
            <div>
              <Label className="text-[10px] font-mono" style={{ color: '#8B949E' }}>Timeframe</Label>
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
              <Label className="text-[10px] font-mono" style={{ color: '#8B949E' }}>Start Level (1–7)</Label>
              <Input className="h-7 mt-1 text-xs" type="number" min="1" max="7" value={tradeStartLevel} onChange={e => setTradeStartLevel(e.target.value)} disabled={running} />
            </div>
            <div>
              <Label className="text-[10px] font-mono" style={{ color: '#8B949E' }}>Quantity (base asset)</Label>
              <Input className="h-7 mt-1 text-xs font-mono" type="number" step="0.0001" value={quantity} onChange={e => setQuantity(e.target.value)} disabled={running} />
            </div>
            <div>
              <Label className="text-[10px] font-mono" style={{ color: '#8B949E' }}>Profit Margin %</Label>
              <Input className="h-7 mt-1 text-xs font-mono" type="number" step="0.5" value={pmStartPct} onChange={e => setPmStartPct(e.target.value)} disabled={running} />
            </div>
          </div>
        </div>

        {/* Start / Stop button */}
        {running ? (
          <Button
            className="flex-shrink-0 h-8 font-mono text-xs font-bold gap-2"
            style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}
            onClick={() => stopBot(selectedSymbol)}
            disabled={stopping}
          >
            {stopping ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />}
            {stopping ? 'STOPPING…' : 'STOP BOT'}
          </Button>
        ) : (
          <Button
            className="flex-shrink-0 h-8 font-mono text-xs font-bold gap-2"
            style={{ background: '#00FF6620', color: '#00FF66', border: '1px solid #00FF6640' }}
            onClick={() => startBot()}
            disabled={starting || training}
          >
            {starting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
            {starting ? 'STARTING…' : 'START BOT'}
          </Button>
        )}

        {/* Active Bots Panel */}
        <div className="rounded-lg border overflow-hidden flex-shrink-0" style={{ background: '#0E1626', borderColor: '#243044' }}>
          <div className="px-3 py-1.5 border-b flex items-center justify-between" style={{ borderColor: '#243044', background: '#070B10' }}>
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase" style={{ color: '#8B949E' }}>Active Bots</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: '#121C2F', color: allBots.filter(b => b.running).length > 0 ? '#00FF66' : '#8B949E' }}>
              {allBots.filter(b => b.running).length} running
            </span>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {allBots.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-[10px] font-mono" style={{ color: '#8B949E' }}>No bots created yet</p>
                <p className="text-[9px] font-mono mt-0.5" style={{ color: '#243044' }}>Select a symbol and click START BOT</p>
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

      {/* Right: chart + live position */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="h-[350px] xl:h-auto xl:flex-1 xl:min-h-0">
          <PriceChart
            exchangeId={activeExchangeId}
            symbol={selectedSymbol}
            longLevels={longLevels}
            shortLevels={shortLevels}
            overlay={
              <NeuralLevelsOverlay
                exchangeId={activeExchangeId}
                symbol={selectedSymbol}
                onLevelsUpdate={handleLevelsUpdate}
              />
            }
          />
        </div>

        {/* Live Position Card */}
        <div
          className="flex-shrink-0 rounded-lg border overflow-hidden"
          style={{ background: '#0E1626', borderColor: running ? '#00FF6640' : '#243044' }}
        >
          {/* Status bar */}
          <div
            className="flex items-center gap-3 px-4 py-2 border-b flex-wrap"
            style={{ borderColor: '#243044', background: '#070B10' }}
          >
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  background: running ? '#00FF66' : '#8B949E',
                  boxShadow: running ? '0 0 6px #00FF66' : 'none',
                }}
              />
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase" style={{ color: running ? '#00FF66' : '#8B949E' }}>
                {running ? 'BOT RUNNING' : 'BOT STOPPED'}
              </span>
            </div>
            {botStatus?.lastSignal && (
              <span className="text-[10px] font-mono" style={{ color: '#8B949E' }}>
                Last: <span style={{ color: botStatus.lastSignal.action === 'buy' ? '#00FF66' : botStatus.lastSignal.action === 'sell' ? '#ef4444' : '#8B949E' }}>
                  {botStatus.lastSignal.action.toUpperCase()}
                </span>
                {botStatus.lastSignal.reason ? ` — ${botStatus.lastSignal.reason}` : ''}
              </span>
            )}
            {botStatus?.error && (
              <span className="text-[10px] font-mono" style={{ color: '#ef4444' }}>⚠ {botStatus.error}</span>
            )}
          </div>

          {/* Position metrics */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-px" style={{ background: '#243044' }}>
            {[
              {
                label: 'Position',
                value: ps?.inPosition ? formatCrypto(ps.positionSize, 6) : '—',
                sub: ps?.inPosition ? selectedSymbol.split('/')[0] : 'no position',
                color: ps?.inPosition ? '#C7D1DB' : '#8B949E',
              },
              {
                label: 'Avg Cost',
                value: ps?.inPosition && ps.avgCostBasis > 0 ? formatCurrency(ps.avgCostBasis) : '—',
                sub: `current: ${currentPrice > 0 ? formatCurrency(currentPrice) : '—'}`,
                color: '#C7D1DB',
              },
              {
                label: 'Unrealised P&L',
                value: ps?.inPosition ? formatCurrency(pnl) : '—',
                sub: ps?.inPosition ? formatPercent(pnlPct) : '',
                color: pnl >= 0 ? '#00FF66' : '#ef4444',
              },
              {
                label: 'DCA Stage',
                value: ps ? `${ps.dcaStage} / 7` : '—',
                sub: ps?.pmActive ? `trailing @ ${formatCurrency(ps.trailingPMLine)}` : ps?.inPosition ? 'trailing inactive' : '',
                color: ps?.pmActive ? '#00FF66' : '#C7D1DB',
              },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="px-3 xl:px-4 py-2.5" style={{ background: '#0E1626' }}>
                <div className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: '#243044' }}>{label}</div>
                <div className="text-sm font-mono font-bold" style={{ color }}>{value}</div>
                {sub && <div className="text-[9px] font-mono mt-0.5" style={{ color: '#8B949E' }}>{sub}</div>}
              </div>
            ))}
          </div>

          {/* Neural levels bar */}
          <div className="flex items-center gap-3 xl:gap-4 px-3 xl:px-4 py-2 border-t flex-wrap" style={{ borderColor: '#243044' }}>
            <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: '#243044' }}>Neural</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono" style={{ color: '#60a5fa' }}>LONG</span>
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="w-3 h-3 rounded-sm" style={{ background: i < longLevels.length ? '#60a5fa' : '#1a2538' }} />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono" style={{ color: '#fb923c' }}>SHORT</span>
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="w-3 h-3 rounded-sm" style={{ background: i < shortLevels.length ? '#fb923c' : '#1a2538' }} />
              ))}
            </div>
            {running && (
              <span className="ml-auto text-[9px] font-mono animate-pulse" style={{ color: '#00FF66' }}>
                LIVE
              </span>
            )}
          </div>
        </div>
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
        background: isSelected ? '#121C2F' : 'transparent',
      }}
    >
      {/* Top: symbol + status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{
              background: bot.running ? '#00FF66' : bot.status === 'error' ? '#ef4444' : '#8B949E',
              boxShadow: bot.running ? '0 0 4px #00FF66' : 'none',
            }}
          />
          <span className="text-[11px] font-mono font-bold truncate" style={{ color: '#C7D1DB' }}>
            {bot.symbol}
          </span>
          <span className="text-[9px] font-mono" style={{ color: '#8B949E' }}>
            {bot.timeframe}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!isSelected && (
            <button
              onClick={onView}
              className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded transition-colors hover:bg-[#00E5FF20]"
              style={{ color: '#00E5FF' }}
              title="View this bot"
            >
              <Eye className="w-3 h-3" />
            </button>
          )}
          {bot.running && (
            <button
              onClick={onStop}
              className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded transition-colors hover:bg-[#ef444420]"
              style={{ color: '#ef4444' }}
              title="Stop"
            >
              <Square className="w-3 h-3" />
            </button>
          )}
          {!bot.running && (
            <button
              onClick={onDelete}
              className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded transition-colors hover:bg-[#ef444420]"
              style={{ color: '#8B949E' }}
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Bottom: position info */}
      <div className="flex items-center gap-3 mt-1">
        {ps?.inPosition ? (
          <>
            <span className="text-[9px] font-mono" style={{ color: '#8B949E' }}>
              Pos: <span style={{ color: '#C7D1DB' }}>{formatCrypto(ps.positionSize, 6)}</span>
            </span>
            <span className="text-[9px] font-mono" style={{ color: '#8B949E' }}>
              DCA: <span style={{ color: '#C7D1DB' }}>{ps.dcaStage}/7</span>
            </span>
            {ps.pmActive && (
              <span className="text-[9px] font-mono" style={{ color: '#00FF66' }}>PM</span>
            )}
          </>
        ) : (
          <span className="text-[9px] font-mono" style={{ color: '#243044' }}>
            {bot.running ? 'waiting for signal…' : bot.status === 'error' ? 'error' : 'stopped'}
          </span>
        )}
        {bot.lastSignal && (
          <span className="text-[9px] font-mono ml-auto" style={{
            color: bot.lastSignal.action === 'buy' ? '#00FF66' : bot.lastSignal.action === 'sell' ? '#ef4444' : '#8B949E'
          }}>
            {bot.lastSignal.action.toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}
