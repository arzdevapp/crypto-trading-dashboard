'use client';
import { useStrategies } from '@/hooks/useStrategies';
import { useToggleStrategy } from '@/hooks/useStrategies';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Square, Bot } from 'lucide-react';
import { toast } from 'sonner';

export function ActiveStrategiesPanel() {
  const { data: strategies = [], isLoading } = useStrategies();
  const { mutate: toggle } = useToggleStrategy();

  const handleToggle = (id: string, status: string) => {
    const action = status === 'running' ? 'stop' : 'start';
    toggle(
      { id, action },
      {
        onSuccess: () => toast.success(`Strategy ${action === 'start' ? 'started' : 'stopped'}`),
        onError: (err) => toast.error(err.message),
      }
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bot className="w-4 h-4" />
          Strategies
          {strategies.length > 0 && (
            <Badge variant="secondary" className="text-[10px] py-0 ml-auto">
              {strategies.filter(s => s.status === 'running').length} running
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="px-4 py-3 text-xs text-muted-foreground">Loading...</div>
        ) : strategies.length === 0 ? (
          <div className="px-4 py-6 text-xs text-muted-foreground text-center">
            No strategies configured
          </div>
        ) : (
          <div className="divide-y divide-border">
            {strategies.map((s) => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-2">
                <div
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    s.status === 'running' ? 'bg-green-500 animate-pulse' :
                    s.status === 'error'   ? 'bg-red-500' : 'bg-muted-foreground'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground">{s.symbol} · {s.timeframe}</div>
                </div>
                <Button
                  size="icon" variant="ghost" className="h-6 w-6 flex-shrink-0"
                  onClick={() => handleToggle(s.id, s.status)}
                >
                  {s.status === 'running'
                    ? <Square className="w-3 h-3 text-red-500" />
                    : <Play className="w-3 h-3 text-green-500" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
