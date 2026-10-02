import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ClienteSituacaoInput } from '@smartlaw/shared';
import { api } from '../lib/api';
import { errorMessage } from '../lib/api-helpers';

export function useClienteSituacoes() {
  return useQuery({
    queryKey: ['cliente-situacoes'],
    queryFn: async () => {
      const res = await api['cliente-situacoes'].$get();
      if (!res.ok) throw new Error('Falha ao buscar situações de cliente');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSalvarClienteSituacao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: number; data: ClienteSituacaoInput }) => {
      const res = id
        ? await api['cliente-situacoes'][':id'].$put({ param: { id: id.toString() }, json: data })
        : await api['cliente-situacoes'].$post({ json: data });
      if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao salvar situação'));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-situacoes'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}

export function useExcluirClienteSituacao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api['cliente-situacoes'][':id'].$delete({ param: { id: id.toString() } });
      if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao excluir situação'));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-situacoes'] });
    },
  });
}
