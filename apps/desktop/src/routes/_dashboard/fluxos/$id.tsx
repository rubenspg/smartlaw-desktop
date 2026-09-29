import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { WorkflowInput } from '@smartlaw/shared';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useSalvarWorkflow, useWorkflow } from '@/hooks/use-workflows';
import { WorkflowForm } from '@/components/fluxos/workflow-form';
import { HistoricoTab } from '@/components/fluxos/historico-tab';
import { SomenteAdmin } from '@/components/fluxos/somente-admin';

export const Route = createFileRoute('/_dashboard/fluxos/$id')({
  component: () => (
    <SomenteAdmin>
      <EditarFluxoPage />
    </SomenteAdmin>
  ),
});

function EditarFluxoPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: fluxo, isLoading, isError } = useWorkflow(Number(id));
  const salvar = useSalvarWorkflow();

  const handleSubmit = async (data: WorkflowInput) => {
    try {
      await salvar.mutateAsync({ id: Number(id), data });
      toast.success('Fluxo salvo.');
      navigate({ to: '/fluxos' });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate({ to: '/fluxos' })}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{fluxo?.nome ?? 'Fluxo'}</h1>
          <p className="text-muted-foreground">Editar o fluxo de trabalho.</p>
        </div>
      </div>

      {isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      ) : isError || !fluxo ? (
        <p className="text-destructive">Fluxo não encontrado.</p>
      ) : (
        <div className="max-w-4xl space-y-8">
          <WorkflowForm
            initialData={{
              nome: fluxo.nome,
              descricao: fluxo.descricao,
              ativo: fluxo.ativo,
              gatilho: fluxo.gatilho,
              condicoes: fluxo.condicoes,
              acoes: fluxo.acoes,
            }}
            onSubmit={handleSubmit}
            isSubmitting={salvar.isPending}
          />
          <div className="space-y-3">
            <h2 className="text-xl font-bold">Últimas execuções</h2>
            <HistoricoTab workflowId={fluxo.id} />
          </div>
        </div>
      )}
    </div>
  );
}
