/**
 * Cálculo puro do "Resumo do dia" da tela inicial: janela, payload do modelo,
 * destaques, avisos, texto calculado e instrução.
 *
 * Mesma regra dos cards de Insights (services/insights/semana.ts): o código
 * calcula todo número e o modelo só narra um payload de agregados (LGPD). O
 * título das tarefas vai para a tela em `itens`, nunca para o modelo. A leitura
 * do banco fica em dados.ts. Testado em dia.test.ts.
 */

import { formatarNumero, REGRAS_NUMEROS, type Narracao } from '../ia/narracao';

/** Horizonte de "próximos dias" para tarefas e prazos de intimação. */
export const DIAS_A_FRENTE = 7;

const DIA_MS = 86_400_000;
const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export const somarDias = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
const diaDaSemana = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const n = (v: number) => formatarNumero(v);
const plural = (v: number, um: string, varios: string) => `${n(v)} ${v === 1 ? um : varios}`;

/** 00:00 de Brasília (UTC-3 fixo desde 2019) como instante UTC. */
export const inicioDoDiaUtc = (iso: string) => new Date(`${iso}T03:00:00Z`);

/**
 * O dia útil anterior a `hoje`: na segunda, a sexta. "Novidades" contam desde
 * ele, para o fim de semana não sumir do resumo de segunda. Feriado não entra:
 * no pior caso a janela fica um dia mais curta que o ideal, e os itens não
 * lidos continuam aparecendo.
 */
export function diaUtilAnterior(hoje: string): string {
  let d = somarDias(hoje, -1);
  while (diaDaSemana(d) === 0 || diaDaSemana(d) === 6) d = somarDias(d, -1);
  return d;
}

export interface Contagem {
  nome: string;
  total: number;
}

export type StatusRodada = 'EXECUTANDO' | 'SUCESSO' | 'GEOBLOQUEADO' | 'ERRO';

export interface DiaDados {
  /** Data de Brasília. */
  hoje: string;
  /** Início da janela de novidades (dia útil anterior). */
  desde: string;
  /** Tarefas pendentes do próprio usuário. */
  tarefas: {
    atrasadas: number;
    hoje: number;
    proximosDias: number;
    semPrazo: number;
    /** Prioridade ALTA entre atrasadas, de hoje e dos próximos dias. */
    prioridadeAlta: number;
    /** Dias de atraso da tarefa mais antiga; null sem atrasadas. */
    maiorAtrasoDias: number | null;
    /** Atrasadas e de hoje, por categoria. */
    porCategoria: Contagem[];
  };
  /** Do escritório; null quando a firma nunca usou o DJEN. */
  intimacoes: {
    naoLidas: number;
    novas: number;
    porTipo: Contagem[];
    /** Prazos que vencem de hoje ao fim do horizonte, com tarefa ainda aberta. */
    prazosProximos: number;
    proximoPrazo: string | null;
    ultimaRodada: StatusRodada | null;
  } | null;
  /** Movimentos do tribunal (Datajud) incluídos desde `desde`, do escritório. */
  andamentos: { tribunal: number; processos: number };
  /** Processos criados por intimação, ainda sem cliente. */
  triagem: number;
}

const ROTULO_CATEGORIA: Record<string, string> = {
  AUDIENCIA: 'Audiência',
  PRAZO: 'Prazo',
  REUNIAO: 'Reunião',
  DILIGENCIA: 'Diligência',
  GERAL: 'Geral',
};
export const rotuloCategoria = (c: string | null) => ROTULO_CATEGORIA[c ?? 'GERAL'] ?? 'Geral';

/**
 * Aviso de que as intimações podem estar incompletas. Rodada bloqueada ou com
 * erro nunca vira "nenhuma intimação nova".
 */
export function avisoIntimacoes(i: NonNullable<DiaDados['intimacoes']>): string | null {
  if (i.ultimaRodada === 'GEOBLOQUEADO') {
    return 'A última consulta ao DJEN foi bloqueada (acesso fora do Brasil): podem faltar intimações.';
  }
  if (i.ultimaRodada === 'ERRO') return 'A última consulta ao DJEN falhou: podem faltar intimações.';
  return null;
}

export function avisosDoDia(d: DiaDados): string[] {
  const aviso = d.intimacoes && avisoIntimacoes(d.intimacoes);
  return aviso ? [aviso] : [];
}

const dataPorExtenso = (iso: string) => `${DIAS_SEMANA[diaDaSemana(iso)]}, ${ddmm(iso)}`;

/** O que vai ao modelo: só contagens e datas, já formatadas. */
export function payloadDia(d: DiaDados) {
  const t = d.tarefas;
  const i = d.intimacoes;
  const aviso = i && avisoIntimacoes(i);
  return {
    hoje: dataPorExtenso(d.hoje),
    novidadesDesde: dataPorExtenso(d.desde),
    suasTarefas: {
      atrasadas: n(t.atrasadas),
      ...(t.maiorAtrasoDias != null && { maiorAtraso: plural(t.maiorAtrasoDias, 'dia', 'dias') }),
      paraHoje: n(t.hoje),
      proximosDias: { criterio: `próximos ${DIAS_A_FRENTE} dias`, total: n(t.proximosDias) },
      semPrazo: n(t.semPrazo),
      dePrioridadeAlta: n(t.prioridadeAlta),
      atrasadasEDeHojePorCategoria: t.porCategoria.map((c) => ({ categoria: rotuloCategoria(c.nome), total: n(c.total) })),
    },
    ...(i && {
      intimacoesDoEscritorio: {
        naoLidas: n(i.naoLidas),
        novas: n(i.novas),
        novasPorTipo: i.porTipo.slice(0, 4).map((p) => ({ tipo: p.nome, total: n(p.total) })),
        prazos: {
          criterio: `vencem nos próximos ${DIAS_A_FRENTE} dias`,
          total: n(i.prazosProximos),
          ...(i.proximoPrazo && { proximoVencimento: ddmm(i.proximoPrazo) }),
        },
        ...(aviso && { aviso }),
      },
    }),
    andamentosDoTribunal: { novos: n(d.andamentos.tribunal), processos: n(d.andamentos.processos) },
    processosEmTriagem: n(d.triagem),
  };
}

export interface Destaque {
  chave: 'atrasadas' | 'hoje' | 'proximos' | 'prazos' | 'intimacoes' | 'andamentos' | 'triagem';
  rotulo: string;
  valor: string;
  /** Pede atenção (vermelho/âmbar na tela). */
  tom: 'urgente' | 'atencao' | 'neutro';
}

export function destaquesDia(d: DiaDados): Destaque[] {
  const t = d.tarefas;
  const i = d.intimacoes;
  return [
    { chave: 'atrasadas', rotulo: 'Tarefas atrasadas', valor: n(t.atrasadas), tom: t.atrasadas > 0 ? 'urgente' : 'neutro' },
    { chave: 'hoje', rotulo: 'Para hoje', valor: n(t.hoje), tom: t.hoje > 0 ? 'atencao' : 'neutro' },
    { chave: 'proximos', rotulo: `Próximos ${DIAS_A_FRENTE} dias`, valor: n(t.proximosDias), tom: 'neutro' },
    ...(i
      ? ([
          { chave: 'prazos', rotulo: 'Prazos de intimação', valor: n(i.prazosProximos), tom: i.prazosProximos > 0 ? 'atencao' : 'neutro' },
          { chave: 'intimacoes', rotulo: 'Intimações não lidas', valor: n(i.naoLidas), tom: i.naoLidas > 0 ? 'atencao' : 'neutro' },
        ] satisfies Destaque[])
      : []),
    { chave: 'andamentos', rotulo: 'Andamentos do tribunal', valor: n(d.andamentos.tribunal), tom: 'neutro' },
    ...(d.triagem > 0 ? ([{ chave: 'triagem', rotulo: 'Processos em triagem', valor: n(d.triagem), tom: 'atencao' }] satisfies Destaque[]) : []),
  ];
}

/** Texto calculado: aparece quando a IA está desligada, falha ou erra um número. */
export function reservaDia(d: DiaDados): Narracao {
  const t = d.tarefas;
  const i = d.intimacoes;
  const partes: string[] = [];

  if (t.atrasadas > 0 || t.hoje > 0) {
    const blocos = [
      t.atrasadas > 0 ? plural(t.atrasadas, 'tarefa atrasada', 'tarefas atrasadas') : null,
      t.hoje > 0 ? `${plural(t.hoje, 'tarefa', 'tarefas')} para hoje` : null,
    ].filter(Boolean);
    partes.push(`Você tem ${blocos.join(' e ')}.`);
  } else {
    partes.push('Você não tem tarefas atrasadas nem com prazo para hoje.');
  }
  if (t.proximosDias > 0) {
    partes.push(`${plural(t.proximosDias, 'tarefa vence', 'tarefas vencem')} nos próximos ${DIAS_A_FRENTE} dias.`);
  }

  if (i) {
    if (i.prazosProximos > 0) {
      partes.push(
        `O escritório tem ${plural(i.prazosProximos, 'prazo de intimação', 'prazos de intimação')} nos próximos ${DIAS_A_FRENTE} dias${i.proximoPrazo ? `, o primeiro em ${ddmm(i.proximoPrazo)}` : ''}.`,
      );
    }
    if (i.naoLidas > 0) partes.push(`Há ${plural(i.naoLidas, 'intimação não lida', 'intimações não lidas')}.`);
    const aviso = avisoIntimacoes(i);
    if (aviso) partes.push(aviso);
  }

  const a = d.andamentos;
  if (a.tribunal > 0) {
    partes.push(
      `Desde ${ddmm(d.desde)}, ${plural(a.tribunal, 'andamento novo do tribunal', 'andamentos novos do tribunal')} em ${plural(a.processos, 'processo', 'processos')}.`,
    );
  }
  if (d.triagem > 0) {
    partes.push(`${plural(d.triagem, 'processo aguarda', 'processos aguardam')} triagem, ainda sem cliente.`);
  }
  return { resumo: partes.join(' '), pontos: [] };
}

export const PERGUNTA_DIA = 'O que o advogado precisa saber hoje?';

export const INSTRUCAO_DIA = `Você escreve o "Resumo do dia" da tela inicial de um sistema de escritório de advocacia brasileiro. Quem lê é o advogado dono das tarefas; fale com ele por "você".

Todo número do JSON já está calculado e formatado em pt-BR. Regras:
${REGRAS_NUMEROS}
- Português do Brasil, direto, sem saudação, sem markdown.
- Você não vê nomes de clientes, números de processo, títulos de tarefa nem textos de intimação: não invente nenhum.
- Ordem de importância: tarefas atrasadas, tarefas para hoje, prazos de intimação próximos, intimações não lidas, andamentos novos do tribunal, processos em triagem. Abra pelo que é mais urgente e deixe de fora o que está zerado, a não ser para dizer que o dia está em ordem.
- "suasTarefas" são só as do leitor; intimações, andamentos e triagem são do escritório inteiro.
- "novas" e "novos" contam desde a data em "novidadesDesde".
- "intimacoesDoEscritorio.aviso" quer dizer que a consulta ao DJEN falhou: cite a lacuna e nunca diga que não houve intimações. Se "intimacoesDoEscritorio" não existir, não fale de intimações.
- "Triagem" são processos criados a partir de intimação, ainda sem cliente vinculado.
- Pode dizer por onde começar, mas só a partir dos dados; sem conselho jurídico, previsões nem causas supostas.
- Um item ausente do JSON não quer dizer zero.

Responda só com JSON:
{
  "resumo": "2 a 3 frases.",
  "pontos": [{ "titulo": "tema curto", "detalhe": "uma frase" }]
}
"pontos" tem de 0 a 3 itens, cada um algo distinto que pede ação hoje; lista vazia quando nada pede.`;
