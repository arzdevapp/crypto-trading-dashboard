import { ExchangeAdapter } from './ExchangeAdapter';
import { prisma } from '@/lib/db';

const cache = new Map<string, ExchangeAdapter>();

export async function getExchangeAdapter(exchangeId: string): Promise<ExchangeAdapter> {
  if (cache.has(exchangeId)) return cache.get(exchangeId)!;

  const config = await prisma.exchangeConfig.findUnique({ where: { id: exchangeId } });
  if (!config) throw new Error(`Exchange config not found: ${exchangeId}`);

  const adapter = new ExchangeAdapter(config.name, config.apiKey, config.apiSecret, config.sandbox);
  cache.set(exchangeId, adapter);
  return adapter;
}

export function clearExchangeCache(exchangeId?: string) {
  if (exchangeId) cache.delete(exchangeId);
  else cache.clear();
}
