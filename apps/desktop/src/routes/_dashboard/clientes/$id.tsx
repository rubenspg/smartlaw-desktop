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
  Trash,
  AlertCircle
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
  const { data: processosJudiciais, isLoading: isLoadingJudiciais, isError: isErrorJudiciais } = useProcessosJudiciaisByCliente(clienteId);
  const { data: processosAdministrativos, isLoading: isLoadingAdm, isError: isErrorAdm } = useProcessosAdministrativosByCliente(clienteId);
  
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
      try {
        await deleteCliente.mutateAsync(clienteId);
        navigate({ to: '/clientes' });
      } catch (err: any) {
        console.error('Failed to delete cliente:', err);
        alert(err.message || 'Erro ao excluir cliente.');
      }
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
                  <p className="text-sm text-muted-foreground">Celular: {cliente.celular || 'Não informado'}</p>
                  {cliente.telefone1 && <p className="text-sm text-muted-foreground">Fixo 1: {cliente.telefone1}</p>}
                  {cliente.telefone2 && <p className="text-sm text-muted-foreground">Fixo 2: {cliente.telefone2}</p>}
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
                    {cliente.endereco ? `${cliente.endereco}, ${cliente.endNumero}` : 'Logradouro não informado'}
                    {cliente.complemento && ` - ${cliente.complemento}`}
                    <br />
                    {cliente.bairro && `${cliente.bairro}, `}
                    {cliente.municipio && `${cliente.municipio} - `}
                    {cliente.estado}
                    {cliente.cep && <><br />CEP: {cliente.cep}</>}
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
                  <p className="text-xs font-bold uppercase text-muted-foreground">{cliente.tipo === 'F' ? 'CPF' : 'CNPJ'}</p>
                  <p className="text-sm">{cliente.cpfCnpj || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground">{cliente.tipo === 'F' ? 'RG' : 'IE'}</p>
                  <p className="text-sm">{cliente.rg || '-'}</p>
                </div>
                {cliente.tipo === 'F' && (
                  <>
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground">Nascimento</p>
                      <p className="text-sm">{cliente.nascimento ? new Date(cliente.nascimento).toLocaleDateString('pt-BR') : '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground">Sexo</p>
                      <p className="text-sm">{cliente.sexo === 'M' ? 'Masculino' : cliente.sexo === 'F' ? 'Feminino' : cliente.sexo || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground">Estado Civil</p>
                      <p className="text-sm">{cliente.estCivil || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground">Profissão</p>
                      <p className="text-sm">{cliente.profissao || '-'}</p>
                    </div>
                  </>
                )}
                {cliente.tipo === 'J' && cliente.fantasia && (
                  <div className="col-span-2">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Nome Fantasia</p>
                    <p className="text-sm">{cliente.fantasia}</p>
                  </div>
                )}
              </div>
              
              {cliente.tipo === 'F' && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground">Nome da Mãe</p>
                      <p className="text-sm">{cliente.nomeMae || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground">Nome do Pai</p>
                      <p className="text-sm">{cliente.nomePai || '-'}</p>
                    </div>
                    {cliente.nomeConjuge && (
                      <div className="col-span-2">
                        <p className="text-xs font-bold uppercase text-muted-foreground">Cônjuge</p>
                        <p className="text-sm">{cliente.nomeConjuge}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
        </Card>
      </div>

      {cliente.observacoes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Observações Internas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{cliente.observacoes}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="historico" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="historico">Histórico / Notas ({notas?.length || 0})</TabsTrigger>
              <TabsTrigger value="processos">
                Processos 
                {isLoadingJudiciais || isLoadingAdm ? '...' : ` (${(processosJudiciais?.length || 0) + (processosAdministrativos?.length || 0)})`}
              </TabsTrigger>
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
              {(isErrorJudiciais || isErrorAdm) && (
                <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <p className="text-sm font-medium">Erro ao carregar processos do cliente.</p>
                </div>
              )}
              
              {/* Judiciais */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Processos Judiciais</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoadingJudiciais ? (
                    <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                  ) : processosJudiciais && processosJudiciais.length > 0 ? (
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
                  ) : (
                    <p className="text-center text-muted-foreground py-8 text-sm italic">Nenhum processo judicial vinculado.</p>
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
                  ) : processosAdministrativos && processosAdministrativos.length > 0 ? (
                    <div className="divide-y">
                      {processosAdministrativos.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/40 transition-colors">
                          <div>
                            <p className="text-sm font-semibold">{p.numero || `#${p.id}`}</p>
                            {p.dataCadastro && <p className="text-xs text-muted-foreground">{new Date(p.dataCadastro).toLocaleDateString('pt-BR')}</p>}
                          </div>
                          <Link to="/processos/admin/$id" params={{ id: p.id.toString() }} className="text-muted-foreground hover:text-primary">
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8 text-sm italic">Nenhum processo administrativo vinculado.</p>
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
