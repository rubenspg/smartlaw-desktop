import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { AuditLog } from '@smartlaw/shared';

export function useAuditLogs(filters: { q?: string; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['audit-logs', filters.q ?? ''],
    queryFn: async () => {
      const res = await api['audit-logs'].$get({
        query: { q: filters.q },
      });
      if (!res.ok) throw new Error('Falha ao buscar logs');
      return (await res.json()) as AuditLog[];
    },
    enabled: filters.enabled ?? true,
    refetchInterval: 15_000,
  });
}
