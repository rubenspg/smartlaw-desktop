import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  Clock,
  ExternalLink,
  Calendar,
  Plus,
  ClipboardCheck,
  CheckCircle2,
  MoreVertical,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle,
  User as UserIcon,
  Users,
  Loader2,
  RefreshCw,
  Activity,
  MessageSquare,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTarefas, useCreateTarefa, useUpdateTarefa, useDeleteTarefa, useToggleTarefaStatus } from '@/hooks/use-tarefas';
import { useAndamentosRecentes, useResumoPendencias, useResumoIA } from '@/hooks/use-dashboard';
import { Sparkles, Eye } from 'lucide-react';
import { TarefaForm } from '@/components/shared/tarefa-form';
import { TarefaDetails } from '@/components/shared/tarefa-details';
import { Tarefa, TarefaInput } from '@smartlaw/shared';
import { useRegional } from '@/components/regional-provider';
import { cn } from '@/lib/utils';
import { openUrl } from '@tauri-apps/plugin-opener';

export const Route = createFileRoute('/_dashboard/')({
  component: HomeComponent,
});

// ... andamentos const remains same ...

function HomeComponent() {
  const navigate = useNavigate();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewingTarefa, setViewingTarefa] = useState<Tarefa | undefined>(undefined);
  const [editingTarefa, setEditingTarefa] = useState<Tarefa | undefined>(undefined);
  const [confirmingTarefa, setConfirmingTarefa] = useState<Tarefa | undefined>(undefined);

  const { formatDate, t } = useRegional();
  const { data: tarefas, isLoading: isLoadingTarefas } = useTarefas();
  const { data: andamentosRecentes, isLoading: isLoadingAndamentos, refetch: refetchAndamentos } = useAndamentosRecentes();
  const { data: pendencias } = useResumoPendencias();
  const { data: resumoIA, isFetching: isLoadingResumoIA } = useResumoIA(pendencias);
  const createTarefa = useCreateTarefa();
  const updateTarefa = useUpdateTarefa(editingTarefa?.id || 0);
  const toggleStatus = useToggleTarefaStatus();
  const deleteTarefa = useDeleteTarefa();

  const handleWhatsApp = async (cliente: any) => {
    const numberToUse = cliente.celular || cliente.telefone1 || cliente.telefone2;
    if (!numberToUse) return;
    const cleaned = numberToUse.replace(/\D/g, '');
    const number = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
    await openUrl(`https://wa.me/${number}`);
  };

  const handleCreate = () => {
    setEditingTarefa(undefined);
    setIsFormOpen(true);
  };

  const handleView = (tarefa: Tarefa) => {
    setViewingTarefa(tarefa);
    setIsDetailsOpen(true);
  };

  const handleEdit = (tarefa: Tarefa) => {
    setEditingTarefa(tarefa);
    setIsDetailsOpen(false);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: number) => {
    await deleteTarefa.mutateAsync(id);
    setIsDetailsOpen(false);
  };

  const handleToggleClick = (tarefa: Tarefa) => {
    if (tarefa.status === 'CONCLUIDA') {
      toggleStatus.mutate({
        id: tarefa.id,
        data: {
          usuarioId: tarefa.usuarioId,
          titulo: tarefa.titulo,
          descricao: tarefa.descricao,
          dataLimite: tarefa.dataLimite,
          prioridade: tarefa.prioridade as any,
          status: 'PENDENTE' as any,
        },
      });
    } else {
      setConfirmingTarefa(tarefa);
    }
  };

  const handleConfirmConcluir = async () => {
    if (!confirmingTarefa) return;
    await toggleStatus.mutateAsync({
      id: confirmingTarefa.id,
      data: {
        usuarioId: confirmingTarefa.usuarioId,
        titulo: confirmingTarefa.titulo,
        descricao: confirmingTarefa.descricao,
        dataLimite: confirmingTarefa.dataLimite,
        prioridade: confirmingTarefa.prioridade as any,
        status: 'CONCLUIDA' as any,
      },
    });
    setConfirmingTarefa(undefined);
  };

  const onSubmit = async (data: TarefaInput) => {
    try {
      if (editingTarefa) {
        await updateTarefa.mutateAsync(data);
      } else {
        await createTarefa.mutateAsync(data);
      }
      setIsFormOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getPriorityColor = (p: string | null) => {
    switch (p) {
      case 'ALTA': return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400';
      case 'MEDIA': return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';
      case 'BAIXA': return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-10 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-foreground tracking-tight">{t('nav.home')}</h1>
          <p className="text-muted-foreground text-lg mt-1 font-semibold">{t('home.welcome')}</p>
        </div>
        <div className="flex items-center gap-3">
           <Button 
            onClick={handleCreate}
            className="rounded-xl shadow-premium hover:shadow-premium-lg transition-all active:scale-95"
          >
            <Plus className="w-4.5 h-4.5 mr-2" />
            {t('home.new_task')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Andamentos Recentes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <h3 className="text-xl font-bold text-foreground">{t('home.recent_updates')}</h3>
            </div>
            <button
              onClick={() => refetchAndamentos()}
              className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all active:scale-90"
              title="Atualizar"
            >
              <RefreshCw className={cn('w-4 h-4', isLoadingAndamentos && 'animate-spin')} />
            </button>
          </div>
          
          <Card className="border border-border/40 shadow-premium flex flex-col bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-0 overflow-auto max-h-[600px] custom-scrollbar">
              {isLoadingAndamentos ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin mb-2 text-primary/30" />
                </div>
              ) : andamentosRecentes?.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center p-8">
                  <div className="w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center mb-4 shadow-inner">
                    <Clock className="w-10 h-10 text-muted-foreground/50" />
                  </div>
                  <p className="text-muted-foreground font-semibold">Nenhum andamento registrado.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Os novos eventos aparecerão aqui automaticamente.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {andamentosRecentes?.map((a) => {
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
                        {isSistema && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive" />
                        )}
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
                                <div className="flex items-center gap-1.5">
                                  <span 
                                    className="text-xs font-bold text-foreground hover:text-primary transition-colors cursor-pointer underline decoration-transparent hover:decoration-primary/30 underline-offset-4"
                                    onClick={() => navigate({ to: '/clientes/$id', params: { id: cliente.id.toString() } })}
                                  >
                                    · {cliente.nome}
                                  </span>
                                  {((cliente as any).celular || (cliente as any).telefone1 || (cliente as any).telefone2) && (
                                    <button 
                                      onClick={() => handleWhatsApp(cliente)}
                                      className="text-emerald-600 hover:text-emerald-700 transition-colors p-1 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                      title="WhatsApp"
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
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

        {/* Sidebar Cards */}
        <div className="space-y-8">
          {/* Tarefas */}
          <div className="space-y-4">
             <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-primary" />
                <h3 className="text-xl font-bold text-foreground">{t('home.tasks')}</h3>
              </div>
            </div>

            <Card className="border border-border/40 shadow-premium min-h-[500px] flex flex-col bg-card/50 backdrop-blur-sm overflow-hidden">
              <CardContent className="flex-1 p-0 overflow-auto max-h-[600px] custom-scrollbar">
                {isLoadingTarefas ? (
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
                    {tarefas?.map((tarefa: Tarefa) => (
                      <div 
                        key={tarefa.id} 
                        className={cn(
                          "p-5 group hover:bg-primary/5 transition-all cursor-pointer relative",
                          tarefa.status === 'CONCLUIDA' && "opacity-50 grayscale"
                        )}
                        onClick={() => handleView(tarefa)}
                      >
                        <div className="flex items-start gap-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleClick(tarefa); }}
                            className={cn(
                              "mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shadow-sm",
                              tarefa.status === 'CONCLUIDA' 
                                ? "bg-emerald-500 border-emerald-500 text-white" 
                                : "border-border/60 hover:border-primary bg-background"
                            )}
                          >
                            {tarefa.status === 'CONCLUIDA' && <CheckCircle className="w-4 h-4" />}
                          </button>
                          
                          <div className="flex-1 min-w-0 space-y-1">
                            <h4 className={cn(
                              "text-sm font-bold truncate leading-none",
                              tarefa.status === 'CONCLUIDA' ? "text-muted-foreground line-through" : "text-foreground/90"
                            )}>
                              {tarefa.titulo}
                            </h4>
                            {tarefa.descricao && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic font-medium">
                                {tarefa.descricao}
                              </p>
                            )}
                            
                            <div className="flex flex-wrap items-center gap-3 mt-3">
                              <Badge className={cn("text-[10px] px-1.5 py-0 border-none font-black tracking-widest uppercase rounded-md shadow-sm", getPriorityColor(tarefa.prioridade))}>
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
                              <DropdownMenuItem onClick={() => handleView(tarefa)} className="rounded-lg">
                                <Eye className="w-3.5 h-3.5 mr-2" />
                                Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(tarefa)} className="rounded-lg">
                                <Edit2 className="w-3.5 h-3.5 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(tarefa.id)}
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
        </div>
      </div>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="w-full sm:max-w-2xl rounded-3xl p-8 overflow-hidden border-none shadow-2xl">
          {viewingTarefa && (
            <TarefaDetails 
              tarefa={viewingTarefa}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onClose={() => setIsDetailsOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="w-full sm:max-w-5xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary/5 p-8 border-b border-primary/10">
            <DialogTitle className="text-3xl font-black uppercase tracking-tight flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <Plus className="w-7 h-7 text-primary-foreground" />
              </div>
              {editingTarefa ? 'Editar Compromisso' : 'Novo Agendamento'}
            </DialogTitle>
          </div>
          
          <div className="p-8">
            <TarefaForm
              initialData={editingTarefa}
              onSubmit={onSubmit}
              isSubmitting={createTarefa.isPending || updateTarefa.isPending}
              onCancel={() => setIsFormOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmingTarefa} onOpenChange={(open) => !open && setConfirmingTarefa(undefined)}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Concluir tarefa?</DialogTitle>
            <DialogDescription>
              Deseja marcar <strong>"{confirmingTarefa?.titulo}"</strong> como concluída?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setConfirmingTarefa(undefined)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmConcluir}
              disabled={toggleStatus.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {toggleStatus.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Sim, concluída
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
