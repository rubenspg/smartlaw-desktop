import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ClienteNotaInput } from '@smartlaw/shared';

export function useClientesNotas(clienteId: number) {
  return useQuery({
    queryKey: ['clientes-notas', clienteId],
    queryFn: async () => {
      const res = await api.clientes.notas[':clienteId'].$get({
        param: { clienteId: clienteId.toString() },
      });
      if (!res.ok) throw new Error('Falha ao buscar notas do cliente');
      return res.json();
    },
    enabled: !!clienteId,
  });
}

export function useCreateClienteNota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ClienteNotaInput) => {
      const res = await api.clientes.notas.$post({
        json: data,
      });
      if (!res.ok) throw new Error('Falha ao criar nota');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clientes-notas', variables.clienteId] });
    },
  });
}

export function useDeleteClienteNota(clienteId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.clientes.notas[':id'].$delete({
        param: { id: id.toString() },
      });
      if (!res.ok) throw new Error('Falha ao excluir nota');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes-notas', clienteId] });
    },
  });
}
