import { fetchCryptoPanic } from './sources/cryptoPanic';
import { fetchStocktwits } from './sources/stocktwits';
import { fetchReddit } from './sources/reddit';
import { fetchCryptoNews } from '@/lib/sentiment/cryptoNews';

// ── Keyword dictionaries ──────────────────────────────────────────────────────
const BULLISH_KEYWORDS = [
  'etf', 'adoption', 'partnership', 'upgrade', 'institutional', 'launch', 'approved',
  'approval', 'bullish', 'rally', 'surge', 'breakout', 'accumulate', 'ath', 'record high',
  'growth', 'inflow', 'gains', 'recovery', 'rebound', 'halving', 'milestone',
  'integration', 'listing', 'listed', 'innovation', 'mainstream', 'invest',
  'all-time high', 'support', 'buy', 'long', 'uptrend', 'positive', 'increase',
  'expansion', 'revenue', 'profit', 'demand', 'scarce', 'supply', 'hodl',
];

const BEARISH_KEYWORDS = [
  'hack', 'exploit', 'ban', 'crash', 'lawsuit', 'fud', 'dump', 'bear',
  'fall', 'drop', 'fear', 'panic', 'warning', 'risk', 'concern', 'investigation',
  'fraud', 'scam', 'bankruptcy', 'collapse', 'crisis', 'outflow', 'suspend',
  'delist', 'fine', 'penalty', 'attack', 'vulnerability', 'stolen', 'liquidation',
  'bubble', 'manipulation', 'dead', 'fail', 'exit scam', 'rug', 'ponzi',
  'overvalued', 'loss', 'decline', 'down', 'bearish', 'short', 'downtrend',
  'sell off', 'selloff', 'correction', 'resistance', 'rejected', 'crackdown',
  'seized', 'arrested', 'indicted', 'illegal', 'shutdown', 'breach',
];

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SentimentSignal {
  score: number;           // -1.0 (very bearish) to +1.0 (very bullish)
  label: string;           // "Very Bearish" | "Bearish" | "Neutral" | "Bullish" | "Very Bullish"
  confidence: number;      // 0-1 based on how many sources/articles contributed
  headlines: HeadlineItem[]; // top scored headlines
  breakdown: {
    cryptoPanic: number;
    stocktwits: number;
    reddit: number;
    cryptoCompare: number;
  };
  fetchedAt: number;
}

export interface HeadlineItem {
  title: string;
  source: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  score: number;
  publishedAt: number;
}

// ── Cache ─────────────────────────────────────────────────────────────────────
const sentimentCache = new Map<string, SentimentSignal>();
const CACHE_TTL = 15 * 60_000;

// ── Keyword scorer ────────────────────────────────────────────────────────────
function scoreText(text: string): number {
  const lower = text.toLowerCase();
  let bullish = 0;
  let bearish = 0;
  for (const kw of BULLISH_KEYWORDS) if (lower.includes(kw)) bullish++;
  for (const kw of BEARISH_KEYWORDS) if (lower.includes(kw)) bearish++;
  const total = bullish + bearish;
  if (total === 0) return 0;
  return (bullish - bearish) / total; // -1 to +1
}

function toLabel(score: number): string {
  if (score <= -0.5) return 'Very Bearish';
  if (score <= -0.2) return 'Bearish';
  if (score < 0.2) return 'Neutral';
  if (score < 0.5) return 'Bullish';
  return 'Very Bullish';
}

// Recency weight: articles in the last hour get 1.0, last 6h get 0.7, last 24h get 0.4, older 0.2
function recencyWeight(publishedAt: number): number {
  const ageMs = Date.now() - publishedAt;
  if (ageMs < 3_600_000) return 1.0;
  if (ageMs < 21_600_000) return 0.7;
  if (ageMs < 86_400_000) return 0.4;
  return 0.2;
}

// ── Main scorer ───────────────────────────────────────────────────────────────
export async function getNewsSentiment(symbol: string): Promise<SentimentSignal> {
  const coin = symbol.split('/')[0].toUpperCase();

  const cached = sentimentCache.get(coin);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached;

  // Fetch all sources in parallel — failures are non-fatal
  const [cryptoPanicPosts, stocktwitsMessages, redditPosts, cryptoComparePosts] =
    await Promise.all([
      fetchCryptoPanic(symbol).catch(() => []),
      fetchStocktwits(symbol).catch(() => []),
      fetchReddit(symbol).catch(() => []),
      fetchCryptoNews(30).catch(() => []),
    ]);

  const headlines: HeadlineItem[] = [];
  let totalWeightedScore = 0;
  let totalWeight = 0;

  // ── CryptoPanic (highest quality — pre-labelled) ──
  let cpScore = 0, cpWeight = 0;
  for (const post of cryptoPanicPosts) {
    const kw = scoreText(post.title);
    // Blend keyword score with vote-based sentiment
    const voteScore = post.sentiment === 'positive' ? 0.6 : post.sentiment === 'negative' ? -0.6 : 0;
    const blended = kw * 0.5 + voteScore * 0.5;
    const importance = 1 + (post.votes.important * 0.2) + (post.votes.positive * 0.05);
    const w = recencyWeight(post.publishedAt) * importance;
    cpScore += blended * w;
    cpWeight += w;
    headlines.push({
      title: post.title, source: post.source,
      sentiment: blended > 0.1 ? 'bullish' : blended < -0.1 ? 'bearish' : 'neutral',
      score: blended, publishedAt: post.publishedAt,
    });
  }
  const cpNorm = cpWeight > 0 ? cpScore / cpWeight : 0;
  totalWeightedScore += cpNorm * 3; // weight: 3x (best source)
  totalWeight += cpWeight > 0 ? 3 : 0;

  // ── Stocktwits (user-tagged bullish/bearish) ──
  let stBullish = 0, stBearish = 0, stTotal = 0;
  for (const msg of stocktwitsMessages) {
    if (!msg.sentiment) continue;
    stTotal++;
    if (msg.sentiment === 'Bullish') stBullish++;
    else stBearish++;
    const s = msg.sentiment === 'Bullish' ? 0.7 : -0.7;
    headlines.push({
      title: msg.text.slice(0, 100),
      source: 'stocktwits',
      sentiment: msg.sentiment === 'Bullish' ? 'bullish' : 'bearish',
      score: s,
      publishedAt: msg.publishedAt,
    });
  }
  const stScore = stTotal > 0 ? (stBullish - stBearish) / stTotal : 0;
  totalWeightedScore += stScore * 2;
  totalWeight += stTotal > 0 ? 2 : 0;

  // ── Reddit (keyword scored, weighted by upvotes) ──
  let rdScore = 0, rdWeight = 0;
  for (const post of redditPosts) {
    const s = scoreText(post.title);
    if (s === 0) continue;
    const w = recencyWeight(post.publishedAt) * Math.log1p(post.score + 1);
    rdScore += s * w;
    rdWeight += w;
    headlines.push({
      title: post.title, source: `r/${post.subreddit}`,
      sentiment: s > 0.1 ? 'bullish' : s < -0.1 ? 'bearish' : 'neutral',
      score: s, publishedAt: post.publishedAt,
    });
  }
  const rdNorm = rdWeight > 0 ? rdScore / rdWeight : 0;
  totalWeightedScore += rdNorm * 1.5;
  totalWeight += rdWeight > 0 ? 1.5 : 0;

  // ── CryptoCompare (general news keyword scored) ──
  let ccScore = 0, ccWeight = 0;
  const coinLower = coin.toLowerCase();
  for (const item of cryptoComparePosts) {
    const relevant = item.title.toLowerCase().includes(coinLower) ||
      item.categories.toLowerCase().includes(coinLower);
    if (!relevant) continue;
    const s = scoreText(item.title);
    if (s === 0) continue;
    const w = recencyWeight(item.publishedAt);
    ccScore += s * w;
    ccWeight += w;
    headlines.push({
      title: item.title, source: item.source,
      sentiment: s > 0.1 ? 'bullish' : s < -0.1 ? 'bearish' : 'neutral',
      score: s, publishedAt: item.publishedAt,
    });
  }
  const ccNorm = ccWeight > 0 ? ccScore / ccWeight : 0;
  totalWeightedScore += ccNorm * 1;
  totalWeight += ccWeight > 0 ? 1 : 0;

  // ── Final score ──
  const finalScore = totalWeight > 0
    ? Math.max(-1, Math.min(1, totalWeightedScore / totalWeight))
    : 0;

  const confidence = Math.min(1, totalWeight / 7); // max confidence at 7 weight units

  // Sort headlines by recency + absolute score, keep top 10
  headlines.sort((a, b) =>
    (Math.abs(b.score) * recencyWeight(b.publishedAt)) -
    (Math.abs(a.score) * recencyWeight(a.publishedAt))
  );

  const result: SentimentSignal = {
    score: finalScore,
    label: toLabel(finalScore),
    confidence,
    headlines: headlines.slice(0, 10),
    breakdown: {
      cryptoPanic: cpNorm,
      stocktwits: stScore,
      reddit: rdNorm,
      cryptoCompare: ccNorm,
    },
    fetchedAt: Date.now(),
  };

  sentimentCache.set(coin, result);
  return result;
}
