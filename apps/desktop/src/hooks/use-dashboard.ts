import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { AndamentoRecente, DashboardStats } from '@smartlaw/shared';

export function useDashboardStats(year?: number) {
  return useQuery({
    queryKey: ['dashboard', 'stats', year],
    queryFn: async () => {
      const res = await api.dashboard.$get(
        year ? ({ query: { year: year.toString() } } as any) : undefined,
      );
      if (!res.ok) throw new Error('Falha ao buscar estatísticas');
      const data = await res.json();
      console.log('Hook useDashboardStats received:', Object.keys(data));
      return data as DashboardStats;
    },
    staleTime: 0,
    gcTime: 0,
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
    staleTime: 5 * 60_000,
  });
}

export type ResumoIAStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

export function useResumoIA(_pendencias?: ResumoPendencias) {
  return useQuery({
    queryKey: ['dashboard', 'resumo-ia'],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<{ texto: string; status: ResumoIAStatus }> => {
      const res = await api.dashboard['resumo-ia'].$get();
      if (!res.ok) {
        return { texto: 'Falha ao gerar resumo.', status: 'error' };
      }
      const data = await res.json() as { texto: string; status: ResumoIAStatus };
      return { texto: data.texto, status: data.status };
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
