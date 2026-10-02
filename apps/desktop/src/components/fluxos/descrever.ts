import type { WorkflowAcao, WorkflowGatilho, WorkflowInput } from '@smartlaw/shared';

export const GATILHO_LABEL: Record<WorkflowGatilho, string> = {
  CLIENTE_CRIADO: 'Cliente cadastrado',
  CLIENTE_SITUACAO_ALTERADA: 'Situação do cliente alterada',
};

export const PRIORIDADE_LABEL = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta' } as const;

export const CATEGORIA_LABEL = {
  GERAL: 'Geral',
  DILIGENCIA: 'Diligência',
  PRAZO: 'Prazo',
  REUNIAO: 'Reunião',
  AUDIENCIA: 'Audiência',
} as const;

type Nomeador = (chave: string | null | undefined) => string;

function descreverAcao(acao: WorkflowAcao, situacao: Nomeador, usuario: Nomeador): string {
  if (acao.tipo === 'ALTERAR_SITUACAO_CLIENTE') {
    return `mudar a situação para ${situacao(acao.situacao)}`;
  }
  const prazo =
    acao.prazoDias == null
      ? ''
      : acao.prazoDias === 0
        ? ', para hoje'
        : `, prazo de ${acao.prazoDias} ${acao.prazoUteis ? 'dia(s) útil(eis)' : 'dia(s) corrido(s)'}`;
  return `criar a tarefa “${acao.titulo || '…'}” para ${usuario(acao.usuarioId)}${prazo}`;
}

/** "Quando um cliente for cadastrado (pessoa física): mudar a situação para…" */
export function descreverFluxo(
  fluxo: Pick<WorkflowInput, 'gatilho' | 'condicoes' | 'acoes'>,
  situacao: Nomeador,
  usuario: Nomeador,
): string {
  const { condicoes } = fluxo;
  let quando =
    fluxo.gatilho === 'CLIENTE_CRIADO'
      ? 'Quando um cliente for cadastrado'
      : 'Quando a situação de um cliente mudar';
  if (fluxo.gatilho === 'CLIENTE_SITUACAO_ALTERADA') {
    if (condicoes.situacaoAnterior) quando += ` de ${situacao(condicoes.situacaoAnterior)}`;
    if (condicoes.situacaoNova) quando += ` para ${situacao(condicoes.situacaoNova)}`;
  }
  if (condicoes.tipoCliente) {
    quando += condicoes.tipoCliente === 'F' ? ' (pessoa física)' : ' (pessoa jurídica)';
  }
  const entao = fluxo.acoes.map((a) => descreverAcao(a, situacao, usuario));
  if (entao.length === 0) return `${quando}: …`;
  return `${quando}: ${entao.join('; ')}.`;
}
