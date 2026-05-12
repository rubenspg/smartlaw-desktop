import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
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
  CalendarRange
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
  parseISO
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type Tarefa, type TarefaInput } from '@smartlaw/shared';

export const Route = createFileRoute('/_dashboard/agenda')({
  component: AgendaPage,
});

function AgendaPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedUser, setSelectedUser] = useState<string>('all');
  
  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
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

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
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

  const handleEdit = (tarefa: Tarefa) => {
    setEditingTarefa(tarefa);
    setIsFormOpen(true);
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
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const getTasksForDay = (day: Date) => {
    return (tarefas || []).filter(t => t.dataLimite && isSameDay(parseISO(String(t.dataLimite)), day));
  };

  const getPriorityColor = (p: string | null) => {
    switch (p) {
      case 'ALTA': return 'bg-red-500';
      case 'MEDIA': return 'bg-amber-500';
      case 'BAIXA': return 'bg-blue-500';
      default: return 'bg-slate-400';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-primary" />
            Agenda Compartilhada
          </h1>
          <p className="text-muted-foreground font-medium">Gestão de prazos e tarefas do escritório.</p>
        </div>

        <div className="flex items-center gap-3 bg-muted/50 p-1.5 rounded-2xl border border-border/50">
          <div className="flex items-center gap-1">
             <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-9 w-9 rounded-xl hover:bg-background shadow-sm">
                <ChevronLeft className="w-4 h-4" />
             </Button>
             <div className="px-4 text-sm font-black uppercase tracking-widest min-w-[160px] text-center">
                {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
             </div>
             <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-9 w-9 rounded-xl hover:bg-background shadow-sm">
                <ChevronRight className="w-4 h-4" />
             </Button>
          </div>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="outline" size="sm" onClick={handleToday} className="rounded-xl font-bold h-9 bg-background">
            Hoje
          </Button>
          <Button onClick={() => handleCreate()} size="sm" className="rounded-xl font-black h-9 shadow-premium">
            <Plus className="w-4 h-4 mr-1.5" /> Nova Tarefa
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar / Filters */}
        <div className="space-y-6">
          <Card className="border-border/40 shadow-premium bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/40 py-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary" />
                <CardTitle className="text-xs font-black uppercase tracking-widest text-foreground/80">Filtrar Agenda</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Colaborador</label>
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
               <CardTitle className="text-xs font-black uppercase tracking-widest text-foreground/80">Tarefas do Dia</CardTitle>
               <p className="text-[10px] font-bold text-muted-foreground">{format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</p>
            </CardHeader>
            <CardContent className="p-0 border-t border-border/20">
               <div className="divide-y divide-border/20">
                  {getTasksForDay(selectedDate).length === 0 ? (
                    <div className="p-8 text-center">
                       <Clock className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                       <p className="text-[11px] font-bold text-muted-foreground italic">Nenhuma tarefa para este dia.</p>
                       <Button variant="link" size="sm" onClick={() => handleCreate(selectedDate)} className="text-[10px] font-black uppercase mt-2">Agendar Agora</Button>
                    </div>
                  ) : (
                    getTasksForDay(selectedDate).map(t => (
                      <div key={t.id} className="p-4 hover:bg-primary/5 transition-all group relative cursor-pointer" onClick={() => handleEdit(t)}>
                        <div className="flex items-start justify-between gap-3">
                           <div className="space-y-1">
                              <p className="text-xs font-black text-foreground line-clamp-2">{t.titulo}</p>
                              <div className="flex items-center gap-2">
                                 <Badge className={cn("text-[8px] font-black px-1.5 py-0 rounded-md uppercase tracking-tighter border-none", 
                                    t.status === 'CONCLUIDA' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                                 )}>
                                    {t.status}
                                 </Badge>
                                 <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                    <UserIcon className="w-2.5 h-2.5" /> {t.usuario?.nome.split(' ')[0]}
                                 </span>
                              </div>
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

        {/* Calendar Grid */}
        <div className="lg:col-span-3">
           <Card className="border-border/40 shadow-premium bg-card overflow-hidden">
              <CardContent className="p-0">
                 {/* Weekday Headers */}
                 <div className="grid grid-cols-7 border-b border-border/40 bg-muted/30">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                      <div key={day} className="py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-r border-border/20 last:border-0">
                        {day}
                      </div>
                    ))}
                 </div>

                 {/* Days Grid */}
                 <div className="grid grid-cols-7 divide-x divide-y divide-border/20">
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
                              "min-h-[120px] p-2 transition-all cursor-pointer relative group flex flex-col",
                              !isCurrentMonth ? "bg-muted/10 opacity-30" : "bg-card hover:bg-primary/5",
                              isSelected && "bg-primary/5 ring-2 ring-primary/30 ring-inset z-10",
                              isToday(day) && "bg-blue-500/[0.03]"
                            )}
                          >
                            <div className="flex items-center justify-between mb-2">
                               <span className={cn(
                                 "text-xs font-black w-7 h-7 flex items-center justify-center rounded-full transition-all",
                                 isToday(day) ? "bg-primary text-primary-foreground shadow-md scale-110" : "text-muted-foreground group-hover:text-foreground",
                                 isSelected && !isToday(day) && "text-primary scale-110"
                               )}>
                                 {format(day, 'd')}
                               </span>
                               {dayTasks.length > 0 && (
                                 <span className="text-[10px] font-black text-muted-foreground/50">{dayTasks.length}</span>
                               )}
                            </div>

                            <div className="space-y-1.5 flex-1 overflow-hidden">
                               {dayTasks.slice(0, 3).map(task => (
                                 <div 
                                   key={task.id} 
                                   className={cn(
                                     "text-[9px] font-bold p-1 rounded-md border-l-2 truncate shadow-sm flex items-center gap-1",
                                     task.status === 'CONCLUIDA' ? "bg-emerald-500/10 border-emerald-500 text-emerald-700 opacity-60 line-through" : "bg-white border-primary text-foreground dark:bg-slate-900"
                                   )}
                                   style={{ borderLeftColor: task.prioridade === 'ALTA' ? '#dc2626' : task.prioridade === 'MEDIA' ? '#d97706' : '#3b82f6' }}
                                 >
                                    {task.titulo}
                                 </div>
                               ))}
                               {dayTasks.length > 3 && (
                                 <p className="text-[8px] font-black text-primary uppercase text-center mt-1">
                                   + {dayTasks.length - 3} tarefas
                                 </p>
                               )}
                            </div>
                          </div>
                        );
                      })
                    )}
                 </div>
              </CardContent>
           </Card>
        </div>
      </div>

      {/* Task Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight">
              {editingTarefa ? 'Editar Compromisso' : 'Novo Compromisso'}
            </DialogTitle>
            <DialogDescription className="font-medium">
              {editingTarefa 
                ? 'Atualize os detalhes desta tarefa ou prazo.' 
                : `Agendando tarefa para o dia ${format(selectedDate, "dd/MM/yyyy")}`}
            </DialogDescription>
          </DialogHeader>
          
          <TarefaForm 
            initialData={editingTarefa ? {
              ...editingTarefa,
              dataLimite: editingTarefa.dataLimite ? new Date(editingTarefa.dataLimite).toISOString() : null
            } as any : {
              dataLimite: selectedDate.toISOString().split('T')[0],
              usuarioId: user?.id,
              prioridade: 'MEDIA',
              status: 'PENDENTE',
            } as any}
            onSubmit={onSubmit}
            isSubmitting={createTarefa.isPending || updateTarefa.isPending}
            onCancel={() => setIsFormOpen(false)}
          />

          {editingTarefa && (
             <div className="px-6 pb-6 pt-2 border-t border-border/40 mt-[-16px]">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-destructive hover:bg-destructive/10 font-bold uppercase text-[10px] tracking-widest rounded-xl"
                  onClick={() => confirm('Excluir esta tarefa?') && deleteTarefa.mutate(editingTarefa.id)}
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

function Separator({ orientation, className }: { orientation: 'vertical' | 'horizontal', className?: string }) {
  return (
    <div className={cn(
      "bg-border/60",
      orientation === 'vertical' ? "w-[1px] h-full" : "h-[1px] w-full",
      className
    )} />
  );
}
