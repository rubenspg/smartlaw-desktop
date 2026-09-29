import { useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  Loader2,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import {
  workflowSchema,
  WORKFLOW_GATILHOS,
  type WorkflowAcao,
  type WorkflowGatilho,
  type WorkflowInput,
} from '@smartlaw/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClienteSituacoes } from '@/hooks/use-cliente-situacoes';
import { useUsuarios } from '@/hooks/use-lookups';
import {
  CATEGORIA_LABEL,
  GATILHO_LABEL,
  PRIORIDADE_LABEL,
  descreverFluxo,
} from './descrever';

// O Select do Radix não aceita valor vazio: "qualquer" é a ausência da condição.
const QUALQUER = '__qualquer';
const SEM_PRAZO = '__sem_prazo';

const PERFIL_LABEL: Record<string, string> = {
  admin: 'Administrador',
  administrativo: 'Administrativo',
  secretaria: 'Secretaria',
  usuario: 'Usuário',
};

const VAZIO: WorkflowInput = {
  nome: '',
  descricao: '',
  ativo: true,
  gatilho: 'CLIENTE_CRIADO',
  condicoes: {},
  acoes: [],
};

const novaTarefa = (): WorkflowAcao => ({
  tipo: 'CRIAR_TAREFA',
  titulo: '',
  descricao: '',
  usuarioId: '',
  prazoDias: 3,
  prazoUteis: true,
  prioridade: 'MEDIA',
  categoria: 'GERAL',
});

/** O exemplo que motivou a funcionalidade; só falta escolher a pessoa. */
const MODELO_COLETA: WorkflowInput = {
  nome: 'Novo cliente → coleta de documentos',
  descricao: 'Todo cliente novo entra em revisão e a secretaria recebe a tarefa de reunir os documentos.',
  ativo: true,
  gatilho: 'CLIENTE_CRIADO',
  condicoes: {},
  acoes: [
    { tipo: 'ALTERAR_SITUACAO_CLIENTE', situacao: 'EM_REVISAO' },
    {
      ...(novaTarefa() as Extract<WorkflowAcao, { tipo: 'CRIAR_TAREFA' }>),
      titulo: 'Coletar documentos de {{cliente.nome}}',
      descricao: 'Reunir RG, CPF, comprovante de residência e a procuração assinada.',
      prioridade: 'ALTA',
      categoria: 'DILIGENCIA',
    },
  ],
};

interface WorkflowFormProps {
  initialData?: WorkflowInput;
  onSubmit: (data: WorkflowInput) => Promise<void>;
  isSubmitting: boolean;
}

export function WorkflowForm({ initialData, onSubmit, isSubmitting }: WorkflowFormProps) {
  const router = useRouter();
  const { data: situacoes } = useClienteSituacoes();
  const { data: usuarios } = useUsuarios();
  const [fluxo, setFluxo] = useState<WorkflowInput>(initialData ?? VAZIO);
  const [erros, setErros] = useState<string[]>([]);

  const nomeSituacao = (codigo: string | null | undefined) =>
    situacoes?.find((s) => s.codigo === codigo)?.nome ?? codigo ?? '…';
  const nomeUsuario = (id: string | null | undefined) =>
    usuarios?.find((u) => u.id === id)?.nome ?? '…';

  const alterar = (parcial: Partial<WorkflowInput>) => setFluxo((f) => ({ ...f, ...parcial }));
  const alterarCondicao = (campo: keyof WorkflowInput['condicoes'], valor: string) =>
    setFluxo((f) => ({
      ...f,
      condicoes: { ...f.condicoes, [campo]: valor === QUALQUER ? undefined : valor },
    }));
  const alterarAcao = (i: number, acao: WorkflowAcao) =>
    setFluxo((f) => ({ ...f, acoes: f.acoes.map((a, j) => (j === i ? acao : a)) }));
  const moverAcao = (i: number, delta: number) =>
    setFluxo((f) => {
      const acoes = [...f.acoes];
      const [a] = acoes.splice(i, 1);
      acoes.splice(i + delta, 0, a);
      return { ...f, acoes };
    });
  const removerAcao = (i: number) =>
    setFluxo((f) => ({ ...f, acoes: f.acoes.filter((_, j) => j !== i) }));

  const trocarGatilho = (gatilho: WorkflowGatilho) =>
    // As condições de situação só existem no gatilho de situação alterada.
    setFluxo((f) => ({
      ...f,
      gatilho,
      condicoes:
        gatilho === 'CLIENTE_SITUACAO_ALTERADA' ? f.condicoes : { tipoCliente: f.condicoes.tipoCliente },
    }));

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = workflowSchema.safeParse(fluxo);
    if (!r.success) {
      setErros([...new Set(r.error.issues.map((i) => i.message))]);
      return;
    }
    setErros([]);
    await onSubmit(r.data);
  };

  return (
    <form onSubmit={salvar} className="space-y-6">
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6 flex gap-3 items-start">
          <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed">{descreverFluxo(fluxo, nomeSituacao, nomeUsuario)}</p>
        </CardContent>
      </Card>

      {!initialData && fluxo.acoes.length === 0 && (
        <Button type="button" variant="outline" onClick={() => setFluxo(MODELO_COLETA)}>
          <ClipboardList className="w-4 h-4 mr-2" /> Começar do modelo “Novo cliente → coleta de documentos”
        </Button>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Identificação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do fluxo</Label>
              <Input
                id="nome"
                value={fluxo.nome}
                onChange={(e) => alterar({ nome: e.target.value })}
                placeholder="Ex: Novo cliente → coleta de documentos"
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch id="ativo" checked={fluxo.ativo} onCheckedChange={(ativo) => alterar({ ativo })} />
              <Label htmlFor="ativo">{fluxo.ativo ? 'Ativo' : 'Pausado'}</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Textarea
              id="descricao"
              rows={2}
              value={fluxo.descricao ?? ''}
              onChange={(e) => alterar({ descricao: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" /> Quando
          </CardTitle>
          <CardDescription>O evento que inicia o fluxo e, se quiser, as condições para ele rodar.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Gatilho</Label>
            <Select value={fluxo.gatilho} onValueChange={(v) => trocarGatilho(v as WorkflowGatilho)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORKFLOW_GATILHOS.map((g) => (
                  <SelectItem key={g} value={g}>{GATILHO_LABEL[g]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo de cliente</Label>
            <Select
              value={fluxo.condicoes.tipoCliente ?? QUALQUER}
              onValueChange={(v) => alterarCondicao('tipoCliente', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={QUALQUER}>Qualquer</SelectItem>
                <SelectItem value="F">Pessoa física</SelectItem>
                <SelectItem value="J">Pessoa jurídica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {fluxo.gatilho === 'CLIENTE_SITUACAO_ALTERADA' &&
            (['situacaoAnterior', 'situacaoNova'] as const).map((campo) => (
              <div key={campo} className="space-y-2">
                <Label>{campo === 'situacaoAnterior' ? 'Saindo de' : 'Indo para'}</Label>
                <Select
                  value={fluxo.condicoes[campo] ?? QUALQUER}
                  onValueChange={(v) => alterarCondicao(campo, v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={QUALQUER}>Qualquer situação</SelectItem>
                    {situacoes?.map((s) => (
                      <SelectItem key={s.codigo} value={s.codigo}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" /> Então
          </CardTitle>
          <CardDescription>As ações rodam na ordem abaixo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fluxo.acoes.map((acao, i) => (
            <div key={i} className="rounded-xl border bg-muted/20 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">
                  {i + 1}. {acao.tipo === 'ALTERAR_SITUACAO_CLIENTE' ? 'Mudar a situação do cliente' : 'Criar tarefa'}
                </span>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => moverAcao(i, -1)} title="Subir">
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" disabled={i === fluxo.acoes.length - 1} onClick={() => moverAcao(i, 1)} title="Descer">
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removerAcao(i)} title="Remover">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {acao.tipo === 'ALTERAR_SITUACAO_CLIENTE' ? (
                <div className="space-y-2 max-w-sm">
                  <Label>Nova situação</Label>
                  <Select value={acao.situacao || undefined} onValueChange={(situacao) => alterarAcao(i, { ...acao, situacao })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha a situação" />
                    </SelectTrigger>
                    <SelectContent>
                      {situacoes?.map((s) => (
                        <SelectItem key={s.codigo} value={s.codigo}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Título</Label>
                    <Input
                      value={acao.titulo}
                      onChange={(e) => alterarAcao(i, { ...acao, titulo: e.target.value })}
                      placeholder="Ex: Coletar documentos de {{cliente.nome}}"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use {'{{cliente.nome}}'} para o nome do cliente e {'{{usuario.nome}}'} para quem fez o cadastro.
                    </p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Descrição (opcional)</Label>
                    <Textarea
                      rows={2}
                      value={acao.descricao ?? ''}
                      onChange={(e) => alterarAcao(i, { ...acao, descricao: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Responsável</Label>
                    <Select value={acao.usuarioId || undefined} onValueChange={(usuarioId) => alterarAcao(i, { ...acao, usuarioId })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha a pessoa" />
                      </SelectTrigger>
                      <SelectContent>
                        {usuarios?.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.nome}
                            {u.perfil ? ` — ${PERFIL_LABEL[u.perfil] ?? u.perfil}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Prazo</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={365}
                        className="w-24"
                        disabled={acao.prazoDias == null}
                        value={acao.prazoDias ?? ''}
                        onChange={(e) =>
                          alterarAcao(i, { ...acao, prazoDias: e.target.value === '' ? 0 : Number(e.target.value) })
                        }
                      />
                      <Select
                        value={acao.prazoDias == null ? SEM_PRAZO : acao.prazoUteis ? 'uteis' : 'corridos'}
                        onValueChange={(v) =>
                          alterarAcao(i, {
                            ...acao,
                            prazoDias: v === SEM_PRAZO ? null : (acao.prazoDias ?? 3),
                            prazoUteis: v !== 'corridos',
                          })
                        }
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="uteis">dias úteis</SelectItem>
                          <SelectItem value="corridos">dias corridos</SelectItem>
                          <SelectItem value={SEM_PRAZO}>sem prazo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Prioridade</Label>
                    <Select
                      value={acao.prioridade}
                      onValueChange={(v) => alterarAcao(i, { ...acao, prioridade: v as typeof acao.prioridade })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PRIORIDADE_LABEL).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select
                      value={acao.categoria}
                      onValueChange={(v) => alterarAcao(i, { ...acao, categoria: v as typeof acao.categoria })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORIA_LABEL).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => alterar({ acoes: [...fluxo.acoes, { tipo: 'ALTERAR_SITUACAO_CLIENTE', situacao: '' }] })}
            >
              <RefreshCcw className="w-4 h-4 mr-2" /> Mudar situação
            </Button>
            <Button type="button" variant="outline" onClick={() => alterar({ acoes: [...fluxo.acoes, novaTarefa()] })}>
              <Plus className="w-4 h-4 mr-2" /> Criar tarefa
            </Button>
          </div>
        </CardContent>
      </Card>

      {erros.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive space-y-1">
          {erros.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.history.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Salvar fluxo
        </Button>
      </div>
    </form>
  );
}
