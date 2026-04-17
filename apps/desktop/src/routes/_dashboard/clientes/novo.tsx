import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClienteForm } from '@/components/shared/cliente-form';
import { useCreateCliente } from '@/hooks/use-clientes';
import { ClienteInput } from '@smartlaw/shared';

export const Route = createFileRoute('/_dashboard/clientes/novo')({
  component: NewClientePage,
});

function NewClientePage() {
  const navigate = useNavigate();
  const createCliente = useCreateCliente();

  const handleSubmit = async (data: ClienteInput) => {
    try {
      const result = await createCliente.mutateAsync(data);
      navigate({ to: '/clientes/$id', params: { id: result.id.toString() } });
    } catch (err) {
      console.error('Failed to create cliente:', err);
      alert('Erro ao cadastrar cliente. Por favor, tente novamente.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate({ to: '/clientes' })}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Novo Cliente</h1>
          <p className="text-muted-foreground">Preencha os dados para cadastrar um novo cliente.</p>
        </div>
      </div>

      <div className="max-w-4xl">
        <ClienteForm 
          onSubmit={handleSubmit} 
          isSubmitting={createCliente.isPending} 
        />
      </div>
    </div>
  );
}
