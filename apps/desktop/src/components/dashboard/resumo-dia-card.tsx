import { AlertTriangle, ChevronRight, RefreshCw, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRegional } from '@/components/regional-provider';
import type { ResumoDia } from '@/hooks/use-dashboard';
import { cn } from '@/lib/utils';

interface ResumoDiaCardProps {
  resumo: ResumoDia | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  onRefresh: () => void;
  onAbrirTarefa: (id: number) => void;
}

const TOM: Record<ResumoDia['destaques'][number]['tom'], string> = {
  urgente: 'border-destructive/30 bg-destructive/5 text-destructive',
  atencao: 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400',
  neutro: 'border-border/40 bg-muted/30 text-foreground',
};

/**
 * "Resumo do dia": o texto (da IA, ou o calculado quando ela não está
 * disponível), os números que o sustentam e as tarefas vencidas ou de hoje.
 */
export function ResumoDiaCard({ resumo, isLoading, isFetching, isError, onRefresh, onAbrirTarefa }: ResumoDiaCardProps) {
  const { formatDate } = useRegional();

  return (
    <section className="space-y-4" aria-label="Resumo do dia">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-bold text-foreground">Resumo do dia</h3>
          {resumo && (
            <Badge
              className="text-[9px] font-black px-1.5 py-0 rounded-md bg-primary/10 text-primary border-none uppercase tracking-widest"
              title={
                resumo.origem === 'ia'
                  ? 'Texto escrito pela IA a partir de contagens, sem nomes nem números de processo, e conferido número a número.'
                  : 'Texto montado pelo sistema, sem IA.'
              }
            >
              {resumo.origem === 'ia' ? 'IA' : 'Calculado'}
            </Badge>
          )}
        </div>
        <button
          onClick={onRefresh}
          className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all active:scale-90"
          title="Atualizar"
        >
          <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
        </button>
      </div>

      <Card className="border border-border/40 shadow-premium bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-6 space-y-5">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-8/12" />
              <div className="flex gap-3 pt-2">
                <Skeleton className="h-14 w-32" />
                <Skeleton className="h-14 w-32" />
                <Skeleton className="h-14 w-32" />
              </div>
            </div>
          ) : isError || !resumo ? (
            <p className="text-sm text-muted-foreground font-medium">Não foi possível montar o resumo do dia.</p>
          ) : (
            <>
              <p className="text-base text-foreground/90 font-medium leading-relaxed">{resumo.resumo}</p>

              {resumo.pontos.length > 0 && (
                <ul className="space-y-1.5">
                  {resumo.pontos.map((p) => (
                    <li key={p.titulo} className="text-sm text-foreground/80 leading-relaxed">
                      <span className="font-bold text-foreground">{p.titulo}:</span> {p.detalhe}
                    </li>
                  ))}
                </ul>
              )}

              {resumo.avisos.map((aviso) => (
                <div
                  key={aviso}
                  className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-400"
                >
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  {aviso}
                </div>
              ))}

              <div className="flex flex-wrap gap-3">
                {resumo.destaques.map((d) => (
                  <div key={d.chave} className={cn('rounded-xl border px-4 py-2 min-w-[7.5rem]', TOM[d.tom])}>
                    <div className="text-2xl font-extrabold leading-tight tabular-nums">{d.valor}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{d.rotulo}</div>
                  </div>
                ))}
              </div>

              {resumo.itens.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    Vencidas e de hoje
                  </h4>
                  <div className="divide-y divide-border/30 rounded-xl border border-border/40 overflow-hidden">
                    {resumo.itens.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => onAbrirTarefa(item.id)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-primary/5 transition-colors group"
                      >
                        <span
                          className={cn(
                            'shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest',
                            item.atrasada
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
                          )}
                        >
                          {item.atrasada ? formatDate(item.dataLimite) : 'Hoje'}
                        </span>
                        <span className="flex-1 min-w-0 truncate text-sm font-semibold text-foreground">{item.titulo}</span>
                        {item.prioridade === 'ALTA' && (
                          <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-destructive">Alta</span>
                        )}
                        <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
