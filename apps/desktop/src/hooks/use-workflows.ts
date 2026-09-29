import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { WorkflowInput } from '@smartlaw/shared';
import { api } from '../lib/api';
import { errorMessage } from '../lib/api-helpers';

export function useWorkflows() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const res = await api.workflows.$get();
      if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao buscar fluxos'));
      return res.json();
    },
  });
}

export function useWorkflow(id: number) {
  return useQuery({
    queryKey: ['workflow', id],
    queryFn: async () => {
      const res = await api.workflows[':id'].$get({ param: { id: id.toString() } });
      if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao buscar fluxo'));
      return res.json();
    },
    enabled: !!id,
  });
}

export function useWorkflowExecucoes(workflowId?: number) {
  return useQuery({
    queryKey: ['workflow-execucoes', workflowId ?? 'todas'],
    queryFn: async () => {
      const res = await api.workflows.execucoes.$get({
        query: { workflowId: workflowId?.toString() },
      });
      if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao buscar histórico'));
      return res.json();
    },
  });
}

export function useSalvarWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: number; data: WorkflowInput }) => {
      const res = id
        ? await api.workflows[':id'].$put({ param: { id: id.toString() }, json: data })
        : await api.workflows.$post({ json: data });
      if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao salvar fluxo'));
      return res.json();
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      if (id) queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

export function useAlternarWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: number; ativo: boolean }) => {
      const res = await api.workflows[':id'].ativo.$patch({
        param: { id: id.toString() },
        json: { ativo },
      });
      if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao atualizar fluxo'));
      return res.json();
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

export function useExcluirWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.workflows[':id'].$delete({ param: { id: id.toString() } });
      if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao excluir fluxo'));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}
