'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { StrategyRecord } from '@/types/strategy';

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function useStrategies() {
  return useQuery<StrategyRecord[]>({
    queryKey: ['strategies'],
    queryFn: async () => {
      const res = await fetch('/api/strategies');
      if (!res.ok) throw new Error('Failed to fetch strategies');
      return res.json();
    },
    refetchInterval: 30000,
  });
}

export function useToggleStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'start' | 'stop' }) => {
      const res = await fetch(`/api/strategies/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(await parseError(res, 'Failed to toggle strategy'));
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['strategies'] }),
  });
}

export function useCreateStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await parseError(res, 'Failed to create strategy'));
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['strategies'] }),
  });
}

export function useDeleteStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/strategies/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await parseError(res, 'Failed to delete strategy'));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['strategies'] }),
  });
}
