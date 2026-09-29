import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import type { WorkflowInput } from '@smartlaw/shared';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useSalvarWorkflow } from '@/hooks/use-workflows';
import { WorkflowForm } from '@/components/fluxos/workflow-form';
import { SomenteAdmin } from '@/components/fluxos/somente-admin';

export const Route = createFileRoute('/_dashboard/fluxos/novo')({
  component: () => (
    <SomenteAdmin>
      <NovoFluxoPage />
    </SomenteAdmin>
  ),
});

function NovoFluxoPage() {
  const navigate = useNavigate();
  const salvar = useSalvarWorkflow();
  const toast = useToast();

  const handleSubmit = async (data: WorkflowInput) => {
    try {
      await salvar.mutateAsync({ data });
      toast.success('Fluxo criado.');
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
          <h1 className="text-3xl font-bold tracking-tight">Novo fluxo</h1>
          <p className="text-muted-foreground">Quando algo acontecer com um cliente, o que o sistema deve fazer.</p>
        </div>
      </div>
      <div className="max-w-4xl">
        <WorkflowForm onSubmit={handleSubmit} isSubmitting={salvar.isPending} />
      </div>
    </div>
  );
}
