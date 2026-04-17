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
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useProcessoJudicial, useSyncProcesso } from '@/hooks/use-processos';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_dashboard/processos/$id')({
  component: ProcessoDetailPage,
});

function ProcessoDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const procId = parseInt(id);

  const { data: processo, isLoading, isError } = useProcessoJudicial(procId);
  const syncProcesso = useSyncProcesso();

  const handleSync = async () => {
    try {
      await syncProcesso.mutateAsync(procId);
    } catch (err) {
      console.error('Sync failed:', err);
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
            <h1 className="text-3xl font-bold tracking-tight font-mono">{processo.numero}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{processo.situacao || 'Status Indisponível'}</Badge>
              <Link to="/clientes/$id" params={{ id: processo.clienteId.toString() }} className="text-sm text-primary hover:underline flex items-center gap-1">
                <UserIcon className="w-3 h-3" /> {processo.cliente?.nome}
              </Link>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleSync} 
            disabled={syncProcesso.isPending}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", syncProcesso.isPending && "animate-spin")} />
            Sincronizar Datajud
          </Button>
          <Button variant="outline" onClick={() => navigate({ to: '/processos/$id/editar', params: { id } })}>
            Editar
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
                <p className="text-xs font-bold uppercase text-muted-foreground">Justiça / Tribunal</p>
                <p className="text-sm">{processo.justica || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Comarca / Órgão Julgador</p>
                <p className="text-sm">{processo.orgaoJulgador || processo.comarca || '-'}</p>
              </div>
              <Separator />
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Distribuição</p>
                <p className="text-sm flex items-center gap-2">
                  <CalendarIcon className="w-3 h-3" /> 
                  {processo.distribuicao ? new Date(processo.distribuicao).toLocaleDateString('pt-BR') : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Última Sincronização</p>
                <div className="flex items-center gap-2 text-sm mt-1">
                  {processo.lastSync ? (
                    <>
                      {processo.syncStatus === 'SUCESSO' ? (
                        <Badge variant="success" className="bg-green-500 hover:bg-green-600 px-1 py-0 h-4 text-[10px]">OK</Badge>
                      ) : (
                        <Badge variant="warning" className="bg-amber-500 hover:bg-amber-600 px-1 py-0 h-4 text-[10px]">CONFLITO</Badge>
                      )}
                      {new Date(processo.lastSync).toLocaleString('pt-BR')}
                    </>
                  ) : (
                    <span className="text-muted-foreground italic">Nunca sincronizado</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-dashed">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                Dados do Tribunal (Raw)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Estes dados são importados diretamente do Datajud e servem para conferência de divergências.
              </p>
              <Button variant="link" size="sm" className="px-0 h-auto mt-2 text-xs" asChild>
                <a href={`https://pje.tjsp.jus.br/consultapublica/ConsultaPublica/DetalheProcessoConsultaPublica/listView.seam?ca=${processo.numero}`} target="_blank" rel="noreferrer">
                  Ver no Tribunal <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </Button>
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
                  <p className="text-center text-muted-foreground py-8">Nenhuma movimentação registrada.</p>
                ) : (
                  processo.andamentos?.map((andamento: any) => (
                    <div key={andamento.id} className="relative">
                      <div className={cn(
                        "absolute -left-[1.65rem] top-1.5 w-3 h-3 rounded-full border-2 border-background shadow-sm",
                        andamento.tipo === 'SISTEMA' ? "bg-primary" : "bg-muted-foreground"
                      )} />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(andamento.data).toLocaleDateString('pt-BR')}
                          </span>
                          {andamento.tipo === 'SISTEMA' && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 uppercase tracking-wider">Sistema</Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium leading-relaxed">{andamento.historico}</p>
                        {andamento.documento && (
                          <Button variant="link" size="sm" className="px-0 h-auto text-xs h-6">
                            <FileText className="w-3 h-3 mr-1" /> {andamento.documento}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
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
