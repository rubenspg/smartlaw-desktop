import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, Loader2, Pencil, Plus, Tags, Trash2, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { useAlternarWorkflow, useExcluirWorkflow, useWorkflows } from '@/hooks/use-workflows';
import { useUsuarios } from '@/hooks/use-lookups';
import { useNomeSituacao } from '@/components/shared/situacao-badge';
import { descreverFluxo } from '@/components/fluxos/descrever';
import { SituacoesTab } from '@/components/fluxos/situacoes-tab';
import { HistoricoTab } from '@/components/fluxos/historico-tab';
import { SomenteAdmin } from '@/components/fluxos/somente-admin';

export const Route = createFileRoute('/_dashboard/fluxos/')({
  component: () => (
    <SomenteAdmin>
      <FluxosPage />
    </SomenteAdmin>
  ),
});

type Tab = 'fluxos' | 'situacoes' | 'historico';

const ABAS: { id: Tab; label: string; icon: typeof Workflow }[] = [
  { id: 'fluxos', label: 'FLUXOS', icon: Workflow },
  { id: 'situacoes', label: 'SITUAÇÕES DE CLIENTE', icon: Tags },
  { id: 'historico', label: 'HISTÓRICO', icon: History },
];

function FluxosPage() {
  const navigate = useNavigate();
  const [aba, setAba] = useState<Tab>('fluxos');

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Fluxos de trabalho</h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Automatize o que acontece quando um cliente é cadastrado ou muda de situação.
          </p>
        </div>
        {aba === 'fluxos' && (
          <Button onClick={() => navigate({ to: '/fluxos/novo' })}>
            <Plus className="w-4 h-4 mr-2" /> Novo fluxo
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-xl w-fit border border-border">
        {ABAS.map(({ id, label, icon: Icone }) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={cn(
              'px-6 py-2 rounded-lg text-sm font-bold transition-all',
              aba === id ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icone className="w-4 h-4 mr-2 inline" /> {label}
          </button>
        ))}
      </div>

      {aba === 'fluxos' && <ListaFluxos />}
      {aba === 'situacoes' && <SituacoesTab />}
      {aba === 'historico' && <HistoricoTab />}
    </div>
  );
}

function ListaFluxos() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const { data: fluxos, isLoading } = useWorkflows();
  const { data: usuarios } = useUsuarios();
  const nomeSituacao = useNomeSituacao();
  const alternar = useAlternarWorkflow();
  const excluir = useExcluirWorkflow();
  const nomeUsuario = (id: string | null | undefined) =>
    usuarios?.find((u) => u.id === id)?.nome ?? 'usuário inativo';

  const remover = async (id: number, nome: string) => {
    if (!(await confirm({ description: `Excluir o fluxo "${nome}"? O histórico de execuções é mantido.`, destructive: true, confirmText: 'Excluir' }))) return;
    try {
      await excluir.mutateAsync(id);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (isLoading) {
    return <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />;
  }

  if (!fluxos?.length) {
    return (
      <Card>
        <CardContent className="py-16 flex flex-col items-center text-center gap-4">
          <Workflow className="w-12 h-12 text-muted-foreground/50" />
          <div>
            <p className="font-semibold">Nenhum fluxo ainda</p>
            <p className="text-sm text-muted-foreground max-w-md">
              Ex.: quando um cliente for cadastrado, colocá-lo em revisão e criar para a secretaria a
              tarefa de coletar os documentos.
            </p>
          </div>
          <Button onClick={() => navigate({ to: '/fluxos/novo' })}>
            <Plus className="w-4 h-4 mr-2" /> Criar o primeiro fluxo
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {fluxos.map((f) => (
        <Card key={f.id} className={cn(!f.ativo && 'opacity-60')}>
          <CardContent className="py-5 flex items-start gap-4">
            <Switch
              checked={f.ativo}
              onCheckedChange={(ativo) => alternar.mutate({ id: f.id, ativo })}
              title={f.ativo ? 'Pausar' : 'Ativar'}
              className="mt-1"
            />
            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-bold">{f.nome}</p>
              <p className="text-sm text-muted-foreground">
                {descreverFluxo(f, nomeSituacao, nomeUsuario)}
              </p>
              <p className="text-xs text-muted-foreground">
                {f.execucoes === 0
                  ? 'Ainda não rodou'
                  : `Rodou ${f.execucoes} vez(es) · última em ${format(parseISO(f.ultimaExecucao!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`}
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                title="Editar"
                onClick={() => navigate({ to: '/fluxos/$id', params: { id: f.id.toString() } })}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Excluir" onClick={() => remover(f.id, f.nome)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
