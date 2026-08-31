import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { 
  ArrowLeft, 
  RefreshCw, 
  Scale, 
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  Info,
  Phone,
  MessageSquare,
  Plus,
  Edit2,
  Trash2,
  Users,
  Gavel,
  Hash,
  MapPin,
  Building2,
  Briefcase,
  Activity,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useProcessoJudicial, useSyncProcesso, useDeleteProcessoJudicial, useCreateAndamento, useDeleteAndamento } from '@/hooks/use-processos';
import { cn } from '@/lib/utils';
import { openUrl } from '@tauri-apps/plugin-opener';

export const Route = createFileRoute('/_dashboard/processos/$id')({
  component: ProcessoDetailPage,
});

function ProcessoDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const procId = parseInt(id);

  const { data: processo, isLoading, isError } = useProcessoJudicial(procId);
  const syncProcesso = useSyncProcesso();
  const deleteMutation = useDeleteProcessoJudicial();
  const createAndamento = useCreateAndamento();
  const deleteAndamento = useDeleteAndamento(procId, 'judicial');

  const [novoAndamento, setNovoAndamento] = useState('');

  const handleAddAndamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoAndamento.trim()) return;

    try {
      await createAndamento.mutateAsync({
        processoJudicialId: procId,
        data: new Date().toISOString(),
        historico: novoAndamento,
        tipo: 'MANUAL',
      });
      setNovoAndamento('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleWhatsApp = async () => {
    const celular = processo?.cliente?.celular;
    if (!celular) {
      alert('Cliente não possui celular cadastrado');
      return;
    }

    const cleaned = celular.replace(/\D/g, '');
    const number = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
    await openUrl(`https://wa.me/${number}`);
  };

  const handleSync = async () => {
    try {
      await syncProcesso.mutateAsync(procId);
    } catch (err) {
      console.error('Sync failed:', err);
    }
  };

  const handleDelete = async () => {
    if (confirm('Tem certeza que deseja excluir este processo?')) {
      try {
        await deleteMutation.mutateAsync(procId);
        navigate({ to: '/processos' });
      } catch (err) {
        console.error('Delete failed:', err);
      }
    }
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  if (isError || !processo) return <div className="p-12 text-center text-destructive font-bold">Processo não encontrado.</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10 animate-fade-in">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col gap-4">
        <button 
          onClick={() => navigate({ to: '/processos' })}
          className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para Processos
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
                <Gavel className="w-5 h-5" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                {processo.numero}
              </h1>
            </div>
            <div className="flex items-center gap-2 ml-1">
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold px-2.5 py-0.5 rounded-lg text-[10px] uppercase tracking-wider">
                Judicial
              </Badge>
              <div className="h-4 w-[1px] bg-border mx-1" />
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                Cliente: 
                <Link 
                  to="/clientes/$id" 
                  params={{ id: processo.clienteId?.toString() || '' }}
                  className="text-foreground font-bold hover:text-primary transition-colors underline decoration-primary/30 underline-offset-4"
                >
                  {processo.cliente?.nome}
                </Link>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              className="rounded-xl font-bold text-xs uppercase tracking-wider h-11 px-5 border-border shadow-sm hover:bg-accent transition-all active:scale-95"
              onClick={() => navigate({ to: '/processos/$id/editar', params: { id } })}
            >
              <Edit2 className="w-4 h-4 mr-2 text-muted-foreground" />
              Editar
            </Button>
            <Button 
              variant="outline" 
              className="rounded-xl font-bold text-xs uppercase tracking-wider h-11 px-5 border-border shadow-sm text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-all active:scale-95"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </Button>
            <Button 
              className="rounded-xl font-bold text-xs uppercase tracking-wider h-11 px-6 shadow-premium hover:shadow-premium-lg transition-all active:scale-95"
              onClick={handleSync}
              disabled={syncProcesso.isPending}
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", syncProcesso.isPending && "animate-spin")} />
              Sincronizar
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content (Left) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Dados do Processo Card */}
          <Card className="border-border/40 shadow-premium overflow-hidden bg-card/50 backdrop-blur-sm">
            <CardHeader className="bg-muted/30 border-b border-border/40 py-4">
              <div className="flex items-center gap-2">
                <Info className="w-4.5 h-4.5 text-primary" />
                <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground/80">Detalhes do Processo</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                <DataField 
                  icon={Activity} 
                  label="Situação" 
                  value={processo.situacao} 
                  isBadge 
                />
                <DataField 
                  icon={CalendarIcon} 
                  label="Data de Cadastro" 
                  value={processo.dataCadastro ? new Date(processo.dataCadastro).toLocaleDateString('pt-BR') : '-'} 
                />
                <DataField 
                  icon={MapPin} 
                  label="Justiça / Comarca" 
                  value={`${processo.justica || '-'} / ${processo.comarca || '-'}`} 
                  isUppercase
                />
                <DataField 
                  icon={Building2} 
                  label="Juízo / Vara" 
                  value={processo.juizo} 
                  isUppercase
                />
                <DataField 
                  icon={Briefcase} 
                  label="Tipo de Ação" 
                  value={processo.tipoAcaoId} 
                  isUppercase
                />
                <DataField 
                  icon={Scale} 
                  label="Rito" 
                  value={processo.ritoId} 
                  isUppercase
                />
                <DataField 
                  icon={History} 
                  label="Distribuição" 
                  value={processo.distribuicao ? new Date(processo.distribuicao).toLocaleDateString('pt-BR') : '-'} 
                />
                <DataField 
                  icon={Hash} 
                  label="Pasta / Referência" 
                  value={processo.pasta} 
                />
              </div>
            </CardContent>
          </Card>

          {/* Andamentos Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <h3 className="text-xl font-extrabold tracking-tight text-foreground">Histórico de Andamentos</h3>
              </div>
              <Badge variant="outline" className="rounded-lg font-bold text-[10px] px-2 py-0.5 border-border/60">
                {processo.andamentos?.length || 0} Eventos
              </Badge>
            </div>

            {/* Novo Andamento Form */}
            <Card className="border-border/40 shadow-premium bg-card/50 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-6">
                <form onSubmit={handleAddAndamento} className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground ml-1">
                      <Plus className="w-3.5 h-3.5" />
                      <p className="text-[10px] font-black uppercase tracking-[0.15em]">Adicionar Novo Andamento Manual</p>
                    </div>
                    <Textarea 
                      placeholder="Descreva a movimentação do processo..." 
                      value={novoAndamento}
                      onChange={(e) => setNovoAndamento(e.target.value)}
                      className="min-h-[100px] rounded-xl border-border/50 bg-background/50 focus:ring-primary/20 transition-all font-medium"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button 
                      type="submit" 
                      disabled={createAndamento.isPending || !novoAndamento.trim()}
                      className="rounded-xl font-bold px-6 shadow-premium active:scale-95"
                    >
                      {createAndamento.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                      Registrar Movimentação
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-primary/30 before:via-primary/10 before:to-transparent">
              {processo.andamentos?.length === 0 ? (
                <div className="text-center py-16 bg-muted/20 rounded-2xl border-2 border-dashed border-border/40">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <History className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                  <p className="text-muted-foreground font-semibold">Nenhuma movimentação sincronizada ainda.</p>
                  <Button variant="link" onClick={handleSync} className="mt-2 text-primary font-bold">
                    Sincronizar agora
                  </Button>
                </div>
              ) : (
                processo.andamentos?.map((andamento: any) => (
                  <div key={andamento.id} className="relative group">
                    <div className="absolute -left-[23px] top-1.5 w-5 h-5 rounded-full border-4 border-background bg-primary shadow-sm z-10 transition-transform group-hover:scale-125" />
                    
                    <Card className="border-border/40 shadow-sm group-hover:shadow-premium transition-all duration-300 bg-card/60">
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-primary font-bold">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            <span className="text-[11px] uppercase tracking-wider">
                              {new Date(andamento.data).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {andamento.tipo === 'SISTEMA' ? (
                               <Badge variant="destructive" className="text-[8px] font-black px-1.5 py-0 h-4 rounded-md uppercase tracking-widest border-none shadow-sm">Tribunal</Badge>
                            ) : (
                               <Badge variant="outline" className="text-[8px] font-black px-1.5 py-0 h-4 rounded-md uppercase tracking-widest border-primary/20 text-primary">Manual</Badge>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => confirm('Excluir este andamento?') && deleteAndamento.mutate(andamento.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-foreground leading-relaxed">
                          {andamento.historico}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar (Right) */}
        <div className="space-y-8">
          {/* Partes Card */}
          <Card className="border-border/40 shadow-premium bg-card/50 backdrop-blur-sm">
            <CardHeader className="bg-muted/30 border-b border-border/40 py-4">
              <div className="flex items-center gap-2">
                <Users className="w-4.5 h-4.5 text-primary" />
                <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground/80">Partes do Processo</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {processo.partes?.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-xs text-muted-foreground italic">Nenhuma parte identificada pelo tribunal.</p>
                </div>
              ) : (
                processo.partes?.map((parte: any) => (
                  <div key={parte.id} className="p-4 rounded-2xl border border-border/40 bg-background/50 group hover:border-primary/30 transition-all shadow-sm">
                    <p className="text-sm font-black text-foreground uppercase truncate group-hover:text-primary transition-colors">{parte.nome}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="outline" className="text-[9px] font-black bg-primary/5 text-primary border-none uppercase tracking-tighter rounded-md px-1.5 py-0">
                        {parte.posicao?.descricao || 'PARTE'}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Contato com Cliente Card */}
          <Card className="border-border/40 shadow-premium bg-card/50 backdrop-blur-sm relative overflow-hidden group">
            <CardHeader className="bg-muted/30 border-b border-border/40 py-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg font-bold text-foreground tracking-tight">Contato do Cliente</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="bg-accent/30 p-5 rounded-2xl border border-border/40">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Nome Completo</p>
                <p className="text-base font-black text-foreground uppercase">{processo.cliente?.nome}</p>
                <div className="h-px bg-border/40 my-4" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Telefone Principal</p>
                <p className="text-base font-black text-foreground">{processo.cliente?.celular || processo.cliente?.telefone1 || 'Não informado'}</p>
              </div>
              
              <div className="space-y-3">
                <Button 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase py-6 rounded-2xl shadow-lg shadow-emerald-900/10 border-none transition-all active:scale-95"
                  onClick={handleWhatsApp}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Abrir WhatsApp
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full bg-background border-border hover:bg-accent text-foreground font-black text-xs uppercase py-6 rounded-2xl transition-all active:scale-95"
                  asChild
                >
                  <Link to="/clientes/$id" params={{ id: processo.clienteId?.toString() || '' }}>
                    Ver Cadastro Completo
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DataField({ icon: Icon, label, value, isBadge, isUppercase }: any) {
  return (
    <div className="space-y-2 group">
      <div className="flex items-center gap-2 text-muted-foreground transition-colors group-hover:text-primary">
        <Icon className="w-3.5 h-3.5" />
        <p className="text-[10px] font-black uppercase tracking-[0.15em]">{label}</p>
      </div>
      {isBadge ? (
        <Badge variant="outline" className="bg-accent/50 text-foreground font-black border-border/60 px-2.5 py-0.5 uppercase text-[10px] rounded-lg shadow-sm">
          {value || 'NÃO INFORMADA'}
        </Badge>
      ) : (
        <p className={cn(
          "text-sm font-bold text-foreground leading-none",
          isUppercase && "uppercase"
        )}>
          {value || '-'}
        </p>
      )}
    </div>
  );
}
