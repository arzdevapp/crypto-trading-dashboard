'use client';
import { useQuery } from '@tanstack/react-query';

interface Props {
  exchangeId: string;
  symbol: string;
}

interface MLSignal {
  longSignalCount: number;
  shortSignalCount: number;
  longLevels: number[];
  shortLevels: number[];
  currentPrice: number;
}

interface FearGreed {
  value: number;
  label: string;
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Indicator math ──────────────────────────────────────────────

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 35) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calcEMA(macdLine.slice(-9), 9);
  const macd = macdLine[macdLine.length - 1];
  const signal = signalLine[signalLine.length - 1];
  return { macd, signal, histogram: macd - signal };
}

// ── Overall recommendation ───────────────────────────────────────

function calcRecommendation(
  rsi: number,
  macdHist: number,
  mlLong: number,
  mlShort: number,
  fg: number,
): { action: 'BUY' | 'SELL' | 'HOLD'; score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // RSI
  if (rsi < 30) { score += 2; reasons.push('RSI oversold'); }
  else if (rsi < 45) { score += 1; reasons.push('RSI low'); }
  else if (rsi > 70) { score -= 2; reasons.push('RSI overbought'); }
  else if (rsi > 55) { score -= 1; reasons.push('RSI high'); }

  // MACD
  if (macdHist > 0) { score += 1; reasons.push('MACD bullish'); }
  else if (macdHist < 0) { score -= 1; reasons.push('MACD bearish'); }

  // ML signals
  if (mlLong >= 4) { score += 2; reasons.push(`${mlLong} buy zones`); }
  else if (mlLong >= 2) { score += 1; reasons.push(`${mlLong} buy zones`); }
  if (mlShort >= 4) { score -= 2; reasons.push(`${mlShort} sell zones`); }
  else if (mlShort >= 2) { score -= 1; reasons.push(`${mlShort} sell zones`); }

  // Fear & Greed (contrarian)
  if (fg < 25) { score += 1; reasons.push('Extreme fear'); }
  else if (fg > 75) { score -= 1; reasons.push('Extreme greed'); }

  const action = score >= 2 ? 'BUY' : score <= -2 ? 'SELL' : 'HOLD';
  return { action, score, reasons };
}

// ── Component ────────────────────────────────────────────────────

export function TradingSignalPanel({ exchangeId, symbol }: Props) {
  const { data: mlData, isLoading: mlLoading } = useQuery<MLSignal>({
    queryKey: ['ml-signals', exchangeId, symbol],
    queryFn: async () => {
      const r = await fetch(`/api/ml/signals?exchangeId=${exchangeId}&symbol=${encodeURIComponent(symbol)}`);
      if (!r.ok) throw new Error('ML fetch failed');
      return r.json();
    },
    refetchInterval: 60_000,
    staleTime: 55_000,
    retry: 1,
  });

  const { data: sentimentData } = useQuery<{ fearGreed: FearGreed }>({
    queryKey: ['sentiment'],
    queryFn: async () => {
      const r = await fetch('/api/sentiment?news=false');
      if (!r.ok) throw new Error('Sentiment fetch failed');
      return r.json();
    },
    refetchInterval: 300_000,
    staleTime: 290_000,
    retry: 1,
  });

  const { data: candles } = useQuery<Candle[]>({
    queryKey: ['ohlcv-signal', exchangeId, symbol],
    queryFn: async () => {
      const r = await fetch(`/api/exchanges/${exchangeId}/ohlcv?symbol=${encodeURIComponent(symbol)}&timeframe=1h&limit=50`);
      if (!r.ok) throw new Error('OHLCV fetch failed');
      return r.json();
    },
    refetchInterval: 60_000,
    staleTime: 55_000,
    retry: 1,
  });

  const closes = candles?.map(c => c.close) ?? [];
  const rsi = closes.length > 14 ? calcRSI(closes) : null;
  const macdData = closes.length > 35 ? calcMACD(closes) : null;
  const fg = sentimentData?.fearGreed;

  const rec = rsi !== null && macdData !== null && mlData
    ? calcRecommendation(rsi, macdData.histogram, mlData.longSignalCount, mlData.shortSignalCount, fg?.value ?? 50)
    : null;

  const rsiColor = rsi === null ? '#8B949E' : rsi < 30 ? '#00FF66' : rsi > 70 ? '#ef4444' : '#C7D1DB';
  const macdColor = !macdData ? '#8B949E' : macdData.histogram > 0 ? '#00FF66' : '#ef4444';
  const fgColor = !fg ? '#8B949E' : fg.value < 30 ? '#00FF66' : fg.value > 70 ? '#ef4444' : '#f97316';

  const recColor = rec?.action === 'BUY' ? '#00FF66' : rec?.action === 'SELL' ? '#ef4444' : '#f97316';
  const recBg = rec?.action === 'BUY' ? '#00FF6615' : rec?.action === 'SELL' ? '#ef444415' : '#f9731615';

  return (
    <div className="rounded-lg border overflow-hidden" style={{ background: '#0E1626', borderColor: '#243044' }}>
      {/* Header */}
      <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: '#243044', background: '#070B10' }}>
        <span className="text-[11px] font-mono font-bold tracking-widest uppercase" style={{ color: '#00E5FF' }}>Signal</span>
        {mlLoading && <span className="text-[9px] font-mono" style={{ color: '#8B949E' }}>loading…</span>}
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* Recommendation */}
        {rec && (
          <div className="rounded-md p-2 flex flex-col items-center gap-1" style={{ background: recBg, border: `1px solid ${recColor}30` }}>
            <span className="text-[18px] font-mono font-bold tracking-widest" style={{ color: recColor }}>
              {rec.action}
            </span>
            <div className="flex flex-wrap gap-1 justify-center">
              {rec.reasons.map((r, i) => (
                <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: '#ffffff08', color: '#8B949E' }}>
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Indicators grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* RSI */}
          <div className="rounded p-2" style={{ background: '#070B10' }}>
            <div className="text-[9px] font-mono mb-1" style={{ color: '#8B949E' }}>RSI (14)</div>
            <div className="text-[15px] font-mono font-bold" style={{ color: rsiColor }}>
              {rsi !== null ? rsi.toFixed(1) : '—'}
            </div>
            <div className="text-[9px] font-mono" style={{ color: rsiColor }}>
              {rsi === null ? '' : rsi < 30 ? 'Oversold' : rsi > 70 ? 'Overbought' : rsi < 45 ? 'Low' : rsi > 55 ? 'High' : 'Neutral'}
            </div>
          </div>

          {/* MACD */}
          <div className="rounded p-2" style={{ background: '#070B10' }}>
            <div className="text-[9px] font-mono mb-1" style={{ color: '#8B949E' }}>MACD</div>
            <div className="text-[15px] font-mono font-bold" style={{ color: macdColor }}>
              {macdData ? (macdData.histogram > 0 ? '▲' : '▼') : '—'}
            </div>
            <div className="text-[9px] font-mono" style={{ color: macdColor }}>
              {macdData ? (macdData.histogram > 0 ? 'Bullish' : 'Bearish') : ''}
            </div>
          </div>

          {/* ML Buy zones */}
          <div className="rounded p-2" style={{ background: '#070B10' }}>
            <div className="text-[9px] font-mono mb-1" style={{ color: '#8B949E' }}>ML Buy Zones</div>
            <div className="flex items-end gap-1">
              <span className="text-[15px] font-mono font-bold" style={{ color: mlData?.longSignalCount ? '#00FF66' : '#4B5563' }}>
                {mlData?.longSignalCount ?? '—'}
              </span>
              <span className="text-[9px] font-mono mb-0.5" style={{ color: '#4B5563' }}>/7</span>
            </div>
            <div className="flex gap-0.5 mt-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex-1 h-1 rounded-sm" style={{ background: i < (mlData?.longSignalCount ?? 0) ? '#00FF66' : '#1e2d45' }} />
              ))}
            </div>
          </div>

          {/* ML Sell zones */}
          <div className="rounded p-2" style={{ background: '#070B10' }}>
            <div className="text-[9px] font-mono mb-1" style={{ color: '#8B949E' }}>ML Sell Zones</div>
            <div className="flex items-end gap-1">
              <span className="text-[15px] font-mono font-bold" style={{ color: mlData?.shortSignalCount ? '#ef4444' : '#4B5563' }}>
                {mlData?.shortSignalCount ?? '—'}
              </span>
              <span className="text-[9px] font-mono mb-0.5" style={{ color: '#4B5563' }}>/7</span>
            </div>
            <div className="flex gap-0.5 mt-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex-1 h-1 rounded-sm" style={{ background: i < (mlData?.shortSignalCount ?? 0) ? '#ef4444' : '#1e2d45' }} />
              ))}
            </div>
          </div>
        </div>

        {/* Fear & Greed */}
        {fg && (
          <div className="rounded p-2 flex items-center justify-between" style={{ background: '#070B10' }}>
            <span className="text-[9px] font-mono" style={{ color: '#8B949E' }}>Fear & Greed</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: '#1e2d45' }}>
                <div className="h-full rounded-full" style={{ width: `${fg.value}%`, background: fgColor }} />
              </div>
              <span className="text-[11px] font-mono font-bold" style={{ color: fgColor }}>{fg.value}</span>
              <span className="text-[9px] font-mono" style={{ color: '#8B949E' }}>{fg.label}</span>
            </div>
          </div>
        )}

        {/* Nearest ML levels */}
        {mlData && mlData.currentPrice > 0 && (mlData.longLevels.length > 0 || mlData.shortLevels.length > 0) && (
          <div className="rounded p-2" style={{ background: '#070B10' }}>
            <div className="text-[9px] font-mono mb-2" style={{ color: '#8B949E' }}>Nearest Levels</div>
            <div className="flex flex-col gap-1">
              {mlData.shortLevels.filter(l => l > mlData.currentPrice).slice(0, 2).map((l, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-[9px] font-mono" style={{ color: '#ef4444' }}>↑ Sell</span>
                  <span className="text-[10px] font-mono" style={{ color: '#C7D1DB' }}>
                    ${l.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: '#4B5563' }}>
                    +{((l / mlData.currentPrice - 1) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
              <div className="border-t my-0.5" style={{ borderColor: '#243044' }} />
              {mlData.longLevels.filter(l => l < mlData.currentPrice).slice(-2).reverse().map((l, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-[9px] font-mono" style={{ color: '#00FF66' }}>↓ Buy</span>
                  <span className="text-[10px] font-mono" style={{ color: '#C7D1DB' }}>
                    ${l.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: '#4B5563' }}>
                    -{((1 - l / mlData.currentPrice) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
