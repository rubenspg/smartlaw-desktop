import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { tarefaSchema, TarefaInput } from '@smartlaw/shared';
import { Tarefa } from '@/lib/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, 
  Calendar as CalendarIcon, 
  Clock
} from 'lucide-react';
import { useUsuarios } from '@/hooks/use-lookups';
import { useAuth } from '@/lib/auth';
import { useState, useEffect } from 'react';
import { format, isValid } from 'date-fns';





interface TarefaFormProps {
  initialData?: Tarefa;
  onSubmit: (data: TarefaInput) => Promise<void>;
  isSubmitting: boolean;
  onCancel: () => void;
}

export function TarefaForm({ initialData, onSubmit, isSubmitting, onCancel }: TarefaFormProps) {
  const { user } = useAuth();
  const { data: usuarios, isLoading: isLoadingUsuarios } = useUsuarios();

  // Internal states to split Date and Time
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<TarefaInput>({
    resolver: zodResolver(tarefaSchema),
    defaultValues: initialData ? {
      usuarioId: initialData.usuarioId,
      clienteId: initialData.clienteId,
      titulo: initialData.titulo,
      descricao: initialData.descricao,
      dataLimite: initialData.dataLimite ? new Date(initialData.dataLimite).toISOString() : null,
      prioridade: initialData.prioridade as 'BAIXA' | 'MEDIA' | 'ALTA',
      status: initialData.status as 'PENDENTE' | 'CONCLUIDA' | 'CANCELADA',
    } : {
      usuarioId: user?.id,
      prioridade: 'MEDIA',
      status: 'PENDENTE',
    },
  });

  // Initialize date and time
  useEffect(() => {
    const currentDataLimite = watch('dataLimite');
    if (currentDataLimite) {
      const date = new Date(currentDataLimite);
      if (isValid(date)) {
        setSelectedDate(format(date, 'yyyy-MM-dd'));
        setSelectedTime(format(date, 'HH:mm'));
      }
    }
  }, [initialData]);

  // Sync internal date/time to the form's dataLimite
  useEffect(() => {
    if (selectedDate && selectedTime) {
      const isoString = new Date(`${selectedDate}T${selectedTime}`).toISOString();
      setValue('dataLimite', isoString);
    } else if (selectedDate) {
      const isoString = new Date(`${selectedDate}T00:00:00`).toISOString();
      setValue('dataLimite', isoString);
    }
  }, [selectedDate, selectedTime]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 py-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-2.5">
          <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Advogado Responsável</Label>
          <Select
            disabled={isLoadingUsuarios}
            value={watch('usuarioId')}
            onValueChange={(val) => setValue('usuarioId', val)}
          >
            <SelectTrigger className="rounded-xl h-12 border-border/60 bg-background shadow-sm font-bold px-4">
              <SelectValue placeholder={isLoadingUsuarios ? 'Carregando...' : 'Selecione o Advogado'} />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-premium-lg">
              {usuarios?.map((u: any) => (
                <SelectItem key={u.id} value={u.id} className="font-bold py-2">
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.usuarioId && <p className="text-xs font-bold text-destructive px-1">{errors.usuarioId.message}</p>}
        </div>

        <div className="md:col-span-2 space-y-2.5">
          <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Título do Compromisso</Label>
          <Input 
            id="titulo" 
            {...register('titulo')} 
            placeholder="Ex: Audiência, Reunião, Prazo Processual..." 
            className="rounded-xl h-12 border-border/60 bg-background shadow-sm font-bold px-4" 
          />
          {errors.titulo && <p className="text-xs font-bold text-destructive px-1">{errors.titulo.message}</p>}
        </div>
      </div>

      <div className="space-y-2.5">
        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Observações do Caso</Label>
        <Textarea 
          id="descricao" 
          {...register('descricao')} 
          placeholder="Detalhes importantes para o advogado..." 
          className="rounded-xl min-h-[120px] border-border/60 bg-background shadow-sm font-medium leading-relaxed p-4 resize-none" 
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="space-y-2.5">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Data</Label>
            <div className="relative">
              <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/60" />
              <Input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-xl h-12 pl-10 border-border/60 bg-background shadow-sm font-bold w-full"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Horário</Label>
            <div className="relative">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/60" />
              <Input 
                type="time" 
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="rounded-xl h-12 pl-10 border-border/60 bg-background shadow-sm font-bold w-full"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Prioridade</Label>
            <Select
              value={watch('prioridade')}
              onValueChange={(val) => setValue('prioridade', val as any)}
            >
              <SelectTrigger className="rounded-xl h-12 border-border/60 bg-background shadow-sm font-bold w-full px-4">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="BAIXA" className="font-bold">Baixa</SelectItem>
                <SelectItem value="MEDIA" className="font-bold">Média</SelectItem>
                <SelectItem value="ALTA" className="font-bold">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2.5">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Situação</Label>
            <Select
              value={watch('status')}
              onValueChange={(val) => setValue('status', val as any)}
            >
              <SelectTrigger className="rounded-xl h-12 border-border/60 bg-background shadow-sm font-bold w-full px-4">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="PENDENTE" className="font-bold text-amber-600">Agendado</SelectItem>
                <SelectItem value="CONCLUIDA" className="font-bold text-emerald-600">Realizado</SelectItem>
                <SelectItem value="CANCELADA" className="font-bold text-red-600">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-4 pt-6">
        <Button variant="ghost" type="button" onClick={onCancel} className="rounded-xl h-12 px-8 font-black uppercase text-xs tracking-widest order-2 sm:order-1">
          Descartar
        </Button>
        <Button type="submit" disabled={isSubmitting} className="rounded-xl h-12 px-12 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-sm tracking-widest shadow-premium transition-all active:scale-95 order-1 sm:order-2">
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-3" />}
          {initialData ? 'Salvar Alterações' : 'Confirmar Agendamento'}
        </Button>
      </div>
    </form>
  );
}



