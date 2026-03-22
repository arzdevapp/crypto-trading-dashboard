'use client';
import { useQuery } from '@tanstack/react-query';
import { Newspaper, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SentimentSignal {
  score: number;
  label: string;
  confidence: number;
  headlines: { title: string; source: string; sentiment: string; score: number; publishedAt: number }[];
  breakdown: { cryptoPanic: number; stocktwits: number; reddit: number; cryptoCompare: number };
  fetchedAt: number;
}

function scoreColor(score: number): string {
  if (score <= -0.4) return '#ef4444';
  if (score <= -0.15) return '#f97316';
  if (score < 0.15) return '#8B949E';
  if (score < 0.4) return '#22c55e';
  return '#00FF66';
}

function ScoreBar({ value }: { value: number }) {
  const pct = ((value + 1) / 2) * 100;
  return (
    <div className="relative h-1.5 rounded-full w-full overflow-hidden" style={{ background: '#1a2538' }}>
      <div className="absolute top-0 h-full rounded-full transition-all duration-500"
        style={{ left: '50%', width: `${Math.abs(value) * 50}%`, transform: value < 0 ? 'translateX(-100%)' : 'none', background: scoreColor(value) }} />
      <div className="absolute top-0 left-1/2 w-px h-full" style={{ background: '#243044' }} />
    </div>
  );
}

function SourceBar({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono w-20 flex-shrink-0" style={{ color: '#8B949E' }}>{label}</span>
      <ScoreBar value={value} />
      <span className="text-[9px] font-mono w-8 text-right flex-shrink-0" style={{ color: scoreColor(value) }}>
        {value > 0 ? '+' : ''}{value.toFixed(2)}
      </span>
    </div>
  );
}

export function NewsSentimentWidget({ symbol }: { symbol: string }) {
  const { data, isLoading, isError } = useQuery<SentimentSignal>({
    queryKey: ['news-sentiment', symbol],
    queryFn: () => fetch(`/api/news/sentiment?symbol=${encodeURIComponent(symbol)}`).then(r => r.json()),
    refetchInterval: 15 * 60 * 1000,
    staleTime: 14 * 60 * 1000,
  });

  return (
    <div className="rounded-lg border overflow-hidden flex-shrink-0" style={{ background: '#0E1626', borderColor: '#243044' }}>
      {/* Header */}
      <div className="px-3 py-1.5 border-b flex items-center justify-between" style={{ borderColor: '#243044', background: '#070B10' }}>
        <div className="flex items-center gap-1.5">
          <Newspaper className="w-3 h-3" style={{ color: '#8B949E' }} />
          <span className="text-[10px] font-mono font-bold tracking-widest uppercase" style={{ color: '#8B949E' }}>News Sentiment</span>
        </div>
        {data && (
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold" style={{ background: `${scoreColor(data.score)}20`, color: scoreColor(data.score) }}>
            {data.label}
          </span>
        )}
      </div>

      <div className="p-3 space-y-3">
        {isLoading && (
          <p className="text-[9px] font-mono text-center" style={{ color: '#8B949E' }}>Loading sentiment…</p>
        )}
        {isError && (
          <p className="text-[9px] font-mono text-center" style={{ color: '#ef4444' }}>Failed to load sentiment</p>
        )}

        {data && (
          <>
            {/* Main score */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: '#243044' }}>Overall</span>
                <div className="flex items-center gap-1">
                  {data.score > 0.1 ? <TrendingUp className="w-3 h-3" style={{ color: scoreColor(data.score) }} />
                    : data.score < -0.1 ? <TrendingDown className="w-3 h-3" style={{ color: scoreColor(data.score) }} />
                    : <Minus className="w-3 h-3" style={{ color: '#8B949E' }} />}
                  <span className="text-sm font-mono font-bold" style={{ color: scoreColor(data.score) }}>
                    {data.score > 0 ? '+' : ''}{data.score.toFixed(2)}
                  </span>
                </div>
              </div>
              <ScoreBar value={data.score} />
              <div className="flex justify-between">
                <span className="text-[8px] font-mono" style={{ color: '#243044' }}>Bearish</span>
                <span className="text-[8px] font-mono" style={{ color: '#243044' }}>Bullish</span>
              </div>
            </div>

            {/* Source breakdown */}
            <div className="space-y-1.5 pt-1 border-t" style={{ borderColor: '#1a2538' }}>
              <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: '#243044' }}>Sources</span>
              <SourceBar label="CryptoPanic" value={data.breakdown.cryptoPanic} />
              <SourceBar label="Stocktwits" value={data.breakdown.stocktwits} />
              <SourceBar label="Reddit" value={data.breakdown.reddit} />
              <SourceBar label="CryptoCompare" value={data.breakdown.cryptoCompare} />
            </div>

            {/* Top headlines */}
            {data.headlines.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t" style={{ borderColor: '#1a2538' }}>
                <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: '#243044' }}>Top Headlines</span>
                {data.headlines.slice(0, 4).map((h, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: scoreColor(h.score) }} />
                    <div className="min-w-0">
                      <p className="text-[9px] font-mono leading-tight line-clamp-2" style={{ color: '#C7D1DB' }}>{h.title}</p>
                      <p className="text-[8px] font-mono mt-0.5" style={{ color: '#243044' }}>{h.source}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Effect on bot */}
            <div className="pt-1 border-t" style={{ borderColor: '#1a2538' }}>
              <p className="text-[9px] font-mono" style={{ color: '#8B949E' }}>
                Bot effect: {
                  data.score <= -0.5 ? '🚫 Entry blocked — very bearish news'
                  : data.score <= -0.2 ? '⚠ Entry threshold raised +1'
                  : data.score >= 0.4 ? '✓ Entry threshold lowered −1'
                  : '— No change to thresholds'
                }
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
