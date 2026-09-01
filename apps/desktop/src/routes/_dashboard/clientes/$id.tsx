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
  Calendar as CalendarIcon,
  MessageSquare,
  History,
  Info,
  Building2,
  Hash,
  Briefcase,
  Activity,
  Notebook,
  Users,
  Gavel,
  ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useCliente, useDeleteCliente } from '@/hooks/use-clientes';
import { useClientesNotas, useCreateClienteNota, useDeleteClienteNota } from '@/hooks/use-clientes-notas';
import { useProcessosJudiciaisByCliente, useProcessosAdministrativosByCliente } from '@/hooks/use-processos';
import { useRegional } from '@/components/regional-provider';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { openUrl } from '@tauri-apps/plugin-opener';

export const Route = createFileRoute('/_dashboard/clientes/$id')({
  component: ClienteDetailPage,
});

function ClienteDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { formatDate } = useRegional();
  const clienteId = parseInt(id);

  const { data: cliente, isLoading, isError } = useCliente(clienteId);
  const { data: notas, isLoading: isLoadingNotas } = useClientesNotas(clienteId);
  const { data: judiciaisResult, isLoading: isLoadingJudiciais } = useProcessosJudiciaisByCliente(clienteId);
  const { data: administrativosResult, isLoading: isLoadingAdm } = useProcessosAdministrativosByCliente(clienteId);
  const processosJudiciais = judiciaisResult?.data;
  const processosAdministrativos = administrativosResult?.data;
  
  const createNota = useCreateClienteNota();
  const deleteNota = useDeleteClienteNota(clienteId);
  const deleteCliente = useDeleteCliente();
  const toast = useToast();
  const confirm = useConfirm();

  const [novaNota, setNovaNota] = useState('');

  const handleWhatsApp = async () => {
    const numberToUse = cliente?.celular || cliente?.telefone1 || cliente?.telefone2;
    if (!numberToUse) {
      toast.error('Cliente não possui telefone cadastrado');
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
    if (await confirm({ description: 'Tem certeza que deseja excluir este cliente?', destructive: true, confirmText: 'Excluir' })) {
      try {
        await deleteCliente.mutateAsync(clienteId);
        navigate({ to: '/clientes' });
      } catch (err: any) {
        console.error('Failed to delete cliente:', err);
        toast.error(err.message || 'Erro ao excluir cliente.');
      }
    }
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  if (isError || !cliente) return <div className="p-12 text-center text-destructive font-bold">Cliente não encontrado.</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10 animate-fade-in">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col gap-4">
        <button 
          onClick={() => navigate({ to: '/clientes' })}
          className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para Clientes
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm ring-4 ring-primary/5">
                <UserIcon className="w-6 h-6" />
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
                {cliente.nome}
              </h1>
            </div>
            <div className="flex items-center gap-2 ml-1">
              <Badge 
                variant={cliente.situacao === 'A' ? 'outline' : 'destructive'}
                className={cn(
                  "font-bold px-2.5 py-0.5 rounded-lg text-[10px] uppercase tracking-wider",
                  cliente.situacao === 'A' ? "bg-emerald-500/5 text-emerald-600 border-emerald-500/20" : ""
                )}
              >
                {cliente.situacao === 'A' ? 'Ativo' : 'Inativo'}
              </Badge>
              <div className="h-4 w-[1px] bg-border mx-1" />
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                ID do Sistema: {cliente.id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              className="rounded-xl font-bold text-xs uppercase tracking-wider h-11 px-5 border-border shadow-sm hover:bg-accent transition-all active:scale-95"
              onClick={() => navigate({ to: '/clientes/$id/editar', params: { id } })}
            >
              <Edit className="w-4 h-4 mr-2 text-muted-foreground" />
              Editar Perfil
            </Button>
            <Button 
              variant="outline" 
              className="rounded-xl font-bold text-xs uppercase tracking-wider h-11 px-5 border-border shadow-sm text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-all active:scale-95"
              onClick={handleDeleteCliente}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </Button>
            <Button 
              className="rounded-xl font-bold text-xs uppercase tracking-wider h-11 px-6 shadow-premium hover:shadow-premium-lg transition-all active:scale-95"
              onClick={handleWhatsApp}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              WhatsApp
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="border-border/40 shadow-premium bg-card/50 backdrop-blur-sm">
              <CardHeader className="bg-muted/30 border-b border-border/40 py-4">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground/80">Canais de Contato</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <DataField icon={Phone} label="Celular Principal" value={cliente.celular} />
                {(cliente.telefone1 || cliente.telefone2) && (
                  <div className="grid grid-cols-2 gap-4">
                    <DataField icon={Phone} label="Fixo 1" value={cliente.telefone1} />
                    <DataField icon={Phone} label="Fixo 2" value={cliente.telefone2} />
                  </div>
                )}
                <DataField icon={Mail} label="E-mail" value={cliente.email} isLowercase />
                <DataField icon={MapPin} label="Endereço Completo" 
                  value={cliente.endereco ? `${cliente.endereco}, ${cliente.endNumero}${cliente.complemento ? ` - ${cliente.complemento}` : ''} | ${cliente.bairro}, ${cliente.municipio}-${cliente.estado} (CEP: ${cliente.cep || '-'})` : 'Não informado'} 
                />
              </CardContent>
            </Card>

            <Card className="border-border/40 shadow-premium bg-card/50 backdrop-blur-sm">
              <CardHeader className="bg-muted/30 border-b border-border/40 py-4">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground/80">Documentação</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <DataField icon={Hash} label={cliente.tipo === 'F' ? 'CPF' : 'CNPJ'} value={cliente.cpfCnpj} />
                  <DataField icon={Hash} label={cliente.tipo === 'F' ? 'RG' : 'IE'} value={cliente.rg} />
                  <DataField icon={CalendarIcon} label="Nascimento" value={cliente.nascimento ? formatDate(cliente.nascimento) : '-'} />
                  <DataField icon={Activity} label="Sexo" value={cliente.sexo === 'M' ? 'Masculino' : cliente.sexo === 'F' ? 'Feminino' : cliente.sexo} />
                </div>
                <Separator className="bg-border/40" />
                <div className="grid grid-cols-2 gap-6">
                  <DataField icon={Briefcase} label="Profissão" value={cliente.profissao} />
                  <DataField icon={Users} label="Estado Civil" value={cliente.estCivil} />
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="historico" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-xl h-12">
              <TabsTrigger value="historico" className="rounded-lg font-bold text-xs uppercase tracking-widest h-10">
                <Notebook className="w-3.5 h-3.5 mr-2" /> Histórico
              </TabsTrigger>
              <TabsTrigger value="processos" className="rounded-lg font-bold text-xs uppercase tracking-widest h-10">
                <Gavel className="w-3.5 h-3.5 mr-2" /> Processos
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="historico" className="space-y-8 mt-8 animate-in fade-in-up duration-300">
              <Card className="border-border/40 shadow-premium bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-extrabold tracking-tight flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" />
                    Novo Registro de Atendimento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddNota} className="space-y-4">
                    <Textarea 
                      placeholder="Descreva o atendimento ou observação importante sobre este cliente..." 
                      value={novaNota}
                      onChange={(e) => setNovaNota(e.target.value)}
                      className="min-h-[120px] rounded-2xl border-border/50 bg-background/50 focus:ring-primary/20 transition-all font-medium"
                    />
                    <div className="flex justify-end">
                      <Button 
                        type="submit" 
                        disabled={createNota.isPending || !novaNota.trim()}
                        className="rounded-xl font-bold px-6 shadow-premium active:scale-95"
                      >
                        {createNota.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                        Registrar Nota
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-primary/30 before:via-primary/10 before:to-transparent">
                {isLoadingNotas ? (
                  <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary/40" /></div>
                ) : notas?.length === 0 ? (
                  <div className="text-center py-16 bg-muted/20 rounded-2xl border-2 border-dashed border-border/40 ml-4">
                    <History className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground font-semibold">Nenhum registro encontrado.</p>
                  </div>
                ) : (
                  notas?.map((nota: any) => (
                    <div key={nota.id} className="relative group">
                       <div className="absolute -left-[23px] top-1.5 w-5 h-5 rounded-full border-4 border-background bg-primary shadow-sm z-10" />
                       <Card className="border-border/40 shadow-sm group-hover:shadow-premium transition-all duration-300 bg-card/60 ml-2">
                        <CardHeader className="py-3 px-5 border-b border-border/20 flex flex-row items-center justify-between space-y-0">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-[10px] font-bold bg-primary/5 text-primary border-none rounded-lg">
                              {new Date(nota.createdAt).toLocaleString('pt-BR')}
                            </Badge>
                            <span className="text-xs font-black text-foreground/70 uppercase tracking-widest flex items-center gap-1.5">
                              <UserIcon className="w-3 h-3 text-primary" /> {nota.usuario?.nome}
                            </span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                            onClick={async () => {
                              if (await confirm({ description: 'Excluir esta nota?', destructive: true, confirmText: 'Excluir' })) {
                                deleteNota.mutate(nota.id);
                              }
                            }}
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </Button>
                        </CardHeader>
                        <CardContent className="p-5">
                          <p className="text-sm font-medium leading-relaxed text-foreground/90 whitespace-pre-wrap">{nota.texto}</p>
                        </CardContent>
                      </Card>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="processos" className="mt-8 space-y-8 animate-in fade-in-up duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Judiciais */}
                <Card className="border-border/40 shadow-premium bg-card/50 backdrop-blur-sm overflow-hidden">
                  <CardHeader className="bg-muted/30 border-b border-border/40 py-4">
                    <div className="flex items-center gap-2">
                      <Gavel className="w-4.5 h-4.5 text-primary" />
                      <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground/80">Processos Judiciais</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoadingJudiciais ? (
                      <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-primary/40" /></div>
                    ) : processosJudiciais && processosJudiciais.length > 0 ? (
                      <div className="divide-y divide-border/20">
                        {processosJudiciais.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between px-6 py-4 hover:bg-primary/5 transition-all group">
                            <div>
                              <p className="text-sm font-black text-foreground group-hover:text-primary transition-colors">{p.numero}</p>
                              {p.situacao && <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{p.situacao}</p>}
                            </div>
                            <Link to="/processos/$id" params={{ id: p.id.toString() }} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all shadow-sm">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 px-6">
                        <p className="text-xs text-muted-foreground font-medium italic">Nenhum processo judicial vinculado.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Administrativos */}
                <Card className="border-border/40 shadow-premium bg-card/50 backdrop-blur-sm overflow-hidden">
                  <CardHeader className="bg-muted/30 border-b border-border/40 py-4">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-4.5 h-4.5 text-emerald-600" />
                      <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground/80">Administrativos</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoadingAdm ? (
                      <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-primary/40" /></div>
                    ) : processosAdministrativos && processosAdministrativos.length > 0 ? (
                      <div className="divide-y divide-border/20">
                        {processosAdministrativos.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between px-6 py-4 hover:bg-emerald-500/5 transition-all group">
                            <div>
                              <p className="text-sm font-black text-foreground group-hover:text-emerald-600 transition-colors">{p.numero || `#${p.id}`}</p>
                              {p.dataCadastro && <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{formatDate(p.dataCadastro)}</p>}
                            </div>
                            <Link to="/processos/admin/$id" params={{ id: p.id.toString() }} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:bg-emerald-600 hover:text-white transition-all shadow-sm">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 px-6">
                        <p className="text-xs text-muted-foreground font-medium italic">Nenhum processo administrativo vinculado.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-8">
           <Card className="border-border/40 shadow-premium bg-card/50 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border/40 py-4">
                <div className="flex items-center gap-2">
                  <Info className="w-4.5 h-4.5 text-primary" />
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground/80">Resumo Pessoal</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                 {cliente.tipo === 'F' ? (
                   <>
                    <DataField icon={Users} label="Nome da Mãe" value={cliente.nomeMae} />
                    <DataField icon={Users} label="Nome do Pai" value={cliente.nomePai} />
                    {cliente.nomeConjuge && <DataField icon={Users} label="Cônjuge" value={cliente.nomeConjuge} />}
                   </>
                 ) : (
                   <DataField icon={Building2} label="Nome Fantasia" value={cliente.fantasia} />
                 )}
                 <Separator className="bg-border/40" />
                 <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Notebook className="w-3.5 h-3.5" />
                      <p className="text-[10px] font-black uppercase tracking-[0.15em]">Observações Internas</p>
                    </div>
                    <p className="text-sm font-medium text-foreground/80 leading-relaxed italic bg-muted/30 p-4 rounded-xl border border-border/40">
                      {cliente.observacoes || 'Nenhuma observação interna registrada para este cliente.'}
                    </p>
                 </div>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}

function DataField({ icon: Icon, label, value, isLowercase }: any) {
  return (
    <div className="space-y-2 group">
      <div className="flex items-center gap-2 text-muted-foreground transition-colors group-hover:text-primary">
        <Icon className="w-3.5 h-3.5" />
        <p className="text-[10px] font-black uppercase tracking-[0.15em]">{label}</p>
      </div>
      <p className={cn(
        "text-sm font-bold text-foreground leading-tight",
        !isLowercase && "uppercase"
      )}>
        {value || '-'}
      </p>
    </div>
  );
}
