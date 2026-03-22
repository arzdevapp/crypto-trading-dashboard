export interface CoinSafety {
  score: number;       // 0-100
  label: 'Safe' | 'Moderate' | 'Caution' | 'Risky';
  reasons: string[];   // why this score was given
}

export interface TrendingCoin {
  id: string;
  symbol: string;        // lowercase e.g. "btc"
  name: string;
  tradingPair: string;   // e.g. "BTC/USDT" for exchange use
  price: number;
  marketCapRank: number;
  change24h: number;
  change7d: number;
  volume24h: number;
  marketCap: number;
  isTrending: boolean;   // from CoinGecko trending list
  safety: CoinSafety;
  signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'avoid';
  signalReason: string;
}

// Server-side 10-min cache
const cache: { coins: TrendingCoin[]; expiresAt: number } = { coins: [], expiresAt: 0 };
const CACHE_TTL = 10 * 60_000;

// Stablecoins to exclude from trending list
const STABLECOINS = new Set(['usdt', 'usdc', 'busd', 'dai', 'tusd', 'usdd', 'frax', 'usdp', 'gusd', 'usr', 'fdusd', 'pyusd']);

function computeSafety(coin: {
  marketCapRank: number;
  change24h: number;
  change7d: number;
  volume24h: number;
  marketCap: number;
}): CoinSafety {
  let score = 100;
  const reasons: string[] = [];

  // Market cap rank penalty
  if (coin.marketCapRank > 200) {
    score -= 40; reasons.push('Very low market cap rank (>200)');
  } else if (coin.marketCapRank > 50) {
    score -= 25; reasons.push('Low market cap rank (>50)');
  } else if (coin.marketCapRank > 20) {
    score -= 10; reasons.push('Mid-cap coin');
  }

  // 24h volatility penalty
  const abs24h = Math.abs(coin.change24h);
  if (abs24h > 20) {
    score -= 35; reasons.push(`Extreme 24h move: ${coin.change24h.toFixed(1)}%`);
  } else if (abs24h > 10) {
    score -= 20; reasons.push(`High 24h volatility: ${coin.change24h.toFixed(1)}%`);
  } else if (abs24h > 5) {
    score -= 10; reasons.push(`Moderate 24h move: ${coin.change24h.toFixed(1)}%`);
  }

  // Liquidity (volume / market cap ratio)
  const liquidityRatio = coin.marketCap > 0 ? coin.volume24h / coin.marketCap : 0;
  if (liquidityRatio < 0.01) {
    score -= 20; reasons.push('Low liquidity (volume < 1% of market cap)');
  } else if (liquidityRatio < 0.05) {
    score -= 8; reasons.push('Moderate liquidity');
  }

  // Trend consistency bonus
  const consistent = (coin.change24h > 0 && coin.change7d > 0) || (coin.change24h < 0 && coin.change7d < 0);
  if (consistent && abs24h < 8) {
    score += 5; reasons.push('Consistent trend direction');
  }

  score = Math.max(0, Math.min(100, score));

  let label: CoinSafety['label'];
  if (score >= 75) label = 'Safe';
  else if (score >= 50) label = 'Moderate';
  else if (score >= 30) label = 'Caution';
  else label = 'Risky';

  return { score, label, reasons };
}

function computeSignal(coin: TrendingCoin): { signal: TrendingCoin['signal']; reason: string } {
  const abs24h = Math.abs(coin.change24h);

  // Risky low-cap high-volatility
  if (coin.safety.score < 30) {
    return { signal: 'avoid', reason: 'Low safety score — too risky for systematic trading' };
  }

  // Extreme dip on solid coin = strong buy opportunity
  if (coin.change24h < -8 && coin.marketCapRank <= 20) {
    return { signal: 'strong_buy', reason: `Major dip (${coin.change24h.toFixed(1)}%) on top-20 coin — high-conviction buy zone` };
  }

  // Dip buy: down 3-8% on a decent coin
  if (coin.change24h < -3 && coin.safety.score >= 50) {
    return { signal: 'buy', reason: `Price dip (${coin.change24h.toFixed(1)}%) with solid fundamentals` };
  }

  // Overbought: strong run up — take profit territory
  if (coin.change24h > 15 && coin.change7d > 20) {
    return { signal: 'sell', reason: `Overextended — 24h: +${coin.change24h.toFixed(1)}%, 7d: +${coin.change7d.toFixed(1)}%` };
  }

  // Momentum buy: trending up with moderate gains
  if (coin.change24h > 3 && coin.change7d > 5 && coin.isTrending) {
    return { signal: 'buy', reason: `Trending with positive momentum — 24h: +${coin.change24h.toFixed(1)}%` };
  }

  return { signal: 'neutral', reason: `Consolidating — 24h: ${coin.change24h.toFixed(1)}%, 7d: ${coin.change7d.toFixed(1)}%` };
}

export async function fetchTrendingCoins(): Promise<TrendingCoin[]> {
  if (cache.coins.length && Date.now() < cache.expiresAt) return cache.coins;

  try {
    // Fetch trending list and top-volume coins in parallel
    const [trendingRes, marketsRes] = await Promise.all([
      fetch('https://api.coingecko.com/api/v3/search/trending', { headers: { 'User-Agent': 'CryptoDashboard/1.0' } }),
      fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=20&page=1&price_change_percentage=24h,7d&sparkline=false', {
        headers: { 'User-Agent': 'CryptoDashboard/1.0' },
      }),
    ]);

    const trendingJson = await trendingRes.json();
    const marketsJson = await marketsRes.json();

    // Build trending IDs set from CoinGecko trending
    const trendingIds = new Set<string>(
      (trendingJson.coins ?? []).map((c: { item: { id: string } }) => c.item.id)
    );

    // Use market data as the main source
    const coins: TrendingCoin[] = (marketsJson as {
      id: string; symbol: string; name: string;
      current_price: number; market_cap_rank: number;
      price_change_percentage_24h: number;
      price_change_percentage_7d_in_currency: number;
      total_volume: number; market_cap: number;
    }[])
      .filter(c => !STABLECOINS.has(c.symbol.toLowerCase()))
      .slice(0, 15)
      .map(c => {
        const base: Omit<TrendingCoin, 'safety' | 'signal' | 'signalReason'> = {
          id: c.id,
          symbol: c.symbol.toUpperCase(),
          name: c.name,
          tradingPair: `${c.symbol.toUpperCase()}/USDT`,
          price: c.current_price,
          marketCapRank: c.market_cap_rank ?? 999,
          change24h: c.price_change_percentage_24h ?? 0,
          change7d: c.price_change_percentage_7d_in_currency ?? 0,
          volume24h: c.total_volume ?? 0,
          marketCap: c.market_cap ?? 0,
          isTrending: trendingIds.has(c.id),
        };
        const safety = computeSafety(base);
        const coin = { ...base, safety, signal: 'neutral' as TrendingCoin['signal'], signalReason: '' };
        const { signal, reason } = computeSignal(coin);
        return { ...coin, signal, signalReason: reason };
      });

    // Sort: trending first, then by safety score desc
    coins.sort((a, b) => {
      if (a.isTrending && !b.isTrending) return -1;
      if (!a.isTrending && b.isTrending) return 1;
      return b.safety.score - a.safety.score;
    });

    cache.coins = coins;
    cache.expiresAt = Date.now() + CACHE_TTL;
    return coins;
  } catch {
    return cache.coins; // return stale on error
  }
}
