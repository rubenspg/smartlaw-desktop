import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProcessoAdminForm } from '@/components/shared/processo-admin-form';
import { useProcessoAdministrativo, useUpdateProcessoAdministrativo } from '@/hooks/use-processos';
import { useToast } from '@/components/ui/toast';
import { ProcessoAdministrativoInput } from '@smartlaw/shared';

export const Route = createFileRoute('/_dashboard/processos/admin/$id_/editar')({
  component: EditProcessoAdminPage,
});

function EditProcessoAdminPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const procId = parseInt(id);

  const { data: processo, isLoading, isError } = useProcessoAdministrativo(procId);
  const updateProcesso = useUpdateProcessoAdministrativo(procId);
  const toast = useToast();

  const handleSubmit = async (data: ProcessoAdministrativoInput) => {
    try {
      await updateProcesso.mutateAsync(data);
      navigate({ to: '/processos' }); // Redirect to list for now
    } catch (err) {
      console.error('Failed to update processo:', err);
      toast.error('Erro ao atualizar processo. Por favor, tente novamente.');
    }
  };

  if (isLoading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (isError || !processo) return <div className="p-12 text-center text-destructive">Processo não encontrado.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate({ to: '/processos' })}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Editar Processo Administrativo</h1>
          <p className="text-muted-foreground">Atualize os dados de {processo.numero}.</p>
        </div>
      </div>

      <div className="max-w-4xl">
        <ProcessoAdminForm 
          initialData={processo as any}
          onSubmit={handleSubmit} 
          isSubmitting={updateProcesso.isPending} 
        />
      </div>
    </div>
  );
}
