import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
export function useUsuarios() {
  return useQuery({
    queryKey: ['lookups', 'usuarios'],
    queryFn: async () => {
      const res = await api.lookups.usuarios.$get();
      if (!res.ok) throw new Error('Falha ao buscar usuários');
      return res.json();
    },
  });
}

export function useEspeciesProcesso() {
  return useQuery({
    queryKey: ['lookups', 'especies-processo'],
    queryFn: async () => {
      const res = await api.lookups['especies-processo'].$get();
      if (!res.ok) throw new Error('Falha ao buscar espécies');
      return res.json();
    },
  });
}

export function useTiposAcao() {
  return useQuery({
    queryKey: ['lookups', 'tipos-acao'],
    queryFn: async () => {
      const res = await api.lookups['tipos-acao'].$get();
      if (!res.ok) throw new Error('Falha ao buscar tipos de ação');
      return res.json();
    },
  });
}

export function useRitosProcessuais() {
  return useQuery({
    queryKey: ['lookups', 'ritos-processuais'],
    queryFn: async () => {
      const res = await api.lookups['ritos-processuais'].$get();
      if (!res.ok) throw new Error('Falha ao buscar ritos');
      return res.json();
    },
  });
}

export function useLocalizacoesProcesso() {
  return useQuery({
    queryKey: ['lookups', 'localizacoes-processo'],
    queryFn: async () => {
      const res = await api.lookups['localizacoes-processo'].$get();
      if (!res.ok) throw new Error('Falha ao buscar localizações');
      return res.json();
    },
  });
}

export function usePosicoesParte() {
  return useQuery({
    queryKey: ['lookups', 'posicoes-parte'],
    queryFn: async () => {
      const res = await api.lookups['posicoes-parte'].$get();
      if (!res.ok) throw new Error('Falha ao buscar posições de parte');
      return res.json();
    },
  });
}

/**
 * Cadastro sob demanda das tabelas de domínio de processos. Permite que o
 * usuário registre um tipo de ação / rito / localização que o escritório usa
 * mas que não veio na carga inicial, sem sair do formulário.
 */
type LookupEntry = { codigo: string; descricao: string };

function useCreateLookup(
  key: 'tipos-acao' | 'ritos-processuais' | 'localizacoes-processo',
  erro: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (descricao: string): Promise<LookupEntry> => {
      const res = await api.lookups[key].$post({ json: { descricao } });
      if (!res.ok) {
        const err = (await res.json()) as any;
        throw new Error(err.error || erro);
      }
      return (await res.json()) as LookupEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lookups', key] });
    },
  });
}

export function useCreateTipoAcao() {
  return useCreateLookup('tipos-acao', 'Falha ao cadastrar tipo de ação');
}

export function useCreateRitoProcessual() {
  return useCreateLookup('ritos-processuais', 'Falha ao cadastrar rito');
}

export function useCreateLocalizacaoProcesso() {
  return useCreateLookup('localizacoes-processo', 'Falha ao cadastrar localização');
}
