'use client';
import { useQuery } from '@tanstack/react-query';
import type { BalanceSheet } from '@/types/exchange';

export function useBalance(exchangeId: string | null) {
  return useQuery<BalanceSheet>({
    queryKey: ['balance', exchangeId],
    queryFn: async () => {
      if (!exchangeId) return {};
      const res = await fetch(`/api/exchanges/${exchangeId}/balance`);
      if (!res.ok) throw new Error('Failed to fetch balance');
      return res.json();
    },
    enabled: !!exchangeId,
    refetchInterval: 10000, // Sync every 10 seconds (matches ticker refresh)
    staleTime: 5000,        // Mark as stale after 5 seconds
    gcTime: 5 * 60 * 1000,  // Keep in cache for 5 minutes
  });
}

export function useMarkets(exchangeId: string | null) {
  return useQuery({
    queryKey: ['markets', exchangeId],
    queryFn: async () => {
      if (!exchangeId) return [];
      const res = await fetch(`/api/exchanges/${exchangeId}/markets`);
      if (!res.ok) throw new Error('Failed to fetch markets');
      return res.json();
    },
    enabled: !!exchangeId,
    staleTime: 5 * 60 * 1000,
  });
}
