import { ExchangeAdapter } from './ExchangeAdapter';
import { prisma } from '@/lib/db';
import { decrypt, isEncrypted } from '@/lib/encryption';

const cache = new Map<string, ExchangeAdapter>();

export async function getExchangeAdapter(exchangeId: string): Promise<ExchangeAdapter> {
  if (cache.has(exchangeId)) return cache.get(exchangeId)!;

  const config = await prisma.exchangeConfig.findUnique({ where: { id: exchangeId } });
  if (!config) throw new Error(`Exchange config not found: ${exchangeId}`);

  // Decrypt keys — isEncrypted guard handles legacy plaintext rows already in DB
  const apiKey = isEncrypted(config.apiKey) ? decrypt(config.apiKey) : config.apiKey;
  const apiSecret = isEncrypted(config.apiSecret) ? decrypt(config.apiSecret) : config.apiSecret;

  const adapter = new ExchangeAdapter(config.name, apiKey, apiSecret, config.sandbox);
  cache.set(exchangeId, adapter);
  return adapter;
}

export function clearExchangeCache(exchangeId?: string) {
  if (exchangeId) cache.delete(exchangeId);
  else cache.clear();
}
