import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProcessoAdminForm } from '@/components/shared/processo-admin-form';
import { useCreateProcessoAdministrativo } from '@/hooks/use-processos';
import { ProcessoAdministrativoInput } from '@smartlaw/shared';

export const Route = createFileRoute('/_dashboard/processos/admin/novo')({
  component: NewProcessoAdminPage,
});

function NewProcessoAdminPage() {
  const navigate = useNavigate();
  const createProcesso = useCreateProcessoAdministrativo();

  const handleSubmit = async (data: ProcessoAdministrativoInput) => {
    try {
      const result = await createProcesso.mutateAsync(data);
      navigate({ to: '/processos' }); // Redirect to list for now
    } catch (err) {
      console.error('Failed to create processo:', err);
      alert('Erro ao cadastrar processo. Por favor, tente novamente.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate({ to: '/processos' })}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Novo Processo Administrativo</h1>
          <p className="text-muted-foreground">Preencha os dados do processo administrativo.</p>
        </div>
      </div>

      <div className="max-w-4xl">
        <ProcessoAdminForm 
          onSubmit={handleSubmit} 
          isSubmitting={createProcesso.isPending} 
        />
      </div>
    </div>
  );
}
