const newsCache: { items: NewsItem[]; expiresAt: number } = { items: [], expiresAt: 0 };
const CACHE_TTL = 15 * 60_000;

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: number;
  categories: string;
  imageUrl?: string;
}

export async function fetchCryptoNews(limit = 20): Promise<NewsItem[]> {
  if (newsCache.items.length && Date.now() < newsCache.expiresAt) return newsCache.items.slice(0, limit);
  try {
    const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=popular', {
      headers: { 'User-Agent': 'CryptoDashboard/1.0' },
    });
    const json = await res.json();
    const items: NewsItem[] = (json.Data ?? []).map((n: Record<string, unknown>) => ({
      id: String(n.id),
      title: String(n.title),
      url: String(n.url),
      source: String((n.source_info as Record<string, unknown>)?.name ?? n.source),
      publishedAt: Number(n.published_on) * 1000,
      categories: String(n.categories),
      imageUrl: n.imageurl ? String(n.imageurl) : undefined,
    }));
    newsCache.items = items;
    newsCache.expiresAt = Date.now() + CACHE_TTL;
    return items.slice(0, limit);
  } catch {
    return newsCache.items.slice(0, limit);
  }
}
