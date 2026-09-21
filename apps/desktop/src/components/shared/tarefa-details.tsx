import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Clock,
  User as UserIcon,
  Users,
  AlignLeft,
  Calendar,
  Edit2,
  Trash2,
  Video,
  Scale,
  ExternalLink,
  UserCheck,
  Loader2,
  Briefcase,
  FileText,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { type Tarefa } from '@/lib/entities';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/lib/auth';
import { useUpdateTarefa } from '@/hooks/use-tarefas';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface TarefaDetailsProps {
  tarefa: Tarefa;
  onEdit: (tarefa: Tarefa) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
  onAssumir?: (tarefa: Tarefa) => Promise<void> | void;
}

export function TarefaDetails({
  tarefa,
  onEdit,
  onDelete,
  onClose,
  onAssumir,
}: TarefaDetailsProps) {
  const confirm = useConfirm();
  const { user } = useAuth();
  const toast = useToast();
  const updateMutation = useUpdateTarefa(tarefa.id);
  const [isAssuming, setIsAssuming] = useState(false);

  const handleAssumir = async () => {
    if (!user) return;
    setIsAssuming(true);
    try {
      if (onAssumir) {
        await onAssumir(tarefa);
      } else {
        await updateMutation.mutateAsync({
          titulo: tarefa.titulo,
          prioridade: tarefa.prioridade as any,
          status: tarefa.status as any,
          categoria: (tarefa.categoria as any) ?? 'GERAL',
          link: tarefa.link ?? null,
          clienteId: tarefa.clienteId ?? null,
          processoJudicialId: tarefa.processoJudicialId ?? null,
          processoAdminId: tarefa.processoAdminId ?? null,
          descricao: tarefa.descricao ?? null,
          dataLimite: tarefa.dataLimite ? new Date(tarefa.dataLimite).toISOString() : null,
          usuarioId: user.id,
        });
      }
      toast.success('Você assumiu esta tarefa com sucesso!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Falha ao assumir tarefa');
    } finally {
      setIsAssuming(false);
    }
  };

  const getPriorityColor = (p: string | null) => {
    switch (p) {
      case 'ALTA':
        return 'bg-red-500/10 text-red-600 border-red-200';
      case 'MEDIA':
        return 'bg-amber-500/10 text-amber-600 border-amber-200';
      case 'BAIXA':
        return 'bg-blue-500/10 text-blue-600 border-blue-200';
      default:
        return 'bg-slate-500/10 text-slate-600 border-slate-200';
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'CONCLUIDA':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-none uppercase text-[10px] font-black">
            Realizado
          </Badge>
        );
      case 'CANCELADA':
        return (
          <Badge className="bg-red-500/10 text-red-600 border-none uppercase text-[10px] font-black">
            Cancelado
          </Badge>
        );
      default:
        return (
          <Badge className="bg-primary/10 text-primary border-none uppercase text-[10px] font-black">
            Pendente
          </Badge>
        );
    }
  };

  const getCategoriaBadge = (cat: string | null | undefined) => {
    switch (cat) {
      case 'AUDIENCIA':
        return (
          <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200/50 uppercase text-[10px] font-black tracking-wider flex items-center gap-1.5 px-2.5 py-0.5">
            <Scale className="w-3 h-3" />
            Audiência
          </Badge>
        );
      case 'PRAZO':
        return (
          <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200/50 uppercase text-[10px] font-black tracking-wider flex items-center gap-1.5 px-2.5 py-0.5">
            <Clock className="w-3 h-3" />
            Prazo Fatal
          </Badge>
        );
      case 'REUNIAO':
        return (
          <Badge className="bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-200/50 uppercase text-[10px] font-black tracking-wider flex items-center gap-1.5 px-2.5 py-0.5">
            <Users className="w-3 h-3" />
            Reunião
          </Badge>
        );
      case 'DILIGENCIA':
        return (
          <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200/50 uppercase text-[10px] font-black tracking-wider flex items-center gap-1.5 px-2.5 py-0.5">
            <Briefcase className="w-3 h-3" />
            Diligência
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-200/50 uppercase text-[10px] font-black tracking-wider flex items-center gap-1.5 px-2.5 py-0.5">
            <FileText className="w-3 h-3" />
            Geral
          </Badge>
        );
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

        <div className="flex flex-wrap items-center gap-3">
          {getCategoriaBadge(tarefa.categoria)}
          <Badge
            variant="outline"
            className={cn(
              'px-2 py-0.5 rounded-lg border font-bold text-[10px] uppercase tracking-widest',
              getPriorityColor(tarefa.prioridade),
            )}
          >
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

      {/* Reunião / Videoconferência Link Banner */}
      {tarefa.link && (
        <div className="p-3.5 bg-primary/5 rounded-2xl border border-primary/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Video className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                Videoconferência / Reunião Online
              </p>
              <p className="text-xs font-semibold text-foreground/80 truncate">{tarefa.link}</p>
            </div>
          </div>
          <Button
            size="sm"
            asChild
            className="rounded-xl h-9 px-4 font-black uppercase text-[11px] tracking-wider shrink-0 shadow-sm"
          >
            <a
              href={tarefa.link.startsWith('http') ? tarefa.link : `https://${tarefa.link}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Acessar
            </a>
          </Button>
        </div>
      )}

      {/* Botão Assumir Tarefa da Equipe */}
      {!tarefa.usuarioId && user && (
        <Button
          variant="secondary"
          onClick={handleAssumir}
          disabled={isAssuming}
          className="w-full rounded-2xl h-12 bg-primary/10 hover:bg-primary/20 text-primary font-black uppercase text-xs tracking-widest border border-primary/20 transition-all active:scale-[0.99] shadow-sm flex items-center justify-center gap-2"
        >
          {isAssuming ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <UserCheck className="w-4 h-4" />
          )}
          Assumir Tarefa da Equipe
        </Button>
      )}

      <Separator className="bg-border/40" />

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Date & Time */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/5 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Horário Agendado
            </p>
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
            {tarefa.usuario ? (
              <UserIcon className="w-5 h-5 text-primary" />
            ) : (
              <Users className="w-5 h-5 text-primary" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Responsável / Atribuição
            </p>
            <p className="text-sm font-bold text-foreground">
              {tarefa.usuario?.nome || 'Toda a Equipe (Geral)'}
            </p>
          </div>
        </div>

        {/* Client */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/5 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Cliente Associado
            </p>
            {tarefa.cliente ? (
              <Link
                to="/clientes/$id"
                params={{ id: String(tarefa.cliente.id) }}
                className="text-sm font-bold text-primary hover:underline"
              >
                {tarefa.cliente.nome}
              </Link>
            ) : (
              <p className="text-sm font-bold text-muted-foreground">Nenhum cliente associado</p>
            )}
          </div>
        </div>

        {/* Processo Judicial */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/5 flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Processo Judicial
            </p>
            {tarefa.processoJudicial ? (
              <Link
                to="/processos/$id"
                params={{ id: String(tarefa.processoJudicial.id) }}
                className="text-sm font-bold text-primary hover:underline flex items-center gap-1.5"
              >
                {tarefa.processoJudicial.numero}
                <ExternalLink className="w-3 h-3" />
              </Link>
            ) : (
              <p className="text-sm font-bold text-muted-foreground">Nenhum processo associado</p>
            )}
          </div>
        </div>
      </div>

      {/* Description / Notes */}
      <div className="space-y-3 p-4 bg-muted/30 rounded-2xl border border-border/40">
        <div className="flex items-center gap-2">
          <AlignLeft className="w-4 h-4 text-primary" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Observações e Conteúdo
          </p>
        </div>
        <div className="text-sm font-medium text-foreground/80 leading-relaxed whitespace-pre-wrap">
          {tarefa.descricao || (
            <span className="italic text-muted-foreground/50">
              Nenhuma observação adicional foi registrada para este compromisso.
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex items-center gap-3">
        <Button
          onClick={() => onEdit(tarefa)}
          className="flex-1 rounded-xl h-11 font-black uppercase text-xs tracking-widest shadow-premium"
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Editar Informações
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            if (
              await confirm({
                description: 'Deseja excluir este compromisso?',
                destructive: true,
                confirmText: 'Excluir',
              })
            ) {
              onDelete(tarefa.id);
            }
          }}
          className="rounded-xl h-11 px-4 text-destructive hover:bg-destructive/10 hover:text-destructive border-border/60"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
