'use client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Square, Trash2, TrendingUp } from 'lucide-react';
import { useToggleStrategy, useDeleteStrategy } from '@/hooks/useStrategies';
import { toast } from 'sonner';
import type { StrategyRecord } from '@/types/strategy';

const TIER_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  best:     { label: '★ BEST',     color: '#00FF66', bg: '#00FF6615' },
  good:     { label: '◆ GOOD',     color: '#00E5FF', bg: '#00E5FF15' },
  moderate: { label: '● MODERATE', color: '#eab308', bg: '#eab30815' },
};

export function StrategyCard({ strategy }: { strategy: StrategyRecord }) {
  const { mutate: toggle, isPending: toggling } = useToggleStrategy();
  const { mutate: deleteStrategy, isPending: deleting } = useDeleteStrategy();

  const handleToggle = () => {
    const action = strategy.status === 'running' ? 'stop' : 'start';
    toggle(
      { id: strategy.id, action },
      {
        onSuccess: () => toast.success(`Strategy ${action === 'start' ? 'started' : 'stopped'}`),
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const handleDelete = () => {
    if (!confirm('Delete this strategy?')) return;
    deleteStrategy(strategy.id, {
      onSuccess: () => toast.success('Strategy deleted'),
      onError: (err) => toast.error(err.message),
    });
  };

  const config = JSON.parse(strategy.config);
  const tier = config._tier as string | undefined;
  const description = config._description as string | undefined;
  const tierStyle = tier ? TIER_STYLE[tier] : null;

  const displayConfig = Object.entries(config).filter(([k]) => !k.startsWith('_'));

  const statusColor = {
    running: 'bg-green-500',
    stopped: 'bg-gray-400',
    error: 'bg-red-500',
  }[strategy.status];

  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusColor}`} />
      <CardHeader className="pl-4 pb-2 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-sm truncate">{strategy.name}</span>
            </div>
            <div className="flex gap-1 mt-1.5 flex-wrap items-center">
              <Badge variant="outline" className="text-[9px] py-0 px-1.5">{strategy.type}</Badge>
              <Badge variant="outline" className="text-[9px] py-0 px-1.5">{strategy.symbol}</Badge>
              <Badge variant="outline" className="text-[9px] py-0 px-1.5">{strategy.timeframe}</Badge>
              <Badge
                variant={strategy.status === 'running' ? 'default' : strategy.status === 'error' ? 'destructive' : 'secondary'}
                className="text-[9px] py-0 px-1.5"
              >
                {strategy.status.toUpperCase()}
              </Badge>
              {tierStyle && (
                <span
                  className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                  style={{ color: tierStyle.color, background: tierStyle.bg }}
                >
                  {tierStyle.label}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Button
              size="icon" variant="ghost" className="h-7 w-7"
              onClick={handleToggle} disabled={toggling}
            >
              {strategy.status === 'running'
                ? <Square className="w-3 h-3 text-red-500" />
                : <Play className="w-3 h-3 text-green-500" />}
            </Button>
            <Button
              size="icon" variant="ghost" className="h-7 w-7"
              onClick={handleDelete} disabled={deleting}
            >
              <Trash2 className="w-3 h-3 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pl-4 pt-0 pb-3">
        {description && (
          <p className="text-[10px] font-mono mb-2 leading-relaxed" style={{ color: '#8B949E' }}>{description}</p>
        )}
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          {displayConfig.slice(0, 6).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="capitalize truncate">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              <span className="font-mono text-foreground flex-shrink-0">{String(val)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
