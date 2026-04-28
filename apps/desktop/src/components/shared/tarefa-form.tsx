import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { tarefaSchema, TarefaInput, Tarefa } from '@smartlaw/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useUsuarios } from '@/hooks/use-lookups';
import { useAuth } from '@/lib/auth';

interface TarefaFormProps {
  initialData?: Tarefa;
  onSubmit: (data: TarefaInput) => Promise<void>;
  isSubmitting: boolean;
  onCancel: () => void;
}

export function TarefaForm({ initialData, onSubmit, isSubmitting, onCancel }: TarefaFormProps) {
  const { user } = useAuth();
  const { data: usuarios, isLoading: isLoadingUsuarios } = useUsuarios();

  const isManagement = user?.perfil === 'admin' || user?.perfil === 'secretaria';

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<TarefaInput>({
    resolver: zodResolver(tarefaSchema),
    defaultValues: initialData ? {
      usuarioId: initialData.usuarioId,
      titulo: initialData.titulo,
      descricao: initialData.descricao,
      dataLimite: initialData.dataLimite ? new Date(initialData.dataLimite).toISOString().split('T')[0] : null,
      prioridade: initialData.prioridade as 'BAIXA' | 'MEDIA' | 'ALTA',
      status: initialData.status as 'PENDENTE' | 'CONCLUIDA' | 'CANCELADA',
    } : {
      usuarioId: user?.id,
      prioridade: 'MEDIA',
      status: 'PENDENTE',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="usuarioId">Atribuir para</Label>
        <Select
          disabled={isLoadingUsuarios || !isManagement}
          value={watch('usuarioId')}
          onValueChange={(val) => setValue('usuarioId', val)}
        >
          <SelectTrigger>
            <SelectValue placeholder={isLoadingUsuarios ? 'Carregando usuários...' : 'Selecione um usuário'} />
          </SelectTrigger>
          <SelectContent>
            {usuarios?.map((u: any) => (
              <SelectItem key={u.id} value={u.id}>
                {u.nome} ({u.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.usuarioId && <p className="text-xs text-destructive">{errors.usuarioId.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="titulo">Título</Label>
        <Input id="titulo" {...register('titulo')} placeholder="O que precisa ser feito?" />
        {errors.titulo && <p className="text-xs text-destructive">{errors.titulo.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição (Opcional)</Label>
        <Textarea id="descricao" {...register('descricao')} placeholder="Detalhes adicionais..." />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dataLimite">Prazo</Label>
          <Input id="dataLimite" type="date" {...register('dataLimite')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prioridade">Prioridade</Label>
          <Select
            value={watch('prioridade')}
            onValueChange={(val) => setValue('prioridade', val as any)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BAIXA">Baixa</SelectItem>
              <SelectItem value="MEDIA">Média</SelectItem>
              <SelectItem value="ALTA">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={watch('status')}
          onValueChange={(val) => setValue('status', val as any)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDENTE">Pendente</SelectItem>
            <SelectItem value="CONCLUIDA">Concluída</SelectItem>
            <SelectItem value="CANCELADA">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {initialData ? 'Salvar Alterações' : 'Criar Tarefa'}
        </Button>
      </div>
    </form>
  );
}
