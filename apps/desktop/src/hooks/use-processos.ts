import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ProcessoJudicialInput, ProcessoAdministrativoInput } from '@smartlaw/shared';

export function useProcessosJudiciais(filters: { q?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['processos-judiciais', filters],
    queryFn: async () => {
      const res = await api.processos.judiciais.$get({
        query: {
          q: filters.q,
          page: filters.page?.toString(),
          limit: filters.limit?.toString(),
        },
      });
      if (!res.ok) throw new Error('Falha ao buscar processos judiciais');
      return res.json();
    },
  });
}

export function useProcessoJudicial(id: number) {
  return useQuery({
    queryKey: ['processo-judicial', id],
    queryFn: async () => {
      const res = await api.processos.judiciais[':id'].$get({
        param: { id: id.toString() },
      });
      if (!res.ok) throw new Error('Falha ao buscar processo judicial');
      return res.json();
    },
    enabled: !!id,
  });
}

export function useProcessosAdministrativos(filters: { q?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['processos-administrativos', filters],
    queryFn: async () => {
      const res = await api.processos.administrativos.$get({
        query: {
          q: filters.q,
          page: filters.page?.toString(),
          limit: filters.limit?.toString(),
        },
      });
      if (!res.ok) throw new Error('Falha ao buscar processos administrativos');
      return res.json();
    },
  });
}

export function useProcessoAdministrativo(id: number) {
  return useQuery({
    queryKey: ['processo-administrativo', id],
    queryFn: async () => {
      const res = await api.processos.administrativos[':id'].$get({
        param: { id: id.toString() },
      });
      if (!res.ok) throw new Error('Falha ao buscar processo administrativo');
      return res.json();
    },
    enabled: !!id,
  });
}

export function useProcessosJudiciaisByCliente(clienteId: number) {
  return useQuery({
    queryKey: ['processos-judiciais', { clienteId }],
    queryFn: async () => {
      const res = await api.processos.judiciais.$get({
        query: { clienteId: clienteId.toString(), limit: '100' },
      });
      if (!res.ok) throw new Error('Falha ao buscar processos judiciais');
      return res.json();
    },
    enabled: !!clienteId,
  });
}

export function useProcessosAdministrativosByCliente(clienteId: number) {
  return useQuery({
    queryKey: ['processos-administrativos', { clienteId }],
    queryFn: async () => {
      const res = await api.processos.administrativos.$get({
        query: { clienteId: clienteId.toString(), limit: '100' },
      });
      if (!res.ok) throw new Error('Falha ao buscar processos administrativos');
      return res.json();
    },
    enabled: !!clienteId,
  });
}

export function useCreateProcessoAdministrativo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ProcessoAdministrativoInput) => {
      const res = await api.processos.administrativos.$post({
        json: data as any,
      });
      if (!res.ok) throw new Error('Falha ao criar processo administrativo');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos-administrativos'] });
    },
  });
}

export function useUpdateProcessoAdministrativo(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ProcessoAdministrativoInput) => {
      const res = await api.processos.administrativos[':id'].$put({
        param: { id: id.toString() },
        json: data as any,
      });
      if (!res.ok) throw new Error('Falha ao atualizar processo administrativo');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos-administrativos'] });
      queryClient.invalidateQueries({ queryKey: ['processo-administrativo', id] });
    },
  });
}

export function useDeleteProcessoAdministrativo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.processos.administrativos[':id'].$delete({
        param: { id: id.toString() },
      });
      if (!res.ok) throw new Error('Falha ao excluir processo administrativo');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos-administrativos'] });
    },
  });
}

export function useDatajudSearch() {
  return useMutation({
    mutationFn: async (numero: string) => {
      const res = await api.processos.judiciais.datajud.search.$post({
        json: { numero },
      });
      if (!res.ok) {
        const error = await res.json() as any;
        throw new Error(error.error || 'Falha na busca do Datajud');
      }
      return res.json();
    },
  });
}

export function useCreateProcessoJudicial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ProcessoJudicialInput) => {
      const res = await api.processos.judiciais.$post({
        json: data as any,
      });
      if (!res.ok) throw new Error('Falha ao criar processo judicial');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos-judiciais'] });
    },
  });
}

export function useSyncProcesso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.processos.judiciais[':id'].sync.$post({
        param: { id: id.toString() },
      });
      if (!res.ok) {
        const error = await res.json() as any;
        throw new Error(error.error || 'Falha na sincronização');
      }
      return res.json();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['processos-judiciais'] });
      queryClient.invalidateQueries({ queryKey: ['processo-judicial', id] });
    },
  });
}
