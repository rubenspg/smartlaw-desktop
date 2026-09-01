import {
  ClipboardCheck,
  Loader2,
  CheckCircle2,
  CheckCircle,
  Clock,
  User as UserIcon,
  Users,
  MoreVertical,
  Eye,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRegional } from '@/components/regional-provider';
import type { Tarefa } from '@/lib/entities';
import { cn } from '@/lib/utils';

interface TarefaListCardProps {
  tarefas: Tarefa[] | undefined;
  isLoading: boolean;
  onView: (tarefa: Tarefa) => void;
  onEdit: (tarefa: Tarefa) => void;
  onDelete: (id: number) => void;
  onToggle: (tarefa: Tarefa) => void;
}

function priorityColor(p: string | null): string {
  switch (p) {
    case 'ALTA': return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400';
    case 'MEDIA': return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';
    case 'BAIXA': return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400';
    default: return 'bg-muted text-muted-foreground';
  }
}

export function TarefaListCard({ tarefas, isLoading, onView, onEdit, onDelete, onToggle }: TarefaListCardProps) {
  const { formatDate, t } = useRegional();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-bold text-foreground">{t('home.tasks')}</h3>
        </div>
      </div>

      <Card className="border border-border/40 shadow-premium min-h-[500px] flex flex-col bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardContent className="flex-1 p-0 overflow-auto max-h-[600px] custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full p-10 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-sm font-medium">Carregando...</p>
            </div>
          ) : tarefas?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-10 text-center">
              <div className="w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center mb-4 shadow-inner">
                <CheckCircle2 className="w-10 h-10 text-muted-foreground/30" />
              </div>
              <p className="text-muted-foreground font-bold">Tudo em dia!</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Você não tem tarefas pendentes.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {tarefas?.map((tarefa) => (
                <div
                  key={tarefa.id}
                  className={cn(
                    'p-5 group hover:bg-primary/5 transition-all cursor-pointer relative',
                    tarefa.status === 'CONCLUIDA' && 'opacity-50 grayscale',
                  )}
                  onClick={() => onView(tarefa)}
                >
                  <div className="flex items-start gap-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggle(tarefa); }}
                      className={cn(
                        'mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shadow-sm',
                        tarefa.status === 'CONCLUIDA'
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-border/60 hover:border-primary bg-background',
                      )}
                    >
                      {tarefa.status === 'CONCLUIDA' && <CheckCircle className="w-4 h-4" />}
                    </button>

                    <div className="flex-1 min-w-0 space-y-1">
                      <h4 className={cn(
                        'text-sm font-bold truncate leading-none',
                        tarefa.status === 'CONCLUIDA' ? 'text-muted-foreground line-through' : 'text-foreground/90',
                      )}>
                        {tarefa.titulo}
                      </h4>
                      {tarefa.descricao && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic font-medium">
                          {tarefa.descricao}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 mt-3">
                        <Badge className={cn('text-[10px] px-1.5 py-0 border-none font-black tracking-widest uppercase rounded-md shadow-sm', priorityColor(tarefa.prioridade))}>
                          {tarefa.prioridade}
                        </Badge>

                        {tarefa.dataLimite && (
                          <div className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDate(tarefa.dataLimite, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}

                        <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground/70 uppercase tracking-wider">
                          <UserIcon className="w-3.5 h-3.5" />
                          {tarefa.usuario?.nome.split(' ')[0]}
                        </div>

                        {tarefa.cliente && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">
                            <Users className="w-3 h-3" />
                            {tarefa.cliente.nome.split(' ')[0]}
                          </div>
                        )}
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl shadow-premium-lg border-border/40">
                        <DropdownMenuItem onClick={() => onView(tarefa)} className="rounded-lg">
                          <Eye className="w-3.5 h-3.5 mr-2" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(tarefa)} className="rounded-lg">
                          <Edit2 className="w-3.5 h-3.5 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete(tarefa.id)}
                          className="text-destructive focus:text-destructive rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
