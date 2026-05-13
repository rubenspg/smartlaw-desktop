import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { tarefaSchema, TarefaInput, Tarefa } from '@smartlaw/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, 
  Search, 
  Calendar as CalendarIcon, 
  Clock, 
  Check, 
  ChevronsUpDown
} from 'lucide-react';
import { useUsuarios } from '@/hooks/use-lookups';
import { useClientes } from '@/hooks/use-clientes';
import { useAuth } from '@/lib/auth';
import { useState, useEffect } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface TarefaFormProps {
  initialData?: Tarefa;
  onSubmit: (data: TarefaInput) => Promise<void>;
  isSubmitting: boolean;
  onCancel: () => void;
}

export function TarefaForm({ initialData, onSubmit, isSubmitting, onCancel }: TarefaFormProps) {
  const { user } = useAuth();
  const { data: usuarios, isLoading: isLoadingUsuarios } = useUsuarios();
  const [clienteSearch, setClienteSearch] = useState('');
  const { data: clientesData, isLoading: isLoadingClientes } = useClientes({ q: clienteSearch, limit: 10 });
  const [isClientPopoverOpen, setIsClientPopoverOpen] = useState(false);

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

  const selectedClienteId = watch('clienteId');
  const selectedCliente = clientesData?.items?.find(c => c.id === selectedClienteId) || initialData?.cliente;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-10 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-4">
          <Label className="text-base font-black uppercase tracking-[0.1em] text-muted-foreground ml-1">Advogado Responsável</Label>
          <Select
            disabled={isLoadingUsuarios}
            value={watch('usuarioId')}
            onValueChange={(val) => setValue('usuarioId', val)}
          >
            <SelectTrigger className="rounded-2xl h-16 border-border/60 bg-background shadow-sm text-lg font-bold px-6">
              <SelectValue placeholder={isLoadingUsuarios ? 'Carregando...' : 'Selecione o Advogado'} />
            </SelectTrigger>
            <SelectContent className="rounded-2xl shadow-premium-lg">
              {usuarios?.map((u: any) => (
                <SelectItem key={u.id} value={u.id} className="font-bold py-4 text-lg">
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.usuarioId && <p className="text-sm font-bold text-destructive px-1">{errors.usuarioId.message}</p>}
        </div>

        <div className="space-y-4">
          <Label className="text-base font-black uppercase tracking-[0.1em] text-muted-foreground ml-1">Cliente Associado</Label>
          <Popover open={isClientPopoverOpen} onOpenChange={setIsClientPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={isClientPopoverOpen}
                className="w-full justify-between rounded-2xl h-16 border-border/60 bg-background shadow-sm text-lg font-bold px-6 hover:bg-background"
              >
                <span className="truncate">
                  {selectedClienteId ? selectedCliente?.nome : "Pesquisar cliente..."}
                </span>
                <ChevronsUpDown className="ml-2 h-6 w-6 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-2xl shadow-premium-lg border-border/40 overflow-hidden">
              <Command shouldFilter={false}>
                <CommandInput 
                  placeholder="Digitar nome do cliente..." 
                  value={clienteSearch}
                  onValueChange={setClienteSearch}
                  className="h-16 text-lg font-bold"
                />
                <CommandList>
                  {isLoadingClientes && (
                    <div className="p-6 text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    </div>
                  )}
                  <CommandEmpty className="py-10 text-center text-base font-bold text-muted-foreground">
                    {clienteSearch ? "Nenhum cliente encontrado." : "Comece a digitar para pesquisar..."}
                  </CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="none"
                      onSelect={() => {
                        setValue('clienteId', null);
                        setIsClientPopoverOpen(false);
                      }}
                      className="font-bold py-4 text-lg text-muted-foreground italic"
                    >
                      <Check className={cn("mr-2 h-6 w-6", !selectedClienteId ? "opacity-100" : "opacity-0")} />
                      Nenhum cliente
                    </CommandItem>
                    {clientesData?.items?.map((cliente) => (
                      <CommandItem
                        key={cliente.id}
                        value={cliente.id.toString()}
                        onSelect={() => {
                          setValue('clienteId', cliente.id);
                          setIsClientPopoverOpen(false);
                        }}
                        className="font-bold py-4 text-lg"
                      >
                        <Check className={cn("mr-2 h-6 w-6", selectedClienteId === cliente.id ? "opacity-100" : "opacity-0")} />
                        {cliente.nome}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-base font-black uppercase tracking-[0.1em] text-muted-foreground ml-1">Título do Compromisso</Label>
        <Input 
          id="titulo" 
          {...register('titulo')} 
          placeholder="Ex: Audiência, Reunião, Prazo Processual..." 
          className="rounded-2xl h-16 border-border/60 bg-background shadow-sm font-bold text-lg px-6" 
        />
        {errors.titulo && <p className="text-sm font-bold text-destructive px-1">{errors.titulo.message}</p>}
      </div>

      <div className="space-y-4">
        <Label className="text-base font-black uppercase tracking-[0.1em] text-muted-foreground ml-1">Observações do Caso</Label>
        <Textarea 
          id="descricao" 
          {...register('descricao')} 
          placeholder="Detalhes importantes para o advogado..." 
          className="rounded-2xl min-h-[160px] border-border/60 bg-background shadow-sm font-medium leading-relaxed text-lg p-6" 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-4">
            <Label className="text-base font-black uppercase tracking-[0.1em] text-muted-foreground ml-1">Data</Label>
            <div className="relative">
              <CalendarIcon className="absolute left-5 top-5 h-6 w-6 text-primary/60" />
              <Input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-2xl h-16 pl-14 border-border/60 bg-background shadow-sm font-bold text-lg w-full"
              />
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-base font-black uppercase tracking-[0.1em] text-muted-foreground ml-1">Horário</Label>
            <div className="relative">
              <Clock className="absolute left-5 top-5 h-6 w-6 text-primary/60" />
              <Input 
                type="time" 
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="rounded-2xl h-16 pl-14 border-border/60 bg-background shadow-sm font-bold text-lg w-full"
              />
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-base font-black uppercase tracking-[0.1em] text-muted-foreground ml-1">Prioridade</Label>
            <Select
              value={watch('prioridade')}
              onValueChange={(val) => setValue('prioridade', val as any)}
            >
              <SelectTrigger className="rounded-2xl h-16 border-border/60 bg-background shadow-sm font-bold text-lg w-full px-6">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="BAIXA" className="font-bold text-lg">Baixa</SelectItem>
                <SelectItem value="MEDIA" className="font-bold text-lg">Média</SelectItem>
                <SelectItem value="ALTA" className="font-bold text-lg">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <Label className="text-base font-black uppercase tracking-[0.1em] text-muted-foreground ml-1">Situação</Label>
            <Select
              value={watch('status')}
              onValueChange={(val) => setValue('status', val as any)}
            >
              <SelectTrigger className="rounded-2xl h-16 border-border/60 bg-background shadow-sm font-bold text-lg w-full px-6">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="PENDENTE" className="font-bold text-lg text-amber-600">Agendado</SelectItem>
                <SelectItem value="CONCLUIDA" className="font-bold text-lg text-emerald-600">Realizado</SelectItem>
                <SelectItem value="CANCELADA" className="font-bold text-lg text-red-600">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
      </div>

      <div className="flex justify-end gap-6 pt-10">
        <Button variant="ghost" type="button" onClick={onCancel} className="rounded-2xl h-16 px-10 font-black uppercase text-sm tracking-widest">
          Descartar
        </Button>
        <Button type="submit" disabled={isSubmitting} className="rounded-2xl h-16 px-16 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-base tracking-widest shadow-premium-lg transition-all active:scale-95">
          {isSubmitting && <Loader2 className="w-6 h-6 animate-spin mr-4" />}
          {initialData ? 'Salvar Alterações' : 'Confirmar Agendamento'}
        </Button>
      </div>
    </form>
  );
}



