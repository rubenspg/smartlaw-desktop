import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { TarefaInput } from '@smartlaw/shared';

export function useTarefas(filters: { status?: string; usuarioId?: string } = {}) {
  return useQuery({
    queryKey: ['tarefas', filters],
    queryFn: async () => {
      const res = await api.tarefas.$get({
        query: {
          status: filters.status,
          usuarioId: filters.usuarioId,
        },
      });
      if (!res.ok) throw new Error('Falha ao buscar tarefas');
      return res.json();
    },
  });
}

export function useTarefa(id: number) {
  return useQuery({
    queryKey: ['tarefa', id],
    queryFn: async () => {
      const res = await api.tarefas[':id'].$get({
        param: { id: id.toString() },
      });
      if (!res.ok) throw new Error('Falha ao buscar tarefa');
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateTarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TarefaInput) => {
      const res = await api.tarefas.$post({
        json: data as any,
      });
      if (!res.ok) {
        const errData = await res.json() as any;
        throw new Error(errData.error || 'Falha ao criar tarefa');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] });
    },
  });
}

export function useUpdateTarefa(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TarefaInput) => {
      const res = await api.tarefas[':id'].$put({
        param: { id: id.toString() },
        json: data as any,
      });
      if (!res.ok) {
        const errData = await res.json() as any;
        throw new Error(errData.error || 'Falha ao atualizar tarefa');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] });
      queryClient.invalidateQueries({ queryKey: ['tarefa', id] });
    },
  });
}

export function useToggleTarefaStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TarefaInput }) => {
      const res = await api.tarefas[':id'].$put({
        param: { id: id.toString() },
        json: data as any,
      });
      if (!res.ok) {
        const errData = await res.json() as any;
        throw new Error(errData.error || 'Falha ao atualizar tarefa');
      }
      return res.json();
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] });
      queryClient.invalidateQueries({ queryKey: ['tarefa', id] });
    },
  });
}

export function useDeleteTarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.tarefas[':id'].$delete({
        param: { id: id.toString() },
      });
      if (!res.ok) {
        const errData = await res.json() as any;
        throw new Error(errData.error || 'Falha ao excluir tarefa');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] });
    },
  });
}
