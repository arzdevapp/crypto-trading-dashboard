'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PlaceOrderParams, Order } from '@/types/order';

export function useOpenOrders(exchangeId: string | null, symbol?: string) {
  return useQuery<Order[]>({
    queryKey: ['openOrders', exchangeId, symbol],
    queryFn: async () => {
      if (!exchangeId) return [];
      const url = `/api/orders?exchangeId=${exchangeId}${symbol ? `&symbol=${encodeURIComponent(symbol)}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch orders');
      return res.json();
    },
    enabled: !!exchangeId,
    refetchInterval: 30000,
    staleTime: 25000,
  });
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: PlaceOrderParams & { exchangeId: string }) => {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to place order');
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['openOrders', vars.exchangeId] });
      queryClient.invalidateQueries({ queryKey: ['balance', vars.exchangeId] });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, symbol, exchangeId }: { orderId: string; symbol: string; exchangeId: string }) => {
      const res = await fetch(`/api/orders/${orderId}?symbol=${encodeURIComponent(symbol)}&exchangeId=${exchangeId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to cancel order');
    },
    onSuccess: (_, vars) => queryClient.invalidateQueries({ queryKey: ['openOrders', vars.exchangeId] }),
  });
}
