import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Usuario, UsuarioInput, UsuarioUpdateInput } from '@smartlaw/shared';

export function useUsuarios() {
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const res = await api.usuarios.$get();
      if (!res.ok) throw new Error('Falha ao buscar usuários');
      return (await res.json()) as Usuario[];
    },
  });
}

export function useCreateUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UsuarioInput) => {
      const res = await api.usuarios.$post({ json: data as any });
      if (!res.ok) {
        const err = (await res.json()) as any;
        throw new Error(err.error || 'Falha ao criar usuário');
      }
      return (await res.json()) as Usuario;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });
}

export function useUpdateUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UsuarioUpdateInput }) => {
      const res = await api.usuarios[':id'].$patch({
        param: { id },
        json: data as any,
      });
      if (!res.ok) {
        const err = (await res.json()) as any;
        throw new Error(err.error || 'Falha ao atualizar usuário');
      }
      return (await res.json()) as Usuario;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });
}

export function useDeleteUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.usuarios[':id'].$delete({ param: { id } });
      if (!res.ok) {
        const err = (await res.json()) as any;
        throw new Error(err.error || 'Falha ao remover usuário');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });
}
