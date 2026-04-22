import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { AndamentoRecente, DashboardStats } from '@smartlaw/shared';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const res = await api.dashboard.$get();
      if (!res.ok) throw new Error('Falha ao buscar estatísticas');
      return (await res.json()) as DashboardStats;
    },
    staleTime: 60_000,
  });
}

export function useAndamentosRecentes() {
  return useQuery({
    queryKey: ['dashboard', 'recentes'],
    queryFn: async () => {
      const res = await api.dashboard.recentes.$get();
      if (!res.ok) throw new Error('Falha ao buscar andamentos recentes');
      return (await res.json()) as AndamentoRecente[];
    },
    refetchInterval: 60_000,
  });
}
