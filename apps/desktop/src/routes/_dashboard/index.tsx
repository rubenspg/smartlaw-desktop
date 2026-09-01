import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import {
  Plus,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';


import { useTarefas, useCreateTarefa, useUpdateTarefa, useDeleteTarefa, useToggleTarefaStatus } from '@/hooks/use-tarefas';
import { useAndamentosRecentes, useResumoPendencias, useResumoIA } from '@/hooks/use-dashboard';
import { TarefaForm } from '@/components/shared/tarefa-form';
import { TarefaDetails } from '@/components/shared/tarefa-details';
import { AndamentosRecentesCard } from '@/components/dashboard/andamentos-recentes-card';
import { TarefaListCard } from '@/components/dashboard/tarefa-list-card';
import { TarefaInput } from '@smartlaw/shared';
import { Tarefa } from '@/lib/entities';
import { useRegional } from '@/components/regional-provider';
import { useToast } from '@/components/ui/toast';

export const Route = createFileRoute('/_dashboard/')({
  component: HomeComponent,
});

// ... andamentos const remains same ...

function HomeComponent() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewingTarefa, setViewingTarefa] = useState<Tarefa | undefined>(undefined);
  const [editingTarefa, setEditingTarefa] = useState<Tarefa | undefined>(undefined);
  const [confirmingTarefa, setConfirmingTarefa] = useState<Tarefa | undefined>(undefined);

  const { t } = useRegional();
  const toast = useToast();
  const { data: tarefas, isLoading: isLoadingTarefas } = useTarefas();
  const { data: andamentosRecentes, isLoading: isLoadingAndamentos, refetch: refetchAndamentos } = useAndamentosRecentes();
  const { data: pendencias } = useResumoPendencias();
  const { data: resumoIA, isFetching: isLoadingResumoIA } = useResumoIA();
  const createTarefa = useCreateTarefa();
  const updateTarefa = useUpdateTarefa(editingTarefa?.id || 0);
  const toggleStatus = useToggleTarefaStatus();
  const deleteTarefa = useDeleteTarefa();

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
      toast.error(err.message);
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
        <AndamentosRecentesCard
          andamentos={andamentosRecentes}
          isLoading={isLoadingAndamentos}
          onRefresh={() => refetchAndamentos()}
        />

        <div className="space-y-8">
          <TarefaListCard
            tarefas={tarefas}
            isLoading={isLoadingTarefas}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggle={handleToggleClick}
          />
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
        <DialogContent className="w-full max-w-[95vw] md:max-w-4xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary/5 p-6 md:p-8 border-b border-primary/10">
            <DialogTitle className="text-2xl md:text-3xl font-black uppercase tracking-tight flex items-center gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <Plus className="w-6 h-6 md:w-7 md:h-7 text-primary-foreground" />
              </div>
              {editingTarefa ? 'Editar Compromisso' : 'Novo Agendamento'}
            </DialogTitle>
          </div>
          
          <div className="p-6 md:p-8 max-h-[70vh] overflow-y-auto">
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
