import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { HonorarioInput } from '@smartlaw/shared';

export function useHonorarios(filters: { status?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['honorarios', filters],
    queryFn: async () => {
      const res = await api.honorarios.$get({
        query: {
          status: filters.status,
          page: filters.page?.toString(),
          limit: filters.limit?.toString(),
        },
      });
      if (!res.ok) throw new Error('Falha ao buscar honorários');
      return res.json();
    },
  });
}

export function useCreateHonorario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: HonorarioInput) => {
      const res = await api.honorarios.$post({
        json: data as any,
      });
      if (!res.ok) throw new Error('Falha ao criar honorário');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['honorarios'] });
    },
  });
}
