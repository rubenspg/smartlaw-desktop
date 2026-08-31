import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Clock, 
  User as UserIcon, 
  Users, 
  AlignLeft, 
  Calendar,
  Edit2,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { type Tarefa } from '@smartlaw/shared';
import { cn } from '@/lib/utils';

interface TarefaDetailsProps {
  tarefa: Tarefa;
  onEdit: (tarefa: Tarefa) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

export function TarefaDetails({ tarefa, onEdit, onDelete, onClose }: TarefaDetailsProps) {
  const getPriorityColor = (p: string | null) => {
    switch (p) {
      case 'ALTA': return 'bg-red-500/10 text-red-600 border-red-200';
      case 'MEDIA': return 'bg-amber-500/10 text-amber-600 border-amber-200';
      case 'BAIXA': return 'bg-blue-500/10 text-blue-600 border-blue-200';
      default: return 'bg-slate-500/10 text-slate-600 border-slate-200';
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'CONCLUIDA':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-none uppercase text-[10px] font-black">Realizado</Badge>;
      case 'CANCELADA':
        return <Badge className="bg-red-500/10 text-red-600 border-none uppercase text-[10px] font-black">Cancelado</Badge>;
      default:
        return <Badge className="bg-primary/10 text-primary border-none uppercase text-[10px] font-black">Pendente</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Status */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-2xl font-black text-foreground leading-tight tracking-tight">
            {tarefa.titulo}
          </h2>
          {getStatusBadge(tarefa.status)}
        </div>
        
        <div className="flex flex-wrap gap-3">
          <Badge variant="outline" className={cn("px-2 py-0.5 rounded-lg border font-bold text-[10px] uppercase tracking-widest", getPriorityColor(tarefa.prioridade))}>
            Prioridade {tarefa.prioridade}
          </Badge>
          {tarefa.dataLimite && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-muted rounded-lg text-muted-foreground text-[10px] font-black uppercase tracking-widest">
              <Calendar className="w-3 h-3" />
              {format(parseISO(tarefa.dataLimite), "dd 'de' MMMM", { locale: ptBR })}
            </div>
          )}
        </div>
      </div>

      <Separator className="bg-border/40" />

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Date & Time */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/5 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Horário Agendado</p>
            <p className="text-sm font-bold text-foreground">
              {tarefa.dataLimite 
                ? format(parseISO(tarefa.dataLimite), "HH:mm'h'", { locale: ptBR })
                : 'Horário não definido'}
            </p>
          </div>
        </div>

        {/* Responsible */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/5 flex items-center justify-center shrink-0">
            <UserIcon className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Responsável / Advogado</p>
            <p className="text-sm font-bold text-foreground">{tarefa.usuario?.nome || 'Não atribuído'}</p>
          </div>
        </div>

        {/* Client */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/5 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente Associado</p>
            <p className="text-sm font-bold text-foreground">{tarefa.cliente?.nome || 'Nenhum cliente associado'}</p>
          </div>
        </div>

        {/* Location / Context (Optional - could add later) */}
      </div>

      {/* Description / Notes */}
      <div className="space-y-3 p-4 bg-muted/30 rounded-2xl border border-border/40">
        <div className="flex items-center gap-2">
          <AlignLeft className="w-4 h-4 text-primary" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Observações e Conteúdo</p>
        </div>
        <div className="text-sm font-medium text-foreground/80 leading-relaxed whitespace-pre-wrap">
          {tarefa.descricao || <span className="italic text-muted-foreground/50">Nenhuma observação adicional foi registrada para este compromisso.</span>}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-4 flex items-center gap-3">
        <Button 
          onClick={() => onEdit(tarefa)}
          className="flex-1 rounded-xl h-11 font-black uppercase text-xs tracking-widest shadow-premium"
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Editar Informações
        </Button>
        <Button 
          variant="outline" 
          onClick={() => confirm('Deseja excluir este compromisso?') && onDelete(tarefa.id)}
          className="rounded-xl h-11 px-4 text-destructive hover:bg-destructive/10 hover:text-destructive border-border/60"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
