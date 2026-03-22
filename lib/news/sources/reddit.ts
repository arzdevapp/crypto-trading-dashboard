export interface RedditPost {
  title: string;
  score: number;
  publishedAt: number;
  subreddit: string;
}

const cache = new Map<string, { posts: RedditPost[]; expiresAt: number }>();
const CACHE_TTL = 15 * 60_000;

const SUBREDDIT_MAP: Record<string, string[]> = {
  BTC: ['Bitcoin', 'CryptoCurrency'],
  ETH: ['ethereum', 'CryptoCurrency'],
  SOL: ['solana', 'CryptoCurrency'],
  BNB: ['binance', 'CryptoCurrency'],
  XRP: ['Ripple', 'CryptoCurrency'],
  ADA: ['cardano', 'CryptoCurrency'],
  DOGE: ['dogecoin', 'CryptoCurrency'],
  DEFAULT: ['CryptoCurrency'],
};

export async function fetchReddit(symbol: string): Promise<RedditPost[]> {
  const coin = symbol.split('/')[0].toUpperCase();
  const cached = cache.get(coin);
  if (cached && Date.now() < cached.expiresAt) return cached.posts;

  const subreddits = SUBREDDIT_MAP[coin] ?? SUBREDDIT_MAP.DEFAULT;
  const allPosts: RedditPost[] = [];

  await Promise.all(
    subreddits.map(async (sub) => {
      try {
        const res = await fetch(
          `https://www.reddit.com/r/${sub}/hot.json?limit=15`,
          {
            headers: { 'User-Agent': 'CryptoDashboard/1.0' },
            signal: AbortSignal.timeout(8000),
          }
        );
        if (!res.ok) return;
        const json = await res.json();
        const posts = (json.data?.children ?? []).map((c: Record<string, unknown>) => {
          const d = c.data as Record<string, unknown>;
          return {
            title: String(d.title ?? ''),
            score: Number(d.score ?? 0),
            publishedAt: Number(d.created_utc ?? 0) * 1000,
            subreddit: sub,
          };
        });
        allPosts.push(...posts);
      } catch { /* skip failed subreddit */ }
    })
  );

  cache.set(coin, { posts: allPosts, expiresAt: Date.now() + CACHE_TTL });
  return allPosts;
}
