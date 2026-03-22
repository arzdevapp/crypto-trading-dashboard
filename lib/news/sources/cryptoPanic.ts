export interface CryptoPanicPost {
  title: string;
  url: string;
  source: string;
  publishedAt: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  votes: { positive: number; negative: number; important: number };
}

const cache = new Map<string, { posts: CryptoPanicPost[]; expiresAt: number }>();
const CACHE_TTL = 15 * 60_000;

export async function fetchCryptoPanic(symbol: string): Promise<CryptoPanicPost[]> {
  const coin = symbol.split('/')[0].toUpperCase();
  const cached = cache.get(coin);
  if (cached && Date.now() < cached.expiresAt) return cached.posts;

  const apiKey = process.env.CRYPTOPANIC_API_KEY;
  const base = 'https://cryptopanic.com/api/v1/posts/';
  const params = new URLSearchParams({ currencies: coin, filter: 'hot', kind: 'news' });
  if (apiKey) params.set('auth_token', apiKey);

  try {
    const res = await fetch(`${base}?${params}`, {
      headers: { 'User-Agent': 'CryptoDashboard/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`CryptoPanic HTTP ${res.status}`);
    const json = await res.json();

    const posts: CryptoPanicPost[] = (json.results ?? []).slice(0, 30).map((p: Record<string, unknown>) => {
      const votes = (p.votes as Record<string, number>) ?? {};
      const positive = votes.positive ?? 0;
      const negative = votes.negative ?? 0;
      const sentiment = positive > negative + 2 ? 'positive' : negative > positive + 2 ? 'negative' : 'neutral';
      return {
        title: String(p.title ?? ''),
        url: String(p.url ?? ''),
        source: String((p.domain as string) ?? 'cryptopanic'),
        publishedAt: new Date(String(p.published_at)).getTime(),
        sentiment,
        votes: { positive, negative, important: votes.important ?? 0 },
      };
    });

    cache.set(coin, { posts, expiresAt: Date.now() + CACHE_TTL });
    return posts;
  } catch {
    return cache.get(coin)?.posts ?? [];
  }
}
