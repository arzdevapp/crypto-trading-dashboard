'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, CandlestickSeries, LineSeries, type IChartApi, type ISeriesApi, type CandlestickData, type Time } from 'lightweight-charts';
import { useStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TIMEFRAMES } from '@/lib/constants';

// ── Client-side indicator calculations (pure math) ──

function calcSMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const result: number[] = [];
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += values[i - j];
    result.push(sum / period);
  }
  return result;
}

function calcEMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  let emaVal = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(emaVal);
  for (let i = period; i < values.length; i++) {
    emaVal = values[i] * k + emaVal * (1 - k);
    result.push(emaVal);
  }
  return result;
}

function calcRSI(values: number[], period = 14): number[] {
  if (values.length < period + 1) return [];
  const result: number[] = [];
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  const rsiVal = (ag: number, al: number) =>
    al === 0 ? 100 : ag === 0 ? 0 : 100 - 100 / (1 + ag / al);
  result.push(rsiVal(avgGain, avgLoss));
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    result.push(rsiVal(avgGain, avgLoss));
  }
  return result;
}

function calcBollinger(values: number[], period = 20, mult = 2) {
  const middle = calcSMA(values, period);
  if (middle.length === 0) return { upper: [], middle: [], lower: [] };
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = period - 1; i < values.length; i++) {
    const idx = i - (period - 1);
    if (idx >= middle.length) break;
    const slice = values.slice(i - period + 1, i + 1);
    const mean = middle[idx];
    const variance = slice.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    upper.push(mean + mult * stdDev);
    lower.push(mean - mult * stdDev);
  }
  return { upper, middle, lower };
}

function calcMACD(values: number[], fastP = 12, slowP = 26, sigP = 9) {
  const fastEMA = calcEMA(values, fastP);
  const slowEMA = calcEMA(values, slowP);
  if (fastEMA.length === 0 || slowEMA.length === 0) return { macd: [], signal: [], histogram: [] };
  const offset = slowP - fastP;
  const macdLine = slowEMA.map((v, i) => {
    const fi = i + offset;
    return fi < fastEMA.length ? fastEMA[fi] - v : 0;
  });
  const signalLine = calcEMA(macdLine, sigP);
  if (signalLine.length === 0) return { macd: macdLine, signal: [], histogram: [] };
  const sigOffset = macdLine.length - signalLine.length;
  const histogram = signalLine.map((v, i) => macdLine[i + sigOffset] - v);
  return { macd: macdLine, signal: signalLine, histogram };
}

// ── Indicator config ──

export type IndicatorType = 'ema9' | 'ema21' | 'sma50' | 'sma200' | 'bollinger' | 'vwap';

export interface ActiveIndicators {
  ema9?: boolean;
  ema21?: boolean;
  sma50?: boolean;
  sma200?: boolean;
  bollinger?: boolean;
}

const INDICATOR_COLORS: Record<string, string> = {
  ema9: '#f59e0b',   // amber
  ema21: '#8b5cf6',  // purple
  sma50: '#06b6d4',  // cyan
  sma200: '#ec4899', // pink
  boll_upper: '#6366f1', // indigo
  boll_middle: '#6366f1',
  boll_lower: '#6366f1',
};

interface PriceChartProps {
  exchangeId: string;
  symbol: string;
  longLevels?: number[];
  shortLevels?: number[];
  avgCostBasis?: number;
  trailingPMLine?: number;
  overlay?: React.ReactNode;
  indicators?: ActiveIndicators;
}

export function PriceChart({ exchangeId, symbol, longLevels = [], shortLevels = [], avgCostBasis, trailingPMLine, overlay, indicators }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const levelSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const indicatorSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const { selectedTimeframe, setSelectedTimeframe } = useStore();
  const [loading, setLoading] = useState(true);
  const lastCandleDataRef = useRef<CandlestickData[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    let chart: IChartApi | null = null;

    const initChart = (width: number, height: number) => {
      if (chart || !containerRef.current) return;

      chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: '#0E1626' },
          textColor: '#8B949E',
        },
        grid: {
          vertLines: { color: '#243044' },
          horzLines: { color: '#243044' },
        },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: '#243044' },
        timeScale: { borderColor: '#243044', timeVisible: true },
        width,
        height,
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
    };

    // Use ResizeObserver to init only when container has real dimensions
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      const w = entry.contentRect.width;
      const h = entry.contentRect.height;
      if (w === 0 || h === 0) return;

      if (!chart) {
        initChart(w, h);
      } else {
        chart.applyOptions({ width: w, height: h });
      }
    });

    resizeObserver.observe(containerRef.current);

    // Fallback: if container already has size on mount, init immediately
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    if (w > 0 && h > 0) initChart(w, h);

    return () => {
      resizeObserver.disconnect();
      const c = chart;
      chart = null;
      chartRef.current = null;
      candleSeriesRef.current = null;
      levelSeriesRef.current = [];
      indicatorSeriesRef.current = [];
      c?.remove();
    };
  }, []);

  // Load candle data + auto-refresh latest candle every 30s
  useEffect(() => {
    if (!exchangeId || !symbol) return;

    const loadCandles = async (controller: AbortController, full = false) => {
      if (!candleSeriesRef.current) return;
      if (full) setLoading(true);
      try {
        const limit = full ? 200 : 2;
        const res = await fetch(
          `/api/exchanges/${exchangeId}/ohlcv?symbol=${encodeURIComponent(symbol)}&timeframe=${selectedTimeframe}&limit=${limit}`,
          { signal: controller.signal }
        );
        const raw = await res.json();
        if (!candleSeriesRef.current || !chartRef.current) return;
        if (!Array.isArray(raw)) return;

        const candles: { timestamp: number; open: number; high: number; low: number; close: number }[] = raw;
        const data: CandlestickData[] = candles
          .filter(c => c && typeof c.timestamp === 'number')
          .map((c) => ({
            time: Math.floor(c.timestamp / 1000) as Time,
            open: c.open, high: c.high, low: c.low, close: c.close,
          }));

        if (full) {
          lastCandleDataRef.current = data;
          candleSeriesRef.current.setData(data);
          chartRef.current.timeScale().fitContent();
        } else {
          // Update/append latest candle only
          for (const candle of data) {
            candleSeriesRef.current.update(candle);
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') console.error(err);
      } finally {
        if (full) setLoading(false);
      }
    };

    const controller = new AbortController();
    loadCandles(controller, true);

    // Refresh latest candle every 30s
    const interval = setInterval(() => loadCandles(controller, false), 30000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [exchangeId, symbol, selectedTimeframe]);

  // Draw neural level lines
  useEffect(() => {
    const chart = chartRef.current;
    const candles = lastCandleDataRef.current;
    if (!chart || !candleSeriesRef.current || !candles.length) return;

    // Remove old level series
    for (const s of levelSeriesRef.current) {
      try { chart.removeSeries(s); } catch { /* ignore */ }
    }
    levelSeriesRef.current = [];

    const timeRange = candles.map(c => c.time as number);
    const firstTime = timeRange[0];
    const lastTime = timeRange[timeRange.length - 1];
    const extendedTime = (lastTime + (lastTime - firstTime) * 0.1) as Time;

    const addLevelLine = (price: number, color: string) => {
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        lineStyle: 2, // dashed
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      series.setData([
        { time: firstTime as Time, value: price },
        { time: extendedTime, value: price },
      ]);
      levelSeriesRef.current.push(series);
    };

    for (const level of longLevels) addLevelLine(level, '#3b82f6'); // blue - LONG
    for (const level of shortLevels) addLevelLine(level, '#f97316'); // orange - SHORT
    if (avgCostBasis) addLevelLine(avgCostBasis, '#eab308'); // yellow - cost basis
    if (trailingPMLine) addLevelLine(trailingPMLine, '#22c55e'); // green - trailing PM

  }, [longLevels, shortLevels, avgCostBasis, trailingPMLine]);

  // ── Draw technical indicator overlays ──
  useEffect(() => {
    const chart = chartRef.current;
    const candles = lastCandleDataRef.current;
    if (!chart || !candles.length) return;

    // Remove old indicator series
    for (const s of indicatorSeriesRef.current) {
      try { chart.removeSeries(s); } catch { /* ignore */ }
    }
    indicatorSeriesRef.current = [];

    if (!indicators) return;

    const closes = candles.map(c => c.close);
    const times = candles.map(c => c.time);

    const addIndicatorLine = (values: number[], offset: number, color: string, lineWidth: number = 1, lineStyle: number = 0) => {
      if (values.length === 0) return;
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: lineWidth as 1 | 2 | 3 | 4,
        lineStyle,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: false,
      });
      const data = values.map((v, i) => ({
        time: times[i + offset],
        value: v,
      }));
      series.setData(data);
      indicatorSeriesRef.current.push(series);
    };

    // EMA 9
    if (indicators.ema9) {
      const vals = calcEMA(closes, 9);
      addIndicatorLine(vals, 9 - 1, INDICATOR_COLORS.ema9, 1);
    }

    // EMA 21
    if (indicators.ema21) {
      const vals = calcEMA(closes, 21);
      addIndicatorLine(vals, 21 - 1, INDICATOR_COLORS.ema21, 1);
    }

    // SMA 50
    if (indicators.sma50) {
      const vals = calcSMA(closes, 50);
      addIndicatorLine(vals, 50 - 1, INDICATOR_COLORS.sma50, 2);
    }

    // SMA 200
    if (indicators.sma200) {
      const vals = calcSMA(closes, 200);
      addIndicatorLine(vals, 200 - 1, INDICATOR_COLORS.sma200, 2);
    }

    // Bollinger Bands
    if (indicators.bollinger) {
      const bb = calcBollinger(closes, 20, 2);
      const bbOffset = 20 - 1;
      addIndicatorLine(bb.upper, bbOffset, INDICATOR_COLORS.boll_upper, 1, 2);
      addIndicatorLine(bb.middle, bbOffset, INDICATOR_COLORS.boll_middle, 1, 0);
      addIndicatorLine(bb.lower, bbOffset, INDICATOR_COLORS.boll_lower, 1, 2);
    }

  }, [indicators, loading]); // re-run when indicators toggle or new data loads

  return (
    <Card className="overflow-hidden h-full min-h-[300px] flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm">{symbol}</span>
          {loading && <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>}
        </div>
        <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
          <SelectTrigger className="w-20 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEFRAMES.map((tf) => (
              <SelectItem key={tf} value={tf}>{tf}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {overlay && (
        <div className="px-4 py-1.5 border-b border-border bg-muted/20">
          {overlay}
        </div>
      )}
      <CardContent className="p-0 flex-1 min-h-0">
        <div ref={containerRef} className="w-full h-full" style={{ minHeight: '280px' }} />
      </CardContent>
    </Card>
  );
}
