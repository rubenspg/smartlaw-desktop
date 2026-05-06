import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  RefreshCw,
  MoreHorizontal,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Gavel,
  ClipboardList,
  MessageSquare,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProcessosJudiciais, useProcessosAdministrativos, useSyncProcesso } from '@/hooks/use-processos';
import { cn } from '@/lib/utils';
import { openUrl } from '@tauri-apps/plugin-opener';

export const Route = createFileRoute('/_dashboard/processos/')({
  component: ProcessosListPage,
});

function ProcessosListPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'judiciais' | 'administrativos'>('judiciais');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data: judiciais, isLoading: loadingJud, isError: errorJud } = useProcessosJudiciais({ q, page, limit });
  const { data: administrativos, isLoading: loadingAdm, isError: errorAdm } = useProcessosAdministrativos({ q, page, limit });
  const syncProcesso = useSyncProcesso();

  const handleWhatsApp = async (cliente: any) => {
    const numberToUse = cliente.celular || cliente.telefone1 || cliente.telefone2;
    if (!numberToUse) return;
    const cleaned = numberToUse.replace(/\D/g, '');
    const number = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
    await openUrl(`https://wa.me/${number}`);
  };

  const handleSync = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await syncProcesso.mutateAsync(id);
    } catch (err: any) {
      console.error('Sync failed:', err);
      alert(err.message || 'Falha na sincronização.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Processos</h1>
          <p className="text-foreground/80 font-medium">
            Acompanhe processos judiciais e administrativos.
          </p>
        </div>
        <Button onClick={() => navigate({ to: '/processos/novo' })}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Processo
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número ou cliente..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-fit">
          <TabsList>
            <TabsTrigger value="judiciais" className="flex items-center gap-2">
              <Gavel className="w-4 h-4" />
              Judiciais
            </TabsTrigger>
            <TabsTrigger value="administrativos" className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Administrativos
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="overflow-hidden">
        {activeTab === 'judiciais' ? (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Número do Processo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Última Sinc.</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingJud ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin mr-2" />
                      Carregando judiciais...
                    </div>
                  </TableCell>
                </TableRow>
              ) : judiciais?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Nenhum processo judicial encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                judiciais?.map((proc: any) => (
                  <TableRow 
                    key={proc.id} 
                    className="cursor-pointer"
                    onClick={() => navigate({ to: '/processos/$id', params: { id: proc.id.toString() } })}
                  >
                    <TableCell className="font-mono font-medium">{proc.numero}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <span className="cursor-pointer hover:text-primary transition-colors font-medium">
                              {proc.cliente?.nome || '-'}
                            </span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => navigate({ to: '/clientes/$id', params: { id: proc.clienteId.toString() } })}>
                              <Users className="w-4 h-4 mr-2" /> Ver Detalhes
                            </DropdownMenuItem>
                            {(proc.cliente?.celular || proc.cliente?.telefone1 || proc.cliente?.telefone2) && (
                              <DropdownMenuItem onClick={() => handleWhatsApp(proc.cliente)}>
                                <MessageSquare className="w-4 h-4 mr-2 text-green-600" /> WhatsApp
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {(proc.cliente?.celular || proc.cliente?.telefone1 || proc.cliente?.telefone2) && (
                          <button 
                            onClick={() => handleWhatsApp(proc.cliente)}
                            className="text-green-600 hover:text-green-700 transition-colors"
                            title="WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{proc.situacao || 'N/A'}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs">
                        {proc.lastSync ? (
                          <>
                            {proc.syncStatus === 'SUCESSO' ? (
                              <CheckCircle2 className="w-3 h-3 text-green-500" />
                            ) : (
                              <AlertCircle className="w-3 h-3 text-amber-500" />
                            )}
                            {new Date(proc.lastSync).toLocaleString('pt-BR')}
                          </>
                        ) : (
                          <span className="text-muted-foreground italic text-[10px]">Nunca sincronizado</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={(e) => handleSync(e, proc.id)}
                          disabled={syncProcesso.isPending && syncProcesso.variables === proc.id}
                        >
                          <RefreshCw className={cn("w-4 h-4", syncProcesso.isPending && syncProcesso.variables === proc.id && "animate-spin")} />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate({ to: '/processos/$id', params: { id: proc.id.toString() } })}>Ver Detalhes</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Número / Pasta</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Data Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingAdm ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin mr-2" />
                      Carregando administrativos...
                    </div>
                  </TableCell>
                </TableRow>
              ) : administrativos?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Nenhum processo administrativo encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                administrativos?.map((proc: any) => (
                  <TableRow 
                    key={proc.id} 
                    className="cursor-pointer"
                    onClick={() => navigate({ to: '/processos/admin/$id', params: { id: proc.id.toString() } })}
                  >
                    <TableCell className="font-medium">{proc.numero}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <span className="cursor-pointer hover:text-primary transition-colors font-medium">
                              {proc.cliente?.nome || '-'}
                            </span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => navigate({ to: '/clientes/$id', params: { id: proc.clienteId.toString() } })}>
                              <Users className="w-4 h-4 mr-2" /> Ver Detalhes
                            </DropdownMenuItem>
                            {(proc.cliente?.celular || proc.cliente?.telefone1 || proc.cliente?.telefone2) && (
                              <DropdownMenuItem onClick={() => handleWhatsApp(proc.cliente)}>
                                <MessageSquare className="w-4 h-4 mr-2 text-green-600" /> WhatsApp
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {(proc.cliente?.celular || proc.cliente?.telefone1 || proc.cliente?.telefone2) && (
                          <button 
                            onClick={() => handleWhatsApp(proc.cliente)}
                            className="text-green-600 hover:text-green-700 transition-colors"
                            title="WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {proc.dataCadastro ? new Date(proc.dataCadastro).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate({ to: '/processos/admin/$id', params: { id: proc.id.toString() } })}>Ver Detalhes</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate({ to: '/processos/admin/$id/editar', params: { id: proc.id.toString() } })}>Editar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
