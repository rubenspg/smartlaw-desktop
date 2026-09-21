import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { tarefaSchema, TarefaInput } from '@smartlaw/shared';
import { Tarefa } from '@/lib/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Calendar as CalendarIcon,
  Clock,
  Video,
  Scale,
  User as UserIcon,
} from 'lucide-react';
import { useUsuarios } from '@/hooks/use-lookups';
import { useClientes } from '@/hooks/use-clientes';
import { useProcessosJudiciais, useProcessosJudiciaisByCliente } from '@/hooks/use-processos';
import { useAuth } from '@/lib/auth';
import { useState, useEffect } from 'react';
import { format, isValid } from 'date-fns';

interface TarefaFormProps {
  initialData?: Tarefa;
  onSubmit: (data: TarefaInput) => Promise<void>;
  isSubmitting: boolean;
  onCancel: () => void;
}

const CATEGORIAS = [
  { value: 'GERAL', label: 'Geral / Administrativo' },
  { value: 'AUDIENCIA', label: 'Audiência' },
  { value: 'PRAZO', label: 'Prazo Fatal' },
  { value: 'REUNIAO', label: 'Reunião com Cliente' },
  { value: 'DILIGENCIA', label: 'Diligência Externa' },
] as const;

export function TarefaForm({ initialData, onSubmit, isSubmitting, onCancel }: TarefaFormProps) {
  const { user } = useAuth();
  const { data: usuarios, isLoading: isLoadingUsuarios } = useUsuarios();
  const { data: clientesData, isLoading: isLoadingClientes } = useClientes({ limit: 100 });

  // Internal states to split Date and Time
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<TarefaInput>({
    resolver: zodResolver(tarefaSchema),
    defaultValues: initialData
      ? {
          usuarioId: initialData.usuarioId ?? null,
          clienteId: initialData.clienteId ?? null,
          processoJudicialId: initialData.processoJudicialId ?? null,
          processoAdminId: initialData.processoAdminId ?? null,
          categoria: (initialData.categoria as any) ?? 'GERAL',
          link: initialData.link ?? '',
          titulo: initialData.titulo,
          descricao: initialData.descricao ?? '',
          dataLimite: initialData.dataLimite
            ? new Date(initialData.dataLimite).toISOString()
            : null,
          prioridade: initialData.prioridade as 'BAIXA' | 'MEDIA' | 'ALTA',
          status: initialData.status as 'PENDENTE' | 'CONCLUIDA' | 'CANCELADA',
        }
      : {
          usuarioId: user?.id ?? null,
          clienteId: null,
          processoJudicialId: null,
          processoAdminId: null,
          categoria: 'GERAL',
          link: '',
          prioridade: 'MEDIA',
          status: 'PENDENTE',
        },
  });

  const selectedClienteId = watch('clienteId');
  const selectedProcessoId = watch('processoJudicialId');
  const selectedCategoria = watch('categoria') ?? 'GERAL';

  const { data: processosClienteData, isLoading: isLoadingProcessosCliente } =
    useProcessosJudiciaisByCliente(selectedClienteId ? Number(selectedClienteId) : 0);

  const { data: todosProcessosData, isLoading: isLoadingTodosProcessos } = useProcessosJudiciais({
    limit: 50,
  });

  const processosDisponiveis = selectedClienteId
    ? (processosClienteData?.data ?? [])
    : (todosProcessosData?.data ?? []);

  const handleClienteChange = (val: string) => {
    if (val === 'none') {
      setValue('clienteId', null);
    } else {
      const id = Number(val);
      setValue('clienteId', id);
      // Se já houver um processo selecionado que não pertence ao novo cliente, limpa-o
      if (selectedProcessoId) {
        setValue('processoJudicialId', null);
      }
    }
  };

  const handleProcessoChange = (val: string) => {
    if (val === 'none') {
      setValue('processoJudicialId', null);
    } else {
      const procId = Number(val);
      setValue('processoJudicialId', procId);
      // Se não havia cliente selecionado, auto-seleciona o cliente do processo
      const proc = processosDisponiveis.find((p: any) => p.id === procId);
      if (proc?.clienteId && !selectedClienteId) {
        setValue('clienteId', proc.clienteId);
      }
    }
  };

  const handleFormSubmit = (data: TarefaInput) => {
    return onSubmit({
      ...data,
      usuarioId: data.usuarioId === 'team' ? null : (data.usuarioId ?? null),
      clienteId: data.clienteId ? Number(data.clienteId) : null,
      processoJudicialId: data.processoJudicialId ? Number(data.processoJudicialId) : null,
      processoAdminId: data.processoAdminId ? Number(data.processoAdminId) : null,
      categoria: data.categoria || 'GERAL',
      link: data.link?.trim() ? data.link.trim() : null,
    });
  };

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
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2.5">
          <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
            Responsável / Atribuição
          </Label>
          <Select
            disabled={isLoadingUsuarios}
            value={watch('usuarioId') ?? 'team'}
            onValueChange={(val) => setValue('usuarioId', val === 'team' ? null : val)}
          >
            <SelectTrigger className="rounded-xl h-12 border-border/60 bg-background shadow-sm font-bold px-4">
              <SelectValue
                placeholder={isLoadingUsuarios ? 'Carregando...' : 'Selecione o Responsável'}
              />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-premium-lg">
              <SelectItem value="team" className="font-bold text-primary py-2">
                Toda a Equipe (Geral)
              </SelectItem>
              {usuarios?.map((u: any) => (
                <SelectItem key={u.id} value={u.id} className="font-bold py-2">
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.usuarioId && (
            <p className="text-xs font-bold text-destructive px-1">{errors.usuarioId.message}</p>
          )}
        </div>

        <div className="space-y-2.5">
          <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
            Categoria do Compromisso
          </Label>
          <Select
            value={selectedCategoria}
            onValueChange={(val) => setValue('categoria', val as any)}
          >
            <SelectTrigger className="rounded-xl h-12 border-border/60 bg-background shadow-sm font-bold px-4">
              <SelectValue placeholder="Selecione a Categoria" />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-premium-lg">
              {CATEGORIAS.map((cat) => (
                <SelectItem key={cat.value} value={cat.value} className="font-bold py-2">
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.categoria && (
            <p className="text-xs font-bold text-destructive px-1">{errors.categoria.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
          Título do Compromisso
        </Label>
        <Input
          id="titulo"
          {...register('titulo')}
          placeholder="Ex: Audiência de Instrução, Reunião de Alinhamento, Prazo Recurso Especial..."
          className="rounded-xl h-12 border-border/60 bg-background shadow-sm font-bold px-4"
        />
        {errors.titulo && (
          <p className="text-xs font-bold text-destructive px-1">{errors.titulo.message}</p>
        )}
      </div>

      <div className="space-y-2.5">
        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
          <Video className="w-3.5 h-3.5 text-primary" />
          Link de Videoconferência / Reunião (Opcional)
        </Label>
        <Input
          id="link"
          {...register('link')}
          placeholder="Ex: https://meet.google.com/xyz-abcd-efg ou link Teams/Zoom"
          className="rounded-xl h-12 border-border/60 bg-background shadow-sm font-medium px-4"
        />
        {errors.link && (
          <p className="text-xs font-bold text-destructive px-1">{errors.link.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2.5">
          <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
            <UserIcon className="w-3.5 h-3.5 text-primary" />
            Cliente Associado (Opcional)
          </Label>
          <Select
            disabled={isLoadingClientes}
            value={selectedClienteId ? String(selectedClienteId) : 'none'}
            onValueChange={handleClienteChange}
          >
            <SelectTrigger className="rounded-xl h-12 border-border/60 bg-background shadow-sm font-medium px-4">
              <SelectValue
                placeholder={
                  isLoadingClientes ? 'Carregando clientes...' : 'Nenhum cliente selecionado'
                }
              />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-premium-lg max-h-60">
              <SelectItem value="none" className="font-bold text-muted-foreground py-2">
                Nenhum cliente (Geral)
              </SelectItem>
              {clientesData?.data?.map((c: any) => (
                <SelectItem key={c.id} value={String(c.id)} className="font-medium py-2">
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2.5">
          <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-primary" />
            Processo Judicial Associado (Opcional)
          </Label>
          <Select
            disabled={isLoadingProcessosCliente || isLoadingTodosProcessos}
            value={selectedProcessoId ? String(selectedProcessoId) : 'none'}
            onValueChange={handleProcessoChange}
          >
            <SelectTrigger className="rounded-xl h-12 border-border/60 bg-background shadow-sm font-medium px-4">
              <SelectValue
                placeholder={
                  isLoadingProcessosCliente || isLoadingTodosProcessos
                    ? 'Carregando processos...'
                    : 'Nenhum processo selecionado'
                }
              />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-premium-lg max-h-60">
              <SelectItem value="none" className="font-bold text-muted-foreground py-2">
                Nenhum processo (Geral)
              </SelectItem>
              {processosDisponiveis?.map((p: any) => (
                <SelectItem key={p.id} value={String(p.id)} className="font-medium py-2">
                  {p.numero} {p.cliente?.nome ? `(${p.cliente.nome})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2.5">
        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
          Observações do Caso
        </Label>
        <Textarea
          id="descricao"
          {...register('descricao')}
          placeholder="Detalhes importantes para o advogado, instruções para a audiência..."
          className="rounded-xl min-h-[100px] border-border/60 bg-background shadow-sm font-medium leading-relaxed p-4 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="space-y-2.5">
          <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
            Data
          </Label>
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
          <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
            Horário
          </Label>
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
          <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
            Prioridade
          </Label>
          <Select
            value={watch('prioridade')}
            onValueChange={(val) => setValue('prioridade', val as any)}
          >
            <SelectTrigger className="rounded-xl h-12 border-border/60 bg-background shadow-sm font-bold w-full px-4">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="BAIXA" className="font-bold">
                Baixa
              </SelectItem>
              <SelectItem value="MEDIA" className="font-bold">
                Média
              </SelectItem>
              <SelectItem value="ALTA" className="font-bold">
                Alta
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2.5">
          <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
            Situação
          </Label>
          <Select value={watch('status')} onValueChange={(val) => setValue('status', val as any)}>
            <SelectTrigger className="rounded-xl h-12 border-border/60 bg-background shadow-sm font-bold w-full px-4">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="PENDENTE" className="font-bold text-amber-600">
                Agendado
              </SelectItem>
              <SelectItem value="CONCLUIDA" className="font-bold text-emerald-600">
                Realizado
              </SelectItem>
              <SelectItem value="CANCELADA" className="font-bold text-red-600">
                Cancelado
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4">
        <Button
          variant="ghost"
          type="button"
          onClick={onCancel}
          className="rounded-xl h-12 px-8 font-black uppercase text-xs tracking-widest order-2 sm:order-1"
        >
          Descartar
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl h-12 px-12 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-sm tracking-widest shadow-premium transition-all active:scale-95 order-1 sm:order-2"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-3" />}
          {initialData ? 'Salvar Alterações' : 'Confirmar Agendamento'}
        </Button>
      </div>
    </form>
  );
}
