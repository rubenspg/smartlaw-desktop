import { useNavigate, Link } from '@tanstack/react-router';
import {
  Activity,
  RefreshCw,
  Loader2,
  Clock,
  Calendar,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useRegional } from '@/components/regional-provider';
import type { AndamentoRecente } from '@/lib/entities';
import { cn } from '@/lib/utils';

interface AndamentosRecentesCardProps {
  andamentos: AndamentoRecente[] | undefined;
  isLoading: boolean;
  onRefresh: () => void;
}

export function AndamentosRecentesCard({ andamentos, isLoading, onRefresh }: AndamentosRecentesCardProps) {
  const navigate = useNavigate();
  const { formatDate, t } = useRegional();

  return (
    <div className="lg:col-span-2 space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-bold text-foreground">{t('home.recent_updates')}</h3>
        </div>
        <button
          onClick={onRefresh}
          className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all active:scale-90"
          title="Atualizar"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </button>
      </div>

      <Card className="border border-border/40 shadow-premium flex flex-col bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0 overflow-auto max-h-[600px] custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-primary/30" />
            </div>
          ) : andamentos?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-8">
              <div className="w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center mb-4 shadow-inner">
                <Clock className="w-10 h-10 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground font-semibold">Nenhum andamento registrado.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Os novos eventos aparecerão aqui automaticamente.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {andamentos?.map((a) => {
                const isSistema = a.tipo === 'SISTEMA';
                const isJudicial = !!a.processoJudicialId;
                const processo = isJudicial ? a.processoJudicial : a.processoAdmin;
                const cliente = processo?.cliente;
                const link = isJudicial
                  ? `/processos/${a.processoJudicialId}`
                  : `/processos/admin/${a.processoAdminId}`;

                return (
                  <div
                    key={a.id}
                    className={cn(
                      'p-5 hover:bg-primary/5 transition-all group relative overflow-hidden',
                      isSistema && 'bg-destructive/[0.02] hover:bg-destructive/[0.05]',
                    )}
                  >
                    {isSistema && <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive" />}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isSistema ? (
                            <Badge variant="destructive" className="text-[9px] font-black px-1.5 py-0 rounded-md uppercase tracking-widest border-none shadow-sm">
                              <AlertCircle className="w-2.5 h-2.5 mr-1" /> URGENTE
                            </Badge>
                          ) : isJudicial ? (
                            <Badge className="text-[9px] font-black px-1.5 py-0 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border-none uppercase tracking-widest">
                              Judicial
                            </Badge>
                          ) : (
                            <Badge className="text-[9px] font-black px-1.5 py-0 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none uppercase tracking-widest">
                              Admin
                            </Badge>
                          )}
                          {processo && (
                            <span className="text-xs font-mono font-bold text-foreground/80 bg-muted/50 px-2 py-0.5 rounded-lg border border-border/30">
                              {processo.numero}
                            </span>
                          )}
                          {cliente && (
                            <span
                              className="text-xs font-bold text-foreground hover:text-primary transition-colors cursor-pointer underline decoration-transparent hover:decoration-primary/30 underline-offset-4"
                              onClick={() => navigate({ to: '/clientes/$id', params: { id: cliente.id.toString() } })}
                            >
                              · {cliente.nome}
                            </span>
                          )}
                        </div>
                        {a.historico && (
                          <p className="text-sm text-foreground/80 font-medium leading-relaxed line-clamp-2 italic">
                            "{a.historico}"
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70 font-bold uppercase tracking-wider">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(a.inclusao)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(a.inclusao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      {processo && (
                        <Link
                          to={link as any}
                          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Ver processo"
                        >
                          <ExternalLink className="w-4.5 h-4.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
