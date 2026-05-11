import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { 
  ArrowLeft, 
  RefreshCw, 
  FileText, 
  User as UserIcon, 
  Scale, 
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Loader2,
  Info,
  Phone,
  MessageSquare,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useProcessoJudicial, useSyncProcesso, useDeleteProcessoJudicial } from '@/hooks/use-processos';
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

  if (isLoading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (isError || !processo) return <div className="p-12 text-center text-destructive">Processo não encontrado.</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      {/* Header section from image */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" className="mt-1" onClick={() => navigate({ to: '/processos' })}>
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[#1e293b]">
              Processo Judicial {processo.numero}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <UserIcon className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500 text-sm font-medium uppercase">Cliente:</span>
              <Link 
                to="/clientes/$id" 
                params={{ id: processo.clienteId?.toString() || '' }}
                className="text-[#2563eb] text-sm font-bold hover:underline uppercase"
              >
                {processo.cliente?.nome}
              </Link>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="font-bold text-xs uppercase tracking-wider h-10 border-slate-200"
            onClick={() => navigate({ to: '/processos/$id/editar', params: { id } })}
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Editar Processo
          </Button>
          <Button 
            variant="outline" 
            className="font-bold text-xs uppercase tracking-wider h-10 border-slate-200 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir
          </Button>
          <Button 
            variant="outline" 
            className="font-bold text-xs uppercase tracking-wider h-10 border-slate-200"
            onClick={handleSync}
            disabled={syncProcesso.isPending}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", syncProcesso.isPending && "animate-spin")} />
            Buscar no Datajud
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content (Left) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Dados Gerais Card */}
          <Card className="border-none shadow-sm shadow-blue-50/50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-[#2563eb]" />
                <CardTitle className="text-lg font-bold text-[#1e293b]">Dados Gerais</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Situação:</p>
                  <Badge variant="secondary" className="bg-[#f1f5f9] text-[#475569] font-bold border-none px-2 uppercase text-[10px]">
                    {processo.situacao || 'NÃO INFORMADA'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data de Cadastro:</p>
                  <p className="text-sm font-bold text-[#1e293b]">
                    {processo.dataCadastro ? new Date(processo.dataCadastro).toLocaleDateString('pt-BR') : '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Justiça / Comarca:</p>
                  <p className="text-sm font-bold text-[#1e293b] uppercase">
                    {processo.justica || '-'} / {processo.comarca || '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Juízo / Vara:</p>
                  <p className="text-sm font-bold text-[#1e293b] uppercase">
                    {processo.juizo || '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo de Ação:</p>
                  <p className="text-sm font-bold text-[#1e293b] uppercase">
                    {processo.tipoAcaoId || '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rito:</p>
                  <p className="text-sm font-bold text-[#1e293b] uppercase">
                    {processo.ritoId || '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Distribuição:</p>
                  <p className="text-sm font-bold text-[#1e293b]">
                    {processo.distribuicao ? new Date(processo.distribuicao).toLocaleDateString('pt-BR') : '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pasta:</p>
                  <p className="text-sm font-bold text-[#1e293b]">
                    {processo.pasta || '-'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Andamentos Section */}
          <div className="space-y-8">
            <div className="flex items-center gap-2 border-b pb-4">
              <Clock className="w-5 h-5 text-[#2563eb]" />
              <h3 className="text-sm font-black uppercase tracking-widest text-[#2563eb]">Andamentos</h3>
            </div>

            {/* Timeline */}
            <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#f1f5f9]">
              {processo.andamentos?.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-slate-100">
                  <p className="text-slate-400 font-medium">Nenhuma movimentação registrada.</p>
                </div>
              ) : (
                processo.andamentos?.map((andamento: any) => (
                  <div key={andamento.id} className="relative">
                    {/* Timeline Dot */}
                    <div className="absolute -left-[2.35rem] top-1.5 w-3 h-3 rounded-full border-2 border-white bg-[#2563eb] shadow-sm z-10" />
                    
                    <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-6 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-slate-400">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            <span className="text-xs font-bold tracking-tight">
                              {new Date(andamento.data).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-sm font-bold text-[#334155] leading-relaxed">
                          {andamento.historico}
                        </p>
                        {andamento.tipo === 'SISTEMA' && (
                           <Badge variant="secondary" className="bg-slate-100 text-slate-400 font-black px-1.5 py-0 h-4 text-[9px] border-none uppercase tracking-tighter">L</Badge>
                        )}
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
          <Card className="border-none shadow-sm shadow-blue-50/50">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#2563eb]" />
                <CardTitle className="text-lg font-bold text-[#1e293b]">Partes</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {processo.partes?.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhuma parte cadastrada.</p>
              ) : (
                processo.partes?.map((parte: any) => (
                  <div key={parte.id} className="p-4 rounded-xl border border-slate-100 bg-white">
                    <p className="text-sm font-black text-[#1e293b] uppercase truncate">{parte.nome}</p>
                    <p className="text-[10px] font-bold text-[#2563eb] uppercase mt-1 tracking-wider">
                      {parte.posicao?.descricao || 'PARTE'}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Contato com Cliente Card */}
          <Card className="border-none shadow-sm bg-[#eff6ff]">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#2563eb]" />
                <CardTitle className="text-lg font-bold text-[#1e293b]">Contato com Cliente</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-sm font-black text-[#1e293b] uppercase">{processo.cliente?.nome}</p>
                <p className="text-xs font-medium text-slate-500 mt-1">{processo.cliente?.celular || processo.cliente?.telefone1 || 'Sem telefone cadastrado'}</p>
              </div>
              
              <div className="space-y-3">
                <Button 
                  className="w-full bg-[#16a34a] hover:bg-[#15803d] font-bold text-xs uppercase py-6 shadow-sm shadow-green-100"
                  onClick={handleWhatsApp}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  WhatsApp
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full bg-white border-none font-bold text-xs uppercase py-6 shadow-sm hover:bg-slate-50"
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

