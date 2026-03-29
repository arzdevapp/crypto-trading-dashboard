import type { ExchangeAdapter } from '../exchange/ExchangeAdapter';

export interface FundingOISignal {
  fundingRate: number;           // raw rate (e.g. 0.0001 = 0.01%)
  openInterest: number;          // total OI in base currency
  openInterestChange: number;    // % change vs previous cached value (0 on first fetch)
  signal: number;                // composite score -1.0 to +1.0
  label: string;                 // human-readable interpretation
  fetchedAt: number;
}

// ── Per-symbol cache (5-minute TTL) ─────────────────────────────────────────
interface CacheEntry {
  data: FundingOISignal;
  prevOI: number;
  prevPrice: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch funding rate + open interest from the exchange, compute a composite
 * directional signal, and cache the result for 5 minutes.
 *
 * The composite signal blends two sub-signals:
 *
 *   1. **Funding direction** — high positive funding means overleveraged longs
 *      (bearish for price because longs are paying shorts, suggesting crowded
 *      positioning).  High negative funding is the inverse.
 *
 *   2. **OI trend vs price direction** — rising OI with rising price confirms
 *      the up-trend; rising OI with falling price confirms the down-trend.
 *      Falling OI means positions are closing and the trend is weakening.
 *
 * If the exchange does not support futures data (spot-only), returns a neutral
 * signal with zeroed fields so the caller can proceed without error.
 */
export async function getFundingOISignal(
  adapter: ExchangeAdapter,
  symbol: string,
  currentPrice?: number,
): Promise<FundingOISignal> {
  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.data.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  let fundingRate = 0;
  let openInterest = 0;

  // Funding rate
  try {
    const fr = await adapter.fetchFundingRate(symbol);
    fundingRate = fr.rate;
  } catch {
    // Exchange may not support futures — proceed with 0
  }

  // Open interest
  try {
    const oi = await adapter.fetchOpenInterest(symbol);
    openInterest = oi.openInterest;
  } catch {
    // Exchange may not support futures — proceed with 0
  }

  // If both calls returned nothing, return neutral early
  if (fundingRate === 0 && openInterest === 0) {
    const neutral: FundingOISignal = {
      fundingRate: 0,
      openInterest: 0,
      openInterestChange: 0,
      signal: 0,
      label: 'No futures data',
      fetchedAt: Date.now(),
    };
    return neutral;
  }

  // ── Compute OI % change from previous fetch ──────────────────────────────
  const prevOI = cached?.prevOI ?? openInterest;
  const openInterestChange = prevOI > 0 ? ((openInterest - prevOI) / prevOI) * 100 : 0;

  // ── Sub-signal 1: Funding direction (weight 0.6) ─────────────────────────
  // Normalize funding rate to a -1..+1 range.
  // Typical 8h funding is +-0.01% (0.0001). Extreme is +-0.1% (0.001).
  // Clamp at +-0.003 (0.3%) for the mapping.
  const clampedRate = Math.max(-0.003, Math.min(0.003, fundingRate));
  // Positive funding → bearish (longs pay shorts, crowded long).
  // Invert so that positive signal = bullish.
  const fundingSignal = -(clampedRate / 0.003); // -1..+1

  // ── Sub-signal 2: OI trend vs price (weight 0.4) ─────────────────────────
  let oiSignal = 0;
  const price = currentPrice ?? 0;
  const prevPrice = cached?.prevPrice ?? 0;
  // Only compute OI trend when we have a previous data point to compare against.
  // On first fetch there is no prior OI/price — oiSignal stays 0 (neutral).
  if (cached && prevPrice > 0 && price > 0 && prevOI > 0) {
    const priceUp = price > prevPrice;
    const oiUp = openInterest > prevOI;

    if (oiUp && priceUp) oiSignal = 0.8;      // trend confirmation (bull)
    else if (oiUp && !priceUp) oiSignal = -0.8; // trend confirmation (bear)
    else if (!oiUp && priceUp) oiSignal = 0.3;  // short squeeze / weak trend
    else if (!oiUp && !priceUp) oiSignal = -0.3; // capitulation / weak bear
  }

  // ── Composite ────────────────────────────────────────────────────────────
  const composite = fundingSignal * 0.6 + oiSignal * 0.4;
  const signal = Math.max(-1, Math.min(1, composite));

  let label: string;
  if (signal >= 0.5) label = 'Overleveraged Shorts';
  else if (signal >= 0.2) label = 'Mildly Bullish';
  else if (signal <= -0.5) label = 'Overleveraged Longs';
  else if (signal <= -0.2) label = 'Mildly Bearish';
  else label = 'Neutral';

  const result: FundingOISignal = {
    fundingRate,
    openInterest,
    openInterestChange,
    signal,
    label,
    fetchedAt: Date.now(),
  };

  cache.set(symbol, { data: result, prevOI: openInterest, prevPrice: price });
  return result;
}
