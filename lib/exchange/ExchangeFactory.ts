import { ExchangeAdapter } from './ExchangeAdapter';
import { prisma } from '@/lib/db';
import { decrypt, isEncrypted } from '@/lib/encryption';

interface CachedAdapter {
  adapter: ExchangeAdapter;
  createdAt: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — forces re-read of keys periodically
const cache = new Map<string, CachedAdapter>();

export async function getExchangeAdapter(exchangeId: string): Promise<ExchangeAdapter> {
  const cached = cache.get(exchangeId);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return cached.adapter;
  }

  const config = await prisma.exchangeConfig.findUnique({ where: { id: exchangeId } });
  if (!config) throw new Error(`Exchange config not found: ${exchangeId}`);

  // Decrypt keys — isEncrypted guard handles legacy plaintext rows already in DB
  const apiKey = isEncrypted(config.apiKey) ? decrypt(config.apiKey) : config.apiKey;
  const apiSecret = isEncrypted(config.apiSecret) ? decrypt(config.apiSecret) : config.apiSecret;

  const adapter = new ExchangeAdapter(config.name, apiKey, apiSecret, config.sandbox);
  cache.set(exchangeId, { adapter, createdAt: Date.now() });
  return adapter;
}

export function clearExchangeCache(exchangeId?: string) {
  if (exchangeId) cache.delete(exchangeId);
  else cache.clear();
}
