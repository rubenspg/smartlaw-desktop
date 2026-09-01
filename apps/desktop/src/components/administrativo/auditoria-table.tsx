import { useState } from 'react';
import { Search, History, Loader2, Calendar, User as UserIcon, Eye } from 'lucide-react';
import type { AuditLog } from '@/lib/entities';
import { cn } from '@/lib/utils';

interface AuditoriaTableProps {
  logs: AuditLog[] | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  onSelect: (log: AuditLog) => void;
}

export function AuditoriaTable({ logs, isLoading, onRefresh, onSelect }: AuditoriaTableProps) {
  const [search, setSearch] = useState('');

  const filtered = (logs ?? []).filter(
    (log) =>
      log.tableName?.toLowerCase().includes(search.toLowerCase()) ||
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.usuario?.nome?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filtrar por tabela, ação ou usuário..."
              className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={onRefresh}
            className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
            title="Atualizar logs"
          >
            <History className={cn('w-5 h-5 text-muted-foreground', isLoading && 'animate-spin')} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/30 text-[10px] font-black uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-4 py-3">Data / Hora</th>
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Tabela</th>
                <th className="px-4 py-3">ID Registro</th>
                <th className="px-4 py-3 text-right">Dados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground italic">
                    Nenhum log de auditoria registrado.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors text-xs">
                    <td className="px-4 py-3 font-medium whitespace-nowrap text-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        {log.createdAt ? new Date(log.createdAt).toLocaleString('pt-BR') : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-foreground">
                        <UserIcon className="w-3 h-3 text-muted-foreground" />
                        <span className="truncate max-w-[140px]">
                          {log.usuario?.nome ?? 'Sistema / Automático'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'font-black px-2 py-0.5 rounded text-[9px] uppercase',
                          log.action === 'INSERT' && 'bg-green-500/20 text-green-500',
                          log.action === 'UPDATE' && 'bg-blue-500/20 text-blue-500',
                          log.action === 'DELETE' && 'bg-destructive/20 text-destructive',
                        )}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground uppercase">
                      {log.tableName}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
                      {log.recordId}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onSelect(log)}
                        className="p-1.5 hover:bg-primary/10 text-primary rounded-lg transition-all"
                        title="Ver detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
