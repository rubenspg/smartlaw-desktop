import { useQuery } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { api } from '../lib/api';
import type { AndamentoRecente, DashboardStats } from '../lib/entities';

export function useDashboardStats(year?: number, month?: number) {
  return useQuery({
    queryKey: ['dashboard', 'stats', year, month],
    queryFn: async () => {
      const query: any = {};
      if (year) query.year = year.toString();
      if (month) query.month = month.toString();

      const res = await api.dashboard.$get({
        query: query
      });
      if (!res.ok) throw new Error('Falha ao buscar estatísticas');
      return (await res.json()) as DashboardStats;
    },
    staleTime: 30_000,
    refetchInterval: 60_000, // Atualiza a cada minuto
  });
}

export interface ResumoPendencias {
  tarefasPendentes: number;
  tarefasHoje: number;
  tarefasAtrasadas: number;
  processosJudiciaisAtivos: number;
  processosAdminAtivos: number;
}

export function useResumoPendencias() {
  return useQuery({
    queryKey: ['dashboard', 'resumo-pendencias'],
    queryFn: async () => {
      const res = await api.dashboard['resumo-pendencias'].$get();
      if (!res.ok) throw new Error('Falha ao buscar resumo de pendências');
      return (await res.json()) as ResumoPendencias;
    },
    staleTime: 60_000,
    // Safety net so the counts self-heal even if a mutation forgets to
    // invalidate ['dashboard']; mutations still invalidate for immediacy.
    refetchInterval: 60_000,
  });
}

export type ResumoDia = InferResponseType<(typeof api.dashboard)['resumo-ia']['$get'], 200>;

/** "Resumo do dia" da tela inicial (texto da IA ou o calculado, mais os destaques). */
export function useResumoDia() {
  return useQuery({
    queryKey: ['dashboard', 'resumo-ia'],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<ResumoDia> => {
      const res = await api.dashboard['resumo-ia'].$get();
      if (!res.ok) throw new Error('Falha ao montar o resumo do dia');
      return await res.json();
    },
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
