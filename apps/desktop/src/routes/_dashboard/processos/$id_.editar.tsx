import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProcessoJudicial, useUpdateProcessoJudicial } from '@/hooks/use-processos';
import { ProcessoJudicialForm } from '@/components/shared/processo-judicial-form';
import { ProcessoJudicialInput } from '@smartlaw/shared';

export const Route = createFileRoute('/_dashboard/processos/$id_/editar')({
  component: EditProcessoPage,
});

function EditProcessoPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const procId = parseInt(id);

  const { data: processo, isLoading, isError } = useProcessoJudicial(procId);
  const updateMutation = useUpdateProcessoJudicial(procId);

  const handleSubmit = async (data: ProcessoJudicialInput) => {
    try {
      await updateMutation.mutateAsync(data);
      navigate({ to: '/processos/$id', params: { id } });
    } catch (err) {
      console.error('Update error:', err);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (isError || !processo) return <div className="p-12 text-center text-destructive">Processo não encontrado.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate({ to: '/processos/$id', params: { id } })}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Editar Processo</h1>
          <p className="text-muted-foreground">Atualize as informações do processo judicial.</p>
        </div>
      </div>

      <div className="max-w-4xl">
        <ProcessoJudicialForm 
          initialData={processo}
          onSubmit={handleSubmit}
          isSubmitting={updateMutation.isPending}
        />
      </div>
    </div>
  );
}
