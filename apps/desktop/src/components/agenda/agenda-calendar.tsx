import { format, parseISO, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Clock, User as UserIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Tarefa } from '@/lib/entities';
import { cn } from '@/lib/utils';

type ViewMode = 'month' | 'week';

interface AgendaCalendarProps {
  viewMode: ViewMode;
  calendarDays: Date[];
  hours: Date[];
  isLoading: boolean;
  monthStart: Date;
  selectedDate: Date;
  getTasksForDay: (day: Date) => Tarefa[];
  onSelectDate: (day: Date) => void;
  onViewTask: (task: Tarefa) => void;
}

export function AgendaCalendar({
  viewMode,
  calendarDays,
  hours,
  isLoading,
  monthStart,
  selectedDate,
  getTasksForDay,
  onSelectDate,
  onViewTask,
}: AgendaCalendarProps) {
  return (
    <div className="lg:col-span-9">
      <Card className="border-border/40 shadow-premium bg-card overflow-hidden">
        <CardContent className="p-0">
          {viewMode === 'month' ? (
            <>
              <div className="grid grid-cols-7 border-b border-border/40 bg-muted/30">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                  <div key={day} className="py-4 text-center text-xs font-black uppercase tracking-[0.2em] text-muted-foreground border-r border-border/20 last:border-0">
                    {day}
                  </div>
                ))}
              </div>

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
                        onClick={() => onSelectDate(day)}
                        className={cn(
                          'min-h-[160px] p-3 transition-all cursor-pointer relative group flex flex-col',
                          !isCurrentMonth ? 'bg-muted/10 opacity-30' : 'bg-card hover:bg-primary/5',
                          isSelected && 'bg-primary/5 ring-2 ring-primary/30 ring-inset z-10',
                          isToday(day) && 'bg-blue-500/[0.03]',
                        )}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className={cn(
                            'text-sm font-black w-8 h-8 flex items-center justify-center rounded-full transition-all',
                            isToday(day) ? 'bg-primary text-primary-foreground shadow-md scale-110' : 'text-muted-foreground group-hover:text-foreground',
                            isSelected && !isToday(day) && 'text-primary scale-110',
                          )}>
                            {format(day, 'd')}
                          </span>
                          {dayTasks.length > 0 && (
                            <span className="text-xs font-black text-muted-foreground/50">{dayTasks.length}</span>
                          )}
                        </div>

                        <div className="space-y-1.5 flex-1 overflow-hidden">
                          {dayTasks.slice(0, 6).map((task) => (
                            <div
                              key={task.id}
                              onClick={(e) => { e.stopPropagation(); onViewTask(task); }}
                              className={cn(
                                'text-[10px] font-bold p-1.5 rounded-md border-l-2 truncate shadow-sm flex items-center gap-1.5',
                                task.status === 'CONCLUIDA' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 opacity-60 line-through' : 'bg-white border-primary text-foreground dark:bg-slate-900',
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
            <div className="flex flex-col h-[800px] overflow-hidden">
              <div className="grid grid-cols-8 border-b border-border/40 bg-muted/30">
                <div className="w-20 border-r border-border/20 py-3" />
                {calendarDays.map((day, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex-1 py-3 text-center border-r border-border/20 last:border-0',
                      isToday(day) && 'bg-primary/5',
                    )}
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{format(day, 'EEE', { locale: ptBR })}</p>
                    <p className={cn('text-lg font-black', isToday(day) ? 'text-primary' : 'text-foreground')}>{format(day, 'd')}</p>
                  </div>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto relative">
                <div className="grid grid-cols-8 divide-x divide-border/20 min-h-[1200px]">
                  <div className="w-20 flex flex-col bg-muted/5">
                    {hours.map((hour) => (
                      <div key={hour.getTime()} className="h-20 border-b border-border/10 flex items-start justify-center pt-2">
                        <span className="text-[10px] font-black text-muted-foreground/60">{format(hour, 'HH:00')}</span>
                      </div>
                    ))}
                  </div>

                  {calendarDays.map((day, dayIdx) => {
                    const dayTasks = getTasksForDay(day);
                    return (
                      <div key={dayIdx} className={cn('flex-1 relative group bg-background/50', isToday(day) && 'bg-primary/[0.02]')}>
                        {hours.map((hour) => (
                          <div key={hour.getTime()} className="h-20 border-b border-border/5" />
                        ))}

                        {dayTasks.map((task) => {
                          if (!task.dataLimite) return null;
                          const date = parseISO(String(task.dataLimite));
                          const startHour = date.getHours();
                          const startMinutes = date.getMinutes();
                          if (startHour < 7 || startHour > 21) return null;
                          const top = ((startHour - 7) * 80) + (startMinutes * 80 / 60);

                          return (
                            <div
                              key={task.id}
                              onClick={() => onViewTask(task)}
                              className={cn(
                                'absolute left-1 right-1 p-2 rounded-xl border-l-4 shadow-sm cursor-pointer transition-all hover:scale-[1.02] hover:z-20',
                                task.status === 'CONCLUIDA' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-800 opacity-60' : 'bg-card border-primary text-card-foreground border shadow-premium',
                              )}
                              style={{
                                top: `${top}px`,
                                minHeight: '50px',
                                borderLeftColor: task.prioridade === 'ALTA' ? '#dc2626' : task.prioridade === 'MEDIA' ? '#d97706' : '#3b82f6',
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
  );
}
