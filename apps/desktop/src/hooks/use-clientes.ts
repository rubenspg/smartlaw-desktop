import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { errorMessage, invalidateDashboard } from '../lib/api-helpers';
import { ClienteInput } from '@smartlaw/shared';

export function useClientes(filters: { q?: string; situacao?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['clientes', filters],
    queryFn: async () => {
      const res = await api.clientes.$get({
        query: {
          q: filters.q,
          situacao: filters.situacao,
          page: filters.page?.toString(),
          limit: filters.limit?.toString(),
        },
      });
      if (!res.ok) throw new Error('Falha ao buscar clientes');
      return res.json();
    },
  });
}

export function useCliente(id: number) {
  return useQuery({
    queryKey: ['cliente', id],
    queryFn: async () => {
      const res = await api.clientes[':id'].$get({
        param: { id: id.toString() },
      });
      if (!res.ok) throw new Error('Falha ao buscar cliente');
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ClienteInput) => {
      const res = await api.clientes.$post({
        json: data,
      });
      if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao criar cliente'));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      invalidateDashboard(queryClient);
    },
  });
}

export function useUpdateCliente(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ClienteInput) => {
      const res = await api.clientes[':id'].$put({
        param: { id: id.toString() },
        json: data,
      });
      if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao atualizar cliente'));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['cliente', id] });
      invalidateDashboard(queryClient);
    },
  });
}

export function useDeleteCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.clientes[':id'].$delete({
        param: { id: id.toString() },
      });
      if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao excluir cliente'));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      invalidateDashboard(queryClient);
    },
  });
}
