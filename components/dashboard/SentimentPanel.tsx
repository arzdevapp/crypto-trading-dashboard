'use client';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import type { FearGreedData } from '@/lib/sentiment/fearGreed';
import type { NewsItem } from '@/lib/sentiment/cryptoNews';

interface SentimentResponse {
  fearGreed: FearGreedData;
  news: NewsItem[];
}

function getFearGreedColor(value: number): string {
  if (value <= 24) return '#ef4444';   // Extreme Fear
  if (value <= 49) return '#f97316';   // Fear
  if (value <= 54) return '#eab308';   // Neutral
  if (value <= 74) return '#84cc16';   // Greed
  return '#00FF66';                    // Extreme Greed
}

export function SentimentPanel() {
  const { data, isLoading, isError } = useQuery<SentimentResponse>({
    queryKey: ['sentiment'],
    queryFn: () => fetch('/api/sentiment').then((r) => r.json()),
    refetchInterval: 15 * 60 * 1000,
    staleTime: 14 * 60 * 1000,
  });

  return (
    <div
      className="rounded-lg border flex flex-col overflow-hidden flex-shrink-0"
      style={{ background: '#0E1626', borderColor: '#243044' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0"
        style={{ background: '#070B10', borderColor: '#243044' }}
      >
        <span className="text-xs font-mono font-semibold tracking-widest uppercase" style={{ color: '#00E5FF' }}>
          Market Sentiment
        </span>
        {data?.fearGreed && (
          <span className="text-xs font-mono" style={{ color: '#8B949E' }}>
            {formatDistanceToNow(data.fearGreed.timestamp, { addSuffix: true })}
          </span>
        )}
      </div>

      {/* Fear & Greed Section */}
      <div className="px-3 py-3 border-b flex-shrink-0" style={{ borderColor: '#243044' }}>
        {isLoading && (
          <div className="text-xs font-mono text-center py-2" style={{ color: '#8B949E' }}>
            Loading sentiment...
          </div>
        )}
        {isError && (
          <div className="text-xs font-mono text-center py-2" style={{ color: '#ef4444' }}>
            Failed to load sentiment
          </div>
        )}
        {data?.fearGreed && (() => {
          const { value, label } = data.fearGreed;
          const color = getFearGreedColor(value);
          return (
            <div className="flex flex-col gap-2">
              {/* Gauge bar */}
              <div
                className="w-full h-2 rounded-full overflow-hidden"
                style={{ background: '#243044' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${value}%`, background: color }}
                />
              </div>

              {/* Value + Label row */}
              <div className="flex items-end justify-between">
                <span
                  className="text-3xl font-mono font-bold leading-none"
                  style={{ color }}
                >
                  {value}
                </span>
                <span className="text-sm font-mono font-semibold" style={{ color }}>
                  {label}
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* News Section */}
      <div className="flex flex-col min-h-0">
        <div
          className="px-3 py-1.5 border-b flex-shrink-0"
          style={{ borderColor: '#243044' }}
        >
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: '#8B949E' }}>
            Crypto News
          </span>
        </div>

        <div
          className="overflow-y-auto"
          style={{ maxHeight: '280px' }}
        >
          {isLoading && (
            <div className="px-3 py-3 text-xs font-mono" style={{ color: '#8B949E' }}>
              Loading news...
            </div>
          )}
          {data?.news && data.news.length === 0 && (
            <div className="px-3 py-3 text-xs font-mono" style={{ color: '#8B949E' }}>
              No news available
            </div>
          )}
          {data?.news && data.news.slice(0, 8).map((item, idx) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start justify-between gap-2 px-3 py-2 border-b transition-colors hover:bg-white/5"
              style={{
                borderColor: idx < 7 ? '#1a2538' : 'transparent',
                textDecoration: 'none',
              }}
            >
              {/* Title */}
              <p
                className="text-xs font-mono leading-relaxed line-clamp-2 flex-1 min-w-0"
                style={{ color: '#C7D1DB' }}
              >
                {item.title}
              </p>

              {/* Source + Time */}
              <div className="flex flex-col items-end flex-shrink-0 gap-0.5 pt-0.5">
                <span className="text-xs font-mono" style={{ color: '#00E5FF' }}>
                  {item.source}
                </span>
                <span className="text-xs font-mono whitespace-nowrap" style={{ color: '#8B949E' }}>
                  {formatDistanceToNow(item.publishedAt, { addSuffix: true })}
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
