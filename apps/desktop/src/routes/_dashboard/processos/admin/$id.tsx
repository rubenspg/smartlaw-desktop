import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  User as UserIcon, 
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useProcessoAdministrativo, useDeleteProcessoAdministrativo } from '@/hooks/use-processos';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_dashboard/processos/admin/$id')({
  component: ProcessoAdminDetailPage,
});

function ProcessoAdminDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const procId = parseInt(id);

  const { data: processo, isLoading, isError } = useProcessoAdministrativo(procId);
  const deleteProcesso = useDeleteProcessoAdministrativo();

  const handleDelete = async () => {
    if (confirm('Tem certeza que deseja excluir este processo administrativo?')) {
      await deleteProcesso.mutateAsync(procId);
      navigate({ to: '/processos' });
    }
  };

  if (isLoading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (isError || !processo) return <div className="p-12 text-center text-destructive">Processo não encontrado.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate({ to: '/processos' })}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{processo.numero}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">Processo Administrativo</Badge>
              <Link to="/clientes/$id" params={{ id: processo.clienteId?.toString() || '' }} className="text-sm text-primary hover:underline flex items-center gap-1">
                <UserIcon className="w-3 h-3" /> {processo.cliente?.nome}
              </Link>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: '/processos/admin/$id/editar', params: { id } })}>
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações do Processo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Número / Referência</p>
                <p className="text-sm">{processo.numero}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Pasta</p>
                <p className="text-sm">{processo.pasta || '-'}</p>
              </div>
              <Separator />
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Data de Abertura</p>
                <p className="text-sm flex items-center gap-2">
                  <CalendarIcon className="w-3 h-3" /> 
                  {processo.abertura ? new Date(processo.abertura).toLocaleDateString('pt-BR') : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Início do Benefício</p>
                <p className="text-sm">
                  {processo.inicioBeneficio ? new Date(processo.inicioBeneficio).toLocaleDateString('pt-BR') : '-'}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Decisão / Status Atual</p>
                <p className="text-sm font-semibold">{processo.decisao || 'Em andamento'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Tabs defaultValue="andamentos" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="andamentos">Andamentos ({processo.andamentos?.length || 0})</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
            </TabsList>
            
            <TabsContent value="andamentos" className="space-y-4 mt-6">
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted">
                {processo.andamentos?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 border rounded-lg border-dashed">
                    Nenhuma movimentação registrada.
                  </p>
                ) : (
                  processo.andamentos?.map((andamento: any) => (
                    <div key={andamento.id} className="relative">
                      <div className="absolute -left-[1.65rem] top-1.5 w-3 h-3 rounded-full border-2 border-background shadow-sm bg-muted-foreground" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(andamento.data).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-sm font-medium leading-relaxed">{andamento.historico}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-end pt-4">
                 <Button variant="outline" size="sm">
                   <ClipboardList className="w-4 h-4 mr-2" />
                   Adicionar Andamento Manual
                 </Button>
              </div>
            </TabsContent>

            <TabsContent value="documentos" className="mt-6">
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground italic">
                  Integração com pastas de documentos em breve...
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
