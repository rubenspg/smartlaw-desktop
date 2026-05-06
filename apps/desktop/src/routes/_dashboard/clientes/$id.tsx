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
  AlertCircle,
  DollarSign,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Pencil,
  FileText,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCliente, useDeleteCliente } from '@/hooks/use-clientes';
import { useClientesNotas, useCreateClienteNota, useDeleteClienteNota } from '@/hooks/use-clientes-notas';
import { useProcessosJudiciaisByCliente, useProcessosAdministrativosByCliente } from '@/hooks/use-processos';
import { useHonorarios, useHonorarioSummary, useCreateHonorario, useUpdateHonorario, useDeleteHonorario } from '@/hooks/use-honorarios';
import { useRegional } from '@/components/regional-provider';
import { cn } from '@/lib/utils';
import type { Honorario, HonorarioInput } from '@smartlaw/shared';
import { openUrl } from '@tauri-apps/plugin-opener';

export const Route = createFileRoute('/_dashboard/clientes/$id')({
  component: ClienteDetailPage,
});

function ClienteDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { formatCurrency, formatDate } = useRegional();
  const clienteId = parseInt(id);

  const { data: cliente, isLoading, isError } = useCliente(clienteId);
  const { data: notas, isLoading: isLoadingNotas } = useClientesNotas(clienteId);
  const { data: processosJudiciais, isLoading: isLoadingJudiciais, isError: isErrorJudiciais } = useProcessosJudiciaisByCliente(clienteId);
  const { data: processosAdministrativos, isLoading: isLoadingAdm, isError: isErrorAdm } = useProcessosAdministrativosByCliente(clienteId);
  
  const createNota = useCreateClienteNota();
  const deleteNota = useDeleteClienteNota(clienteId);
  const deleteCliente = useDeleteCliente();

  const [novaNota, setNovaNota] = useState('');

  const handleWhatsApp = async () => {
    const numberToUse = cliente?.celular || cliente?.telefone1 || cliente?.telefone2;
    if (!numberToUse) {
      alert('Cliente não possui telefone cadastrado');
      return;
    }

    const cleaned = numberToUse.replace(/\D/g, '');
    const number = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
    await openUrl(`https://wa.me/${number}`);
  };

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

              {(cliente.celular || cliente.telefone1 || cliente.telefone2) && (
                <div className="pt-2">
                  <Button 
                    className="w-full bg-[#16a34a] hover:bg-[#15803d] font-bold text-xs uppercase"
                    onClick={handleWhatsApp}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Chamar no WhatsApp
                  </Button>
                </div>
              )}
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
                      <p className="text-sm">{cliente.nascimento ? formatDate(cliente.nascimento) : '-'}</p>
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
                            {p.dataCadastro && <p className="text-xs text-muted-foreground">{formatDate(p.dataCadastro)}</p>}
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
              <ClienteFinanceiroTab clienteId={clienteId} />
            </TabsContent>
      </Tabs>
    </div>
  );
}

function ClienteFinanceiroTab({ clienteId }: { clienteId: number }) {
  const { formatCurrency, formatDate } = useRegional();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingHonorario, setEditingHonorario] = useState<Honorario | null>(null);

  const { data: honorarios, isLoading } = useHonorarios({ clienteId });
  const { data: summary, isLoading: isLoadingSummary } = useHonorarioSummary({ clienteId });
  const deleteMutation = useDeleteHonorario();
  const createMutation = useCreateHonorario();
  const updateMutation = useUpdateHonorario();

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir este honorário?')) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  if (isLoading || isLoadingSummary) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#f0fdf4] border-[#bcf0da]">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#166534] uppercase tracking-wider">Recebido</p>
                <p className="text-2xl font-black text-[#15803d] mt-1">
                  {formatCurrency(summary?.totalRecebido || 0)}
                </p>
              </div>
              <div className="p-3 bg-[#dcfce7] rounded-xl">
                <CheckCircle2 className="w-6 h-6 text-[#16a34a]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#fffbeb] border-[#fef3c7]">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#92400e] uppercase tracking-wider">Pendente</p>
                <p className="text-2xl font-black text-[#b45309] mt-1">
                  {formatCurrency(summary?.totalPendente || 0)}
                </p>
              </div>
              <div className="p-3 bg-[#fef3c7] rounded-xl">
                <DollarSign className="w-6 h-6 text-[#d97706]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#fef2f2] border-[#fee2e2]">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#991b1b] uppercase tracking-wider">Atrasado</p>
                <p className="text-2xl font-black text-[#dc2626] mt-1">
                  {formatCurrency(summary?.totalAtrasado || 0)}
                </p>
              </div>
              <div className="p-3 bg-[#fee2e2] rounded-xl">
                <AlertCircle className="w-6 h-6 text-[#dc2626]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Honorários do Cliente</CardTitle>
            <CardDescription>Histórico completo de lançamentos financeiros.</CardDescription>
          </div>
          <Button onClick={() => setShowAddForm(true)} className="bg-[#2563eb] hover:bg-[#1d4ed8]">
            <Plus className="w-4 h-4 mr-2" /> Novo Honorário
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] text-[10px] font-black uppercase tracking-wider text-[#94a3b8] border-b border-[#f1f5f9]">
                  <th className="px-6 py-3">Descrição</th>
                  <th className="px-6 py-3">Vencimento</th>
                  <th className="px-6 py-3">Valor</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {honorarios?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-[#94a3b8] italic">
                      Nenhum honorário registrado para este cliente.
                    </td>
                  </tr>
                ) : (
                  honorarios?.map((h: any) => (
                    <tr key={h.id} className="hover:bg-[#f8fafc] transition-colors text-sm">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-[#f1f5f9] rounded-lg">
                            <FileText className="w-4 h-4 text-[#64748b]" />
                          </div>
                          <div>
                            <p className="font-bold text-[#1e293b]">{h.descricao}</p>
                            <p className="text-[10px] text-[#94a3b8] uppercase font-bold">{h.tipo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[#64748b] font-medium">
                        {h.dataVenc ? formatDate(h.dataVenc) : '—'}
                      </td>
                      <td className="px-6 py-4 font-black text-[#1e293b]">
                        {formatCurrency(Number(h.valor))}
                      </td>
                      <td className="px-6 py-4">
                        <Badge 
                          variant={h.status === 'PAGO' ? 'success' : 'outline'}
                          className={cn(
                            "font-bold uppercase tracking-wider text-[10px]",
                            h.status === 'PENDENTE' && new Date(h.dataVenc) < new Date() ? "bg-[#fee2e2] text-[#dc2626] border-[#fecaca]" : ""
                          )}
                        >
                          {h.status === 'PENDENTE' && new Date(h.dataVenc) < new Date() ? 'Atrasado' : h.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-[#64748b]"
                            onClick={() => setEditingHonorario(h)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-[#64748b] hover:text-[#dc2626]"
                            onClick={() => handleDelete(h.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {showAddForm && (
        <HonorarioFormDialog
          clienteId={clienteId}
          onClose={() => setShowAddForm(false)}
          onSubmit={async (data) => {
            try {
              await createMutation.mutateAsync(data);
              setShowAddForm(false);
            } catch (err: any) {
              alert(err.message);
            }
          }}
          isSubmitting={createMutation.isPending}
        />
      )}

      {editingHonorario && (
        <HonorarioFormDialog
          clienteId={clienteId}
          honorario={editingHonorario}
          onClose={() => setEditingHonorario(null)}
          onSubmit={async (data) => {
            try {
              await updateMutation.mutateAsync({ id: editingHonorario.id, data });
              setEditingHonorario(null);
            } catch (err: any) {
              alert(err.message);
            }
          }}
          isSubmitting={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function HonorarioFormDialog({
  clienteId,
  honorario,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  clienteId: number;
  honorario?: Honorario;
  onClose: () => void;
  onSubmit: (data: HonorarioInput) => void;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState<HonorarioInput>({
    clienteId,
    descricao: honorario?.descricao ?? '',
    valor: honorario?.valor?.toString() ?? '',
    valorPago: honorario?.valorPago?.toString() ?? '0',
    dataVenc: honorario?.dataVenc ?? new Date().toISOString().split('T')[0],
    dataPagto: honorario?.dataPagto ?? null,
    status: (honorario?.status as any) ?? 'PENDENTE',
    tipo: (honorario?.tipo as any) ?? 'HONORARIO',
    observacoes: honorario?.observacoes ?? '',
  });

  const isEditing = !!honorario;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-[#f1f5f9] flex items-center justify-between bg-[#f8fafc]">
          <h2 className="text-xl font-black uppercase flex items-center gap-2 text-[#1e293b]">
            {isEditing ? 'Editar Honorário' : 'Novo Honorário'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <XCircle className="w-6 h-6 text-[#64748b]" />
          </Button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(formData);
          }}
          className="p-6 space-y-4"
        >
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase text-[#64748b]">Descrição</Label>
            <Input
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Ex: Honorários Contratuais - Inicial"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-[#64748b]">Valor Total</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-[#64748b]">Vencimento</Label>
              <Input
                type="date"
                value={formData.dataVenc}
                onChange={(e) => setFormData({ ...formData, dataVenc: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-[#64748b]">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(v: any) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                  <SelectItem value="PAGO">Pago</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-[#64748b]">Tipo</Label>
              <Select 
                value={formData.tipo} 
                onValueChange={(v: any) => setFormData({ ...formData, tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HONORARIO">Honorário</SelectItem>
                  <SelectItem value="CUSTAS">Custas</SelectItem>
                  <SelectItem value="SUCUMBENCIA">Sucumbência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.status === 'PAGO' && (
            <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-[#64748b]">Valor Pago</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.valorPago || ''}
                  onChange={(e) => setFormData({ ...formData, valorPago: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-[#64748b]">Data Pagto</Label>
                <Input
                  type="date"
                  value={formData.dataPagto || ''}
                  onChange={(e) => setFormData({ ...formData, dataPagto: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <Button type="button" variant="outline" className="flex-1 font-bold" onClick={onClose}>
              CANCELAR
            </Button>
            <Button type="submit" className="flex-1 bg-[#2563eb] font-bold" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'SALVAR'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
