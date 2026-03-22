'use client';
import { useStrategies } from '@/hooks/useStrategies';
import { useToggleStrategy } from '@/hooks/useStrategies';
import { toast } from 'sonner';
import { Bot, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function StrategyStatusPanel() {
  const { data: strategies = [] } = useStrategies();
  const { mutate: toggle } = useToggleStrategy();

  const running = strategies.filter(s => s.status === 'running').length;

  const handleToggle = (id: string, status: string) => {
    const action = status === 'running' ? 'stop' : 'start';
    toggle({ id, action }, {
      onSuccess: () => toast.success(`Strategy ${action === 'start' ? 'started' : 'stopped'}`),
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <div className="rounded-lg border overflow-hidden" style={{ background: '#0E1626', borderColor: '#243044' }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: '#243044', background: '#070B10' }}>
        <Bot className="w-3.5 h-3.5" style={{ color: '#00E5FF' }} />
        <span className="text-[11px] font-mono font-bold tracking-widest uppercase" style={{ color: '#00E5FF' }}>Strategies</span>
        <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: running > 0 ? '#00FF6620' : '#121C2F', color: running > 0 ? '#00FF66' : '#8B949E' }}>
          {running} RUNNING
        </span>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {strategies.length === 0 ? (
          <div className="px-3 py-4 text-[10px] font-mono text-center" style={{ color: '#8B949E' }}>No strategies</div>
        ) : (
          <div className="divide-y divide-[#243044]">
            {strategies.map(s => {
              const statusColor = s.status === 'running' ? '#00FF66' : s.status === 'error' ? '#ef4444' : '#8B949E';
              return (
                <div key={s.id} className="flex items-center gap-2 px-3 py-2 hover:bg-[#121C2F] transition-colors" style={{ borderColor: '#243044' }}>
                  <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusColor, boxShadow: s.status === 'running' ? `0 0 6px ${statusColor}` : 'none' }} />
                      <span className="text-[11px] font-mono font-medium truncate" style={{ color: '#C7D1DB' }}>{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2 pl-3">
                      <span className="text-[9px] font-mono" style={{ color: '#8B949E' }}>{s.symbol}</span>
                      <span className="text-[9px] font-mono" style={{ color: '#8B949E' }}>·</span>
                      <span className="text-[9px] font-mono" style={{ color: '#8B949E' }}>{s.timeframe}</span>
                      <span className="text-[9px] font-mono" style={{ color: '#8B949E' }}>·</span>
                      <span className="text-[9px] font-mono" style={{ color: statusColor }}>{s.status.toUpperCase()}</span>
                    </div>
                  </div>
                  <Button
                    size="icon" variant="ghost" className="h-6 w-6 flex-shrink-0 hover:bg-[#243044]"
                    onClick={() => handleToggle(s.id, s.status)}
                  >
                    {s.status === 'running'
                      ? <Square className="w-3 h-3" style={{ color: '#ef4444' }} />
                      : <Play className="w-3 h-3" style={{ color: '#00FF66' }} />}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
