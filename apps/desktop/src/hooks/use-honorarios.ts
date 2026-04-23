import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Honorario, HonorarioInput, HonorarioSummary } from '@smartlaw/shared';

export function useHonorarios(filters: { status?: string; page?: number; limit?: number; month?: number; year?: number }) {
  return useQuery({
    queryKey: ['honorarios', filters],
    queryFn: async () => {
      const res = await api.honorarios.$get({
        query: {
          status: filters.status,
          page: filters.page?.toString(),
          limit: filters.limit?.toString(),
          month: filters.month?.toString(),
          year: filters.year?.toString(),
        },
      });
      if (!res.ok) throw new Error('Falha ao buscar honorários');
      return (await res.json()) as Honorario[];
    },
  });
}

export function useHonorarioSummary(filters: { month?: number; year?: number } = {}) {
  return useQuery({
    queryKey: ['honorarios', 'summary', filters],
    queryFn: async () => {
      const res = await api.honorarios.summary.$get({
        query: {
          month: filters.month?.toString(),
          year: filters.year?.toString(),
        },
      });
      if (!res.ok) throw new Error('Falha ao buscar resumo financeiro');
      return (await res.json()) as HonorarioSummary;
    },
  });
}

export function useCreateHonorario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: HonorarioInput) => {
      const res = await api.honorarios.$post({ json: data as any });
      if (!res.ok) {
        const err = (await res.json()) as any;
        throw new Error(err.error || 'Falha ao criar honorário');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['honorarios'] });
    },
  });
}

export function useUpdateHonorario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: HonorarioInput }) => {
      const res = await api.honorarios[':id'].$put({
        param: { id: id.toString() },
        json: data as any,
      });
      if (!res.ok) {
        const err = (await res.json()) as any;
        throw new Error(err.error || 'Falha ao atualizar honorário');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['honorarios'] });
    },
  });
}

export function useDeleteHonorario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.honorarios[':id'].$delete({ param: { id: id.toString() } });
      if (!res.ok) {
        const err = (await res.json()) as any;
        throw new Error(err.error || 'Falha ao excluir honorário');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['honorarios'] });
    },
  });
}
