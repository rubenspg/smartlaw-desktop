import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState } from 'react';
import {
  ArrowLeft,
  Edit,
  Trash2,
  User as UserIcon,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Plus,
  Loader2,
  Trash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useCliente, useDeleteCliente } from '@/hooks/use-clientes';
import { useClientesNotas, useCreateClienteNota, useDeleteClienteNota } from '@/hooks/use-clientes-notas';
import { useProcessosJudiciaisByCliente, useProcessosAdministrativosByCliente } from '@/hooks/use-processos';

export const Route = createFileRoute('/_dashboard/clientes/$id')({
  component: ClienteDetailPage,
});

function ClienteDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const clienteId = parseInt(id);

  const { data: cliente, isLoading, isError } = useCliente(clienteId);
  const { data: notas, isLoading: isLoadingNotas } = useClientesNotas(clienteId);
  const { data: processosJudiciais, isLoading: isLoadingJudiciais } = useProcessosJudiciaisByCliente(clienteId);
  const { data: processosAdministrativos, isLoading: isLoadingAdm } = useProcessosAdministrativosByCliente(clienteId);
  
  const createNota = useCreateClienteNota();
  const deleteNota = useDeleteClienteNota(clienteId);
  const deleteCliente = useDeleteCliente();

  const [novaNota, setNovaNota] = useState('');

  const handleAddNota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaNota.trim()) return;

    await createNota.mutateAsync({
      clienteId,
      texto: novaNota,
    });
    setNovaNota('');
  };

  const handleDeleteCliente = async () => {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
      await deleteCliente.mutateAsync(clienteId);
      navigate({ to: '/clientes' });
    }
  };

  if (isLoading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (isError || !cliente) return <div className="p-12 text-center text-destructive">Cliente não encontrado.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate({ to: '/clientes' })}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{cliente.nome}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={cliente.situacao === 'A' ? 'success' : 'destructive'}>
                {cliente.situacao === 'A' ? 'Ativo' : 'Inativo'}
              </Badge>
              <span className="text-muted-foreground text-sm">ID: {cliente.id}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: '/clientes/$id/editar', params: { id } })}>
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
          <Button variant="destructive" onClick={handleDeleteCliente}>
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações de Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-muted-foreground mt-1" />
                <div>
                  <p className="text-sm font-medium">Telefones</p>
                  <p className="text-sm text-muted-foreground">{cliente.celular || cliente.telefone1 || 'Não informado'}</p>
                  {cliente.telefone2 && <p className="text-sm text-muted-foreground">{cliente.telefone2}</p>}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-muted-foreground mt-1" />
                <div>
                  <p className="text-sm font-medium">E-mail</p>
                  <p className="text-sm text-muted-foreground">{cliente.email || 'Não informado'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                <div>
                  <p className="text-sm font-medium">Endereço</p>
                  <p className="text-sm text-muted-foreground">
                    {cliente.endereco ? `${cliente.endereco}, ${cliente.endNumero}` : 'Não informado'}
                    {cliente.complemento && ` - ${cliente.complemento}`}
                    <br />
                    {cliente.bairro && `${cliente.bairro}, `}
                    {cliente.municipio && `${cliente.municipio} - `}
                    {cliente.estado}
                  </p>
                </div>
              </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
              <CardTitle className="text-lg">Documentos e Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground">CPF/CNPJ</p>
                  <p className="text-sm">{cliente.cpfCnpj || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground">RG</p>
                  <p className="text-sm">{cliente.rg || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground">Nascimento</p>
                  <p className="text-sm">{cliente.nascimento ? new Date(cliente.nascimento).toLocaleDateString('pt-BR') : '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground">Sexo</p>
                  <p className="text-sm">{cliente.sexo || '-'}</p>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Profissão</p>
                <p className="text-sm">{cliente.profissao || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Estado Civil</p>
                <p className="text-sm">{cliente.estCivil || '-'}</p>
              </div>
            </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="historico" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="historico">Histórico / Notas</TabsTrigger>
              <TabsTrigger value="processos">Processos</TabsTrigger>
              <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            </TabsList>
            
            <TabsContent value="historico" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Plus className="w-4 h-4 text-primary" />
                    Novo Registro de Atendimento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddNota} className="space-y-4">
                    <Textarea 
                      placeholder="Descreva o que aconteceu no atendimento..." 
                      value={novaNota}
                      onChange={(e) => setNovaNota(e.target.value)}
                      className="min-h-[100px]"
                    />
                    <div className="flex justify-end">
                      <Button type="submit" disabled={createNota.isPending || !novaNota.trim()}>
                        {createNota.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                        Registrar Atendimento
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-4">
                {isLoadingNotas ? (
                  <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                ) : notas?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 border rounded-lg border-dashed">
                    Nenhum histórico registrado.
                  </p>
                ) : (
                  notas?.map((nota: any) => (
                    <Card key={nota.id} className="relative group">
                      <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {new Date(nota.createdAt).toLocaleString('pt-BR')}
                          </Badge>
                          <span className="text-xs font-bold flex items-center gap-1">
                            <UserIcon className="w-3 h-3" /> {nota.usuario?.nome}
                          </span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => confirm('Excluir esta nota?') && deleteNota.mutate(nota.id)}
                        >
                          <Trash className="w-3 h-3 text-destructive" />
                        </Button>
                      </CardHeader>
                      <CardContent className="p-4">
                        <p className="text-sm whitespace-pre-wrap">{nota.texto}</p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="processos" className="mt-6 space-y-6">
              {/* Judiciais */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Processos Judiciais</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoadingJudiciais ? (
                    <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                  ) : !processosJudiciais?.length ? (
                    <p className="text-center text-muted-foreground py-8 text-sm italic">Nenhum processo judicial vinculado.</p>
                  ) : (
                    <div className="divide-y">
                      {processosJudiciais.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/40 transition-colors">
                          <div>
                            <p className="text-sm font-semibold">{p.numero}</p>
                            {p.situacao && <p className="text-xs text-muted-foreground">{p.situacao}</p>}
                          </div>
                          <Link to="/processos/$id" params={{ id: p.id.toString() }} className="text-muted-foreground hover:text-primary">
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Administrativos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Processos Administrativos</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoadingAdm ? (
                    <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                  ) : !processosAdministrativos?.length ? (
                    <p className="text-center text-muted-foreground py-8 text-sm italic">Nenhum processo administrativo vinculado.</p>
                  ) : (
                    <div className="divide-y">
                      {processosAdministrativos.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/40 transition-colors">
                          <div>
                            <p className="text-sm font-semibold">{p.numero || `#${p.id}`}</p>
                            {p.dataCadastro && <p className="text-xs text-muted-foreground">{new Date(p.dataCadastro).toLocaleDateString('pt-BR')}</p>}
                          </div>
                          <Link to="/processos/$id" params={{ id: p.id.toString() }} className="text-muted-foreground hover:text-primary">
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="financeiro" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Financeiro</CardTitle>
                  <CardDescription>Honorários e pagamentos.</CardDescription>
                </CardHeader>
                <CardContent className="p-12 text-center text-muted-foreground italic">
                  Módulo financeiro em breve...
                </CardContent>
              </Card>
            </TabsContent>
      </Tabs>
    </div>
  );
}
