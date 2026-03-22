'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, CandlestickSeries, LineSeries, type IChartApi, type ISeriesApi, type CandlestickData, type Time } from 'lightweight-charts';
import { useStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TIMEFRAMES } from '@/lib/constants';

interface PriceChartProps {
  exchangeId: string;
  symbol: string;
  longLevels?: number[];
  shortLevels?: number[];
  avgCostBasis?: number;
  trailingPMLine?: number;
  overlay?: React.ReactNode;
}

export function PriceChart({ exchangeId, symbol, longLevels = [], shortLevels = [], avgCostBasis, trailingPMLine, overlay }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const levelSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const { selectedTimeframe, setSelectedTimeframe } = useStore();
  const [loading, setLoading] = useState(true);
  const lastCandleDataRef = useRef<CandlestickData[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
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
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || 300,
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

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      // Null refs BEFORE remove so any in-flight async callbacks see null and bail
      chartRef.current = null;
      candleSeriesRef.current = null;
      levelSeriesRef.current = [];
      chart.remove();
    };
  }, []);

  // Load candle data
  useEffect(() => {
    if (!candleSeriesRef.current || !exchangeId || !symbol) return;
    setLoading(true);

    const controller = new AbortController();

    fetch(
      `/api/exchanges/${exchangeId}/ohlcv?symbol=${encodeURIComponent(symbol)}&timeframe=${selectedTimeframe}&limit=200`,
      { signal: controller.signal }
    )
      .then((r) => r.json())
      .then((candles: { timestamp: number; open: number; high: number; low: number; close: number }[]) => {
        if (!candleSeriesRef.current || !chartRef.current) return;
        const data: CandlestickData[] = candles.map((c) => ({
          time: Math.floor(c.timestamp / 1000) as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        lastCandleDataRef.current = data;
        candleSeriesRef.current.setData(data);
        chartRef.current.timeScale().fitContent();
      })
      .catch((err) => { if (err.name !== 'AbortError') console.error(err); })
      .finally(() => setLoading(false));

    return () => controller.abort();
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

  return (
    <Card className="overflow-hidden h-full min-h-[380px] flex flex-col">
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
        <div ref={containerRef} className="w-full h-full" />
      </CardContent>
    </Card>
  );
}
