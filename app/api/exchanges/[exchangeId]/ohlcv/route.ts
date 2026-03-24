export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getExchangeAdapter } from '@/lib/exchange/ExchangeFactory';

// Server-side cache: avoids hammering exchange on rapid page loads / multiple components
const ohlcvCache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL = 10_000; // 10s — fresh enough for 1m candles, prevents bursts

export async function GET(req: Request, { params }: { params: Promise<{ exchangeId: string }> }) {
  try {
    const { exchangeId } = await params;
    const url = new URL(req.url);
    const symbol = url.searchParams.get('symbol') ?? 'BTC/USDT';
    const timeframe = url.searchParams.get('timeframe') ?? '1h';
    const limit = parseInt(url.searchParams.get('limit') ?? '200');

    const cacheKey = `${exchangeId}:${symbol}:${timeframe}:${limit}`;
    const cached = ohlcvCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json(cached.data);
    }

    const adapter = await getExchangeAdapter(exchangeId);
    const candles = await adapter.fetchOHLCV(symbol, timeframe, limit);

    ohlcvCache.set(cacheKey, { data: candles, expiresAt: Date.now() + CACHE_TTL });
    return NextResponse.json(candles);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
