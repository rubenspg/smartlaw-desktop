import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClienteForm } from '@/components/shared/cliente-form';
import { useCliente, useUpdateCliente } from '@/hooks/use-clientes';
import { useToast } from '@/components/ui/toast';
import { ClienteInput } from '@smartlaw/shared';

export const Route = createFileRoute('/_dashboard/clientes/$id_/editar')({
  component: EditClientePage,
});

function EditClientePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const clienteId = parseInt(id);

  const { data: cliente, isLoading, isError } = useCliente(clienteId);
  const updateCliente = useUpdateCliente(clienteId);
  const toast = useToast();

  const handleSubmit = async (data: ClienteInput) => {
    try {
      await updateCliente.mutateAsync(data);
      navigate({ to: '/clientes/$id', params: { id } });
    } catch (err: any) {
      console.error('Failed to update cliente:', err);
      toast.error(err.message || 'Erro ao atualizar cliente. Por favor, tente novamente.');
    }
  };

  if (isLoading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (isError || !cliente) return <div className="p-12 text-center text-destructive">Cliente não encontrado.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate({ to: '/clientes/$id', params: { id } })}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Editar Cliente</h1>
          <p className="text-muted-foreground">Atualize os dados de {cliente.nome}.</p>
        </div>
      </div>

      <div className="max-w-4xl">
        <ClienteForm 
          initialData={cliente}
          onSubmit={handleSubmit} 
          isSubmitting={updateCliente.isPending} 
        />
      </div>
    </div>
  );
}
