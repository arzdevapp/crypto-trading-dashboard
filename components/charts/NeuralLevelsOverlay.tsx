'use client';
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Brain } from 'lucide-react';

interface NeuralSignalData {
  symbol: string;
  currentPrice: number;
  aggregatedLongLevels: number[];
  aggregatedShortLevels: number[];
  maxLongSignal: number;
  maxShortSignal: number;
}

interface NeuralLevelsOverlayProps {
  exchangeId: string;
  symbol: string;
  onLevelsUpdate?: (longLevels: number[], shortLevels: number[]) => void;
}

export function NeuralLevelsOverlay({ exchangeId, symbol, onLevelsUpdate }: NeuralLevelsOverlayProps) {
  const { data, isLoading, error } = useQuery<NeuralSignalData>({
    queryKey: ['neural-signals', exchangeId, symbol],
    queryFn: async () => {
      const res = await fetch(`/api/ml/signals?exchangeId=${exchangeId}&symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error('Failed to fetch neural signals');
      return res.json();
    },
    refetchInterval: 60000,
    staleTime: 55000,
    enabled: !!exchangeId && !!symbol,
  });

  // Use a ref so the callback identity never becomes a dependency trigger
  const onLevelsUpdateRef = useRef(onLevelsUpdate);
  onLevelsUpdateRef.current = onLevelsUpdate;

  useEffect(() => {
    if (data && onLevelsUpdateRef.current) {
      onLevelsUpdateRef.current(data.aggregatedLongLevels, data.aggregatedShortLevels);
    }
  }, [data]);

  if (isLoading) return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Brain className="w-3.5 h-3.5 animate-pulse" />
      <span>Training neural model...</span>
    </div>
  );

  if (error || !data) return null;

  const longSignal = data.maxLongSignal;
  const shortSignal = data.maxShortSignal;

  return (
    <div className="flex items-center gap-3 text-xs">
      <Brain className="w-3.5 h-3.5 text-purple-400" />
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">LONG</span>
        <div className="flex gap-0.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-sm ${i < longSignal ? 'bg-blue-500' : 'bg-muted'}`}
            />
          ))}
        </div>
        <Badge variant="outline" className="text-[10px] py-0 text-blue-400 border-blue-400/30">
          N{longSignal}
        </Badge>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">SHORT</span>
        <div className="flex gap-0.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-sm ${i < shortSignal ? 'bg-orange-500' : 'bg-muted'}`}
            />
          ))}
        </div>
        <Badge variant="outline" className="text-[10px] py-0 text-orange-400 border-orange-400/30">
          N{shortSignal}
        </Badge>
      </div>
      <div className="flex items-center gap-2 ml-1">
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-blue-500" />
          <span className="text-[10px] text-muted-foreground">{data.aggregatedLongLevels.length} buy zones</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-orange-500" />
          <span className="text-[10px] text-muted-foreground">{data.aggregatedShortLevels.length} sell zones</span>
        </div>
      </div>
    </div>
  );
}
