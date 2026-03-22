// Server-side 1-hour cache
const cache: { value: FearGreedData | null; expiresAt: number } = { value: null, expiresAt: 0 };

export interface FearGreedData {
  value: number;          // 0-100
  label: string;          // "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed"
  timestamp: number;
}

export async function fetchFearGreed(): Promise<FearGreedData> {
  if (cache.value && Date.now() < cache.expiresAt) return cache.value;
  const res = await fetch('https://api.alternative.me/fng/?limit=1', { next: { revalidate: 3600 } });
  const json = await res.json();
  const item = json.data[0];
  const result: FearGreedData = {
    value: parseInt(item.value),
    label: item.value_classification,
    timestamp: parseInt(item.timestamp) * 1000,
  };
  cache.value = result;
  cache.expiresAt = Date.now() + 3600_000;
  return result;
}
