export interface StocktwitsMessage {
  text: string;
  sentiment: 'Bullish' | 'Bearish' | null;
  publishedAt: number;
}

const cache = new Map<string, { messages: StocktwitsMessage[]; expiresAt: number }>();
const CACHE_TTL = 15 * 60_000;

// Convert BTC/USDT → BTCUSD for Stocktwits
function toStocktwitsSymbol(symbol: string): string {
  const base = symbol.split('/')[0].toUpperCase();
  return `${base}USD`;
}

export async function fetchStocktwits(symbol: string): Promise<StocktwitsMessage[]> {
  const stSymbol = toStocktwitsSymbol(symbol);
  const cached = cache.get(stSymbol);
  if (cached && Date.now() < cached.expiresAt) return cached.messages;

  try {
    const res = await fetch(
      `https://api.stocktwits.com/api/2/streams/symbol/${stSymbol}.json`,
      {
        headers: { 'User-Agent': 'CryptoDashboard/1.0' },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) throw new Error(`Stocktwits HTTP ${res.status}`);
    const json = await res.json();

    const messages: StocktwitsMessage[] = (json.messages ?? []).slice(0, 30).map((m: Record<string, unknown>) => ({
      text: String(m.body ?? ''),
      sentiment: (m.entities as Record<string, unknown>)?.sentiment
        ? String(((m.entities as Record<string, unknown>).sentiment as Record<string, unknown>)?.basic ?? '') as 'Bullish' | 'Bearish' | null
        : null,
      publishedAt: new Date(String(m.created_at)).getTime(),
    }));

    cache.set(stSymbol, { messages, expiresAt: Date.now() + CACHE_TTL });
    return messages;
  } catch {
    return cache.get(stSymbol)?.messages ?? [];
  }
}
