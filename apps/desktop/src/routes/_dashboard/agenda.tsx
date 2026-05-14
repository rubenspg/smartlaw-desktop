import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar as CalendarIcon, 
  Clock, 
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Filter,
  Loader2,
  CalendarDays,
  CalendarRange,
  Columns,
  Eye
} from 'lucide-react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  isToday,
  parseISO,
  startOfDay,
  setHours,
  isSameHour,
  addWeeks,
  subWeeks,
  differenceInMinutes,
  eachHourOfInterval
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTarefas, useCreateTarefa, useUpdateTarefa, useDeleteTarefa, useToggleTarefaStatus } from '@/hooks/use-tarefas';
import { useUsuarios } from '@/hooks/use-lookups';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { TarefaForm } from '@/components/shared/tarefa-form';
import { TarefaDetails } from '@/components/shared/tarefa-details';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type Tarefa, type TarefaInput } from '@smartlaw/shared';
import { Separator } from '@/components/ui/separator';

export const Route = createFileRoute('/_dashboard/agenda')({
  component: AgendaPage,
});

type ViewMode = 'month' | 'week';

function AgendaPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  
  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewingTarefa, setViewingTarefa] = useState<Tarefa | undefined>(undefined);
  const [editingTarefa, setEditingTarefa] = useState<Tarefa | undefined>(undefined);

  const { user } = useAuth();
  const { data: usuarios } = useUsuarios();
  const { data: tarefas, isLoading } = useTarefas({ 
    usuarioId: selectedUser === 'all' ? undefined : selectedUser 
  });
  
  const createTarefa = useCreateTarefa();
  const updateTarefa = useUpdateTarefa(editingTarefa?.id || 0);
  const toggleStatus = useToggleTarefaStatus();
  const deleteTarefa = useDeleteTarefa();

  const handlePrev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(subWeeks(currentDate, 1));
  };

  const handleNext = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addWeeks(currentDate, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const handleCreate = (date?: Date) => {
    setSelectedDate(date || new Date());
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

  // Calendar Logic
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const weekStart = startOfWeek(currentDate, { locale: ptBR });
  const weekEnd = endOfWeek(currentDate, { locale: ptBR });

  const calendarDays = eachDayOfInterval({
    start: viewMode === 'month' ? startOfWeek(monthStart, { locale: ptBR }) : weekStart,
    end: viewMode === 'month' ? endOfWeek(monthEnd, { locale: ptBR }) : weekEnd,
  });

  const getTasksForDay = (day: Date) => {
    return (tarefas || []).filter(t => t.dataLimite && isSameDay(parseISO(String(t.dataLimite)), day))
      .sort((a, b) => {
        if (!a.dataLimite || !b.dataLimite) return 0;
        return new Date(a.dataLimite).getTime() - new Date(b.dataLimite).getTime();
      });
  };

  const hours = eachHourOfInterval({
    start: setHours(startOfDay(new Date()), 7),
    end: setHours(startOfDay(new Date()), 21),
  });

  const getPriorityColor = (p: string | null) => {
    switch (p) {
      case 'ALTA': return 'bg-red-500';
      case 'MEDIA': return 'bg-amber-500';
      case 'BAIXA': return 'bg-blue-500';
      default: return 'bg-slate-400';
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-primary" />
            Agenda do Escritório
          </h1>
          <p className="text-muted-foreground font-medium">Gestão de consultas, prazos e tarefas dos doutores.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-muted/50 p-1.5 rounded-2xl border border-border/50">
          <div className="flex items-center gap-2 bg-background rounded-xl p-1 shadow-sm border">
            <Button 
              variant={viewMode === 'month' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setViewMode('month')}
              className={cn("rounded-lg font-bold h-8 text-xs", viewMode === 'month' && "shadow-sm")}
            >
              Mês
            </Button>
            <Button 
              variant={viewMode === 'week' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setViewMode('week')}
              className={cn("rounded-lg font-bold h-8 text-xs", viewMode === 'week' && "shadow-sm")}
            >
              Semana
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6 hidden sm:block" />

          <div className="flex items-center gap-1">
             <Button variant="ghost" size="icon" onClick={handlePrev} className="h-9 w-9 rounded-xl hover:bg-background shadow-sm">
                <ChevronLeft className="w-4 h-4" />
             </Button>
             <div className="px-4 text-sm font-black uppercase tracking-widest min-w-[160px] text-center">
                {viewMode === 'month' 
                  ? format(currentDate, 'MMMM yyyy', { locale: ptBR })
                  : `Semana de ${format(weekStart, 'dd/MM', { locale: ptBR })}`
                }
             </div>
             <Button variant="ghost" size="icon" onClick={handleNext} className="h-9 w-9 rounded-xl hover:bg-background shadow-sm">
                <ChevronRight className="w-4 h-4" />
             </Button>
          </div>
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          <Button variant="outline" size="sm" onClick={handleToday} className="rounded-xl font-bold h-9 bg-background">
            Hoje
          </Button>
          <Button onClick={() => handleCreate()} size="sm" className="rounded-xl font-black h-9 shadow-premium">
            <Plus className="w-4 h-4 mr-1.5" /> Agendar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar / Filters */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-border/40 shadow-premium bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/40 py-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary" />
                <CardTitle className="text-xs font-black uppercase tracking-widest text-foreground/80">Filtrar Agenda</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Colaborador / Doutor</label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger className="rounded-xl border-border/50 bg-background/50 h-10 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all" className="font-bold uppercase text-[10px]">Todos os Usuários</SelectItem>
                      {usuarios?.map((u: any) => (
                        <SelectItem key={u.id} value={u.id} className="font-medium">
                          {u.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
               </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-premium bg-card/50 backdrop-blur-sm">
            <CardHeader className="py-4">
               <CardTitle className="text-xs font-black uppercase tracking-widest text-foreground/80">Compromissos do Dia</CardTitle>
               <p className="text-[10px] font-bold text-muted-foreground">{format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</p>
            </CardHeader>
            <CardContent className="p-0 border-t border-border/20">
               <div className="divide-y divide-border/20">
                  {getTasksForDay(selectedDate).length === 0 ? (
                    <div className="p-8 text-center">
                       <Clock className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                       <p className="text-[11px] font-bold text-muted-foreground italic">Nenhum compromisso para este dia.</p>
                       <Button variant="link" size="sm" onClick={() => handleCreate(selectedDate)} className="text-[10px] font-black uppercase mt-2">Agendar Agora</Button>
                    </div>
                  ) : (
                    getTasksForDay(selectedDate).map(t => (
                      <div key={t.id} className="p-4 hover:bg-primary/5 transition-all group relative cursor-pointer" onClick={() => handleView(t)}>
                        <div className="flex items-start justify-between gap-3">
                           <div className="space-y-1">
                              <div className="flex items-center gap-1.5 mb-1">
                                 {t.dataLimite && (
                                   <span className="text-xs font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                      {format(parseISO(String(t.dataLimite)), 'HH:mm')}
                                   </span>
                                 )}
                                 <p className="text-sm font-black text-foreground line-clamp-1">{t.titulo}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                 <Badge className={cn("text-[10px] font-black px-1.5 py-0 rounded-md uppercase tracking-tight border-none", 
                                    t.status === 'CONCLUIDA' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                                 )}>
                                    {t.status === 'CONCLUIDA' ? 'Realizado' : t.status}
                                 </Badge>
                                 <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                                    <UserIcon className="w-2.5 h-2.5" /> {t.usuario?.nome.split(' ')[0]}
                                 </span>
                              </div>
                              {t.clienteId && (
                                <p className="text-xs font-bold text-muted-foreground mt-1">
                                   Cliente: {t.cliente?.nome}
                                </p>
                              )}
                           </div>
                           <div className={cn("w-1 h-10 rounded-full", getPriorityColor(t.prioridade))} />
                        </div>
                      </div>
                    ))
                  )}
               </div>
            </CardContent>
          </Card>
        </div>

        {/* Calendar Content */}
        <div className="lg:col-span-9">
           <Card className="border-border/40 shadow-premium bg-card overflow-hidden">
              <CardContent className="p-0">
                 {viewMode === 'month' ? (
                   <>
                     {/* Month View Weekday Headers */}
                     <div className="grid grid-cols-7 border-b border-border/40 bg-muted/30">
                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                          <div key={day} className="py-4 text-center text-xs font-black uppercase tracking-[0.2em] text-muted-foreground border-r border-border/20 last:border-0">
                            {day}
                          </div>
                        ))}
                     </div>

                     {/* Month Grid */}
                     <div className="grid grid-cols-7 divide-x divide-y divide-border/20 min-h-[800px]">
                        {isLoading ? (
                          <div className="col-span-7 h-[600px] flex items-center justify-center">
                             <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
                          </div>
                        ) : (
                          calendarDays.map((day, idx) => {
                            const dayTasks = getTasksForDay(day);
                            const isCurrentMonth = isSameMonth(day, monthStart);
                            const isSelected = isSameDay(day, selectedDate);
                            
                            return (
                              <div 
                                key={idx} 
                                onClick={() => setSelectedDate(day)}
                                className={cn(
                                  "min-h-[160px] p-3 transition-all cursor-pointer relative group flex flex-col",
                                  !isCurrentMonth ? "bg-muted/10 opacity-30" : "bg-card hover:bg-primary/5",
                                  isSelected && "bg-primary/5 ring-2 ring-primary/30 ring-inset z-10",
                                  isToday(day) && "bg-blue-500/[0.03]"
                                )}
                              >
                                <div className="flex items-center justify-between mb-3">
                                   <span className={cn(
                                     "text-sm font-black w-8 h-8 flex items-center justify-center rounded-full transition-all",
                                     isToday(day) ? "bg-primary text-primary-foreground shadow-md scale-110" : "text-muted-foreground group-hover:text-foreground",
                                     isSelected && !isToday(day) && "text-primary scale-110"
                                   )}>
                                     {format(day, 'd')}
                                   </span>
                                   {dayTasks.length > 0 && (
                                     <span className="text-xs font-black text-muted-foreground/50">{dayTasks.length}</span>
                                   )}
                                </div>

                                <div className="space-y-1.5 flex-1 overflow-hidden">
                                   {dayTasks.slice(0, 6).map(task => (
                                     <div 
                                       key={task.id} 
                                       onClick={(e) => { e.stopPropagation(); handleView(task); }}
                                       className={cn(
                                         "text-[10px] font-bold p-1.5 rounded-md border-l-2 truncate shadow-sm flex items-center gap-1.5",
                                         task.status === 'CONCLUIDA' ? "bg-emerald-500/10 border-emerald-500 text-emerald-700 opacity-60 line-through" : "bg-white border-primary text-foreground dark:bg-slate-900"
                                       )}
                                       style={{ borderLeftColor: task.prioridade === 'ALTA' ? '#dc2626' : task.prioridade === 'MEDIA' ? '#d97706' : '#3b82f6' }}
                                     >
                                        {task.dataLimite && (
                                          <span className="text-[9px] font-black opacity-60 shrink-0">
                                            {format(parseISO(String(task.dataLimite)), 'HH:mm')}
                                          </span>
                                        )}
                                        <span className="truncate">{task.titulo}</span>
                                     </div>
                                   ))}
                                   {dayTasks.length > 6 && (
                                     <p className="text-[10px] font-black text-primary uppercase text-center mt-2 py-1 bg-primary/5 rounded-md">
                                       + {dayTasks.length - 6} compromissos
                                     </p>
                                   )}
                                </div>
                              </div>
                            );
                          })
                        )}
                     </div>
                   </>
                 ) : (
                   /* Weekly Time-Grid View */
                   <div className="flex flex-col h-[800px] overflow-hidden">
                      <div className="grid grid-cols-8 border-b border-border/40 bg-muted/30">
                        <div className="w-20 border-r border-border/20 py-3" />
                        {calendarDays.map((day, idx) => (
                          <div 
                            key={idx} 
                            className={cn(
                              "flex-1 py-3 text-center border-r border-border/20 last:border-0",
                              isToday(day) && "bg-primary/5"
                            )}
                          >
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{format(day, 'EEE', { locale: ptBR })}</p>
                            <p className={cn("text-lg font-black", isToday(day) ? "text-primary" : "text-foreground")}>{format(day, 'd')}</p>
                          </div>
                        ))}
                      </div>

                      <div className="flex-1 overflow-y-auto relative">
                         <div className="grid grid-cols-8 divide-x divide-border/20 min-h-[1200px]">
                            {/* Time Column */}
                            <div className="w-20 flex flex-col bg-muted/5">
                               {hours.map(hour => (
                                 <div key={hour.getTime()} className="h-20 border-b border-border/10 flex items-start justify-center pt-2">
                                    <span className="text-[10px] font-black text-muted-foreground/60">{format(hour, 'HH:00')}</span>
                                 </div>
                               ))}
                            </div>

                            {/* Day Columns */}
                            {calendarDays.map((day, dayIdx) => {
                              const dayTasks = getTasksForDay(day);
                              return (
                                <div key={dayIdx} className={cn("flex-1 relative group bg-background/50", isToday(day) && "bg-primary/[0.02]")}>
                                   {/* Hour grid lines */}
                                   {hours.map(hour => (
                                      <div key={hour.getTime()} className="h-20 border-b border-border/5" />
                                   ))}

                                   {/* Tasks Overlay */}
                                   {dayTasks.map(task => {
                                      if (!task.dataLimite) return null;
                                      const date = parseISO(String(task.dataLimite));
                                      const startHour = date.getHours();
                                      const startMinutes = date.getMinutes();
                                      
                                      // Only show if within our visible hours (7-21)
                                      if (startHour < 7 || startHour > 21) return null;

                                      const top = ((startHour - 7) * 80) + (startMinutes * 80 / 60);
                                      
                                      return (
                                        <div 
                                          key={task.id}
                                          onClick={() => handleView(task)}
                                          className={cn(
                                            "absolute left-1 right-1 p-2 rounded-xl border-l-4 shadow-sm cursor-pointer transition-all hover:scale-[1.02] hover:z-20",
                                            task.status === 'CONCLUIDA' ? "bg-emerald-500/10 border-emerald-500 text-emerald-800 opacity-60" : "bg-card border-primary text-card-foreground border shadow-premium"
                                          )}
                                          style={{ 
                                            top: `${top}px`, 
                                            minHeight: '50px',
                                            borderLeftColor: task.prioridade === 'ALTA' ? '#dc2626' : task.prioridade === 'MEDIA' ? '#d97706' : '#3b82f6'
                                          }}
                                        >
                                          <div className="flex items-center gap-1.5 mb-1">
                                             <Clock className="w-3 h-3 text-primary" />
                                             <span className="text-[10px] font-black">{format(date, 'HH:mm')}</span>
                                          </div>
                                          <p className="text-sm font-black leading-tight mb-1">{task.titulo}</p>
                                          {task.clienteId && (
                                            <p className="text-[10px] font-bold text-muted-foreground truncate flex items-center gap-1">
                                              <UserIcon className="w-2.5 h-2.5" /> {task.cliente?.nome.split(' ')[0]}
                                            </p>
                                          )}
                                        </div>
                                      );
                                   })}
                                </div>
                              );
                            })}
                         </div>
                      </div>
                   </div>
                 )}
              </CardContent>
           </Card>
        </div>
      </div>

      {/* Details Dialog */}
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

      {/* Task Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="w-full max-w-[95vw] md:max-w-4xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary/5 p-6 md:p-8 border-b border-primary/10">
            <DialogTitle className="text-2xl md:text-3xl font-black uppercase tracking-tight flex items-center gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <Plus className="w-6 h-6 md:w-7 md:h-7 text-primary-foreground" />
              </div>
              {editingTarefa ? 'Editar Compromisso' : 'Novo Agendamento'}
            </DialogTitle>
            <DialogDescription className="font-bold text-muted-foreground mt-2 text-sm md:text-base">
              {editingTarefa 
                ? 'Atualize os detalhes deste compromisso ou prazo.' 
                : `Agendando para ${format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`}
            </DialogDescription>
          </div>
          
          <div className="p-6 md:p-8 max-h-[70vh] overflow-y-auto">
            <TarefaForm 
              initialData={editingTarefa ? {
                ...editingTarefa,
                dataLimite: editingTarefa.dataLimite ? new Date(editingTarefa.dataLimite).toISOString() : null
              } as any : {
                dataLimite: setHours(startOfDay(selectedDate), 9).toISOString(),
                usuarioId: user?.id,
                prioridade: 'MEDIA',
                status: 'PENDENTE',
              } as any}
              onSubmit={onSubmit}
              isSubmitting={createTarefa.isPending || updateTarefa.isPending}
              onCancel={() => setIsFormOpen(false)}
            />
          </div>

          {editingTarefa && (
             <div className="px-6 pb-6 flex justify-center">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-destructive hover:bg-destructive/10 font-bold uppercase text-[10px] tracking-widest rounded-xl px-6"
                  onClick={() => confirm('Excluir este compromisso permanentemente?') && deleteTarefa.mutate(editingTarefa.id)}
                >
                   Apagar permanentemente
                </Button>
             </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

