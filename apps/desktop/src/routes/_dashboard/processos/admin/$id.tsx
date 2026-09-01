import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  ClipboardList,
  History,
  Info,
  Building2,
  Hash,
  Briefcase,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useProcessoAdministrativo, useDeleteProcessoAdministrativo, useCreateAndamento, useDeleteAndamento } from '@/hooks/use-processos';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
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
  const createAndamento = useCreateAndamento();
  const deleteAndamento = useDeleteAndamento(procId, 'admin');
  const toast = useToast();
  const confirm = useConfirm();

  const [novoAndamento, setNovoAndamento] = useState('');

  const handleAddAndamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoAndamento.trim()) return;

    try {
      await createAndamento.mutateAsync({
        processoAdminId: procId,
        data: new Date().toISOString(),
        historico: novoAndamento,
        tipo: 'MANUAL',
      });
      setNovoAndamento('');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (await confirm({ description: 'Tem certeza que deseja excluir este processo administrativo?', destructive: true, confirmText: 'Excluir' })) {
      await deleteProcesso.mutateAsync(procId);
      navigate({ to: '/processos' });
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
                <ClipboardList className="w-5 h-5" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                {processo.numero}
              </h1>
            </div>
            <div className="flex items-center gap-2 ml-1">
              <Badge variant="outline" className="bg-emerald-500/5 text-emerald-600 border-emerald-500/20 font-bold px-2.5 py-0.5 rounded-lg text-[10px] uppercase tracking-wider">
                Administrativo
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
              onClick={() => navigate({ to: '/processos/admin/$id/editar', params: { id } })}
            >
              <Edit className="w-4 h-4 mr-2 text-muted-foreground" />
              Editar
            </Button>
            <Button 
              variant="outline" 
              className="rounded-xl font-bold text-xs uppercase tracking-wider h-11 px-5 border-border shadow-sm text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-all active:scale-95"
              onClick={handleDelete}
              disabled={deleteProcesso.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Informações Principais */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-border/40 shadow-premium overflow-hidden bg-card/50 backdrop-blur-sm sticky top-24">
            <CardHeader className="bg-muted/30 border-b border-border/40 py-4">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground/80">Informações</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid gap-6">
                <DataField icon={Hash} label="Número / Referência" value={processo.numero} />
                <DataField icon={Building2} label="Pasta" value={processo.pasta} />
                <Separator className="bg-border/40" />
                <DataField icon={CalendarIcon} label="Data de Abertura" value={processo.abertura ? new Date(processo.abertura).toLocaleDateString('pt-BR') : '-'} />
                <DataField icon={Briefcase} label="Início do Benefício" value={processo.inicioBeneficio ? new Date(processo.inicioBeneficio).toLocaleDateString('pt-BR') : '-'} />
                <Separator className="bg-border/40" />
                <div className="space-y-2 group">
                  <div className="flex items-center gap-2 text-muted-foreground transition-colors group-hover:text-primary">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <p className="text-[10px] font-black uppercase tracking-[0.15em]">Decisão / Status Atual</p>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <p className="text-sm font-bold text-primary leading-tight">
                      {processo.decisao || 'Em andamento'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Histórico de Andamentos */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <h3 className="text-xl font-extrabold tracking-tight text-foreground">Andamentos Administrativos</h3>
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
                    placeholder="Descreva a movimentação do processo administrativo..." 
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
                <p className="text-muted-foreground font-semibold">Nenhuma movimentação registrada.</p>
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
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                          onClick={async () => {
                            if (await confirm({ description: 'Excluir este andamento?', destructive: true, confirmText: 'Excluir' })) {
                              deleteAndamento.mutate(andamento.id);
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <p className="text-sm font-bold text-foreground leading-relaxed">{andamento.historico}</p>
                    </CardContent>
                  </Card>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DataField({ icon: Icon, label, value, isUppercase }: any) {
  return (
    <div className="space-y-2 group">
      <div className="flex items-center gap-2 text-muted-foreground transition-colors group-hover:text-primary">
        <Icon className="w-3.5 h-3.5" />
        <p className="text-[10px] font-black uppercase tracking-[0.15em]">{label}</p>
      </div>
      <p className={cn(
        "text-sm font-bold text-foreground leading-none",
        isUppercase && "uppercase"
      )}>
        {value || '-'}
      </p>
    </div>
  );
}
