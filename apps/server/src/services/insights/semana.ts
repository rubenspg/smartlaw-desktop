/**
 * Cálculo puro dos cards semanais de Insights: janela da semana, payload do
 * modelo, "Em resumo", texto calculado e instrução.
 *
 * O código calcula todo número; o modelo só narra o payload, que leva strings
 * já formatadas e somente agregados (LGPD): nada de nome, CPF/CNPJ, número
 * CNJ, partes, texto de intimação ou andamento, nem advogado/OAB. A leitura do
 * banco fica em dados.ts. Testado em semana.test.ts.
 */

import type { DatajudProcessData } from '@smartlaw/shared';
import { classificarSituacao, type EstagioProcesso } from '../datajud/normalizar';
import { formatarNumero, formatarPct, REGRAS_NUMEROS, type Narracao } from '../ia/narracao';

export const SEMANAS_MEDIA = 4;
export const DIAS_PARADO = 90;

// ── Janela ──────────────────────────────────────────────────────────────────

export interface JanelaSemana {
  /** Datas de Brasília, inclusivas. */
  inicio: string;
  fim: string;
  /** "14/10 a 20/10" */
  rotulo: string;
}

const DIA_MS = 86_400_000;
const somarDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Os 7 dias até `hoje` (data de Brasília), recuados `semanasAtras` semanas. */
export function janelaSemana(semanasAtras: number, hoje: string): JanelaSemana {
  const fim = somarDias(hoje, -7 * semanasAtras);
  const inicio = somarDias(fim, -6);
  return { inicio, fim, rotulo: `${ddmm(inicio)} a ${ddmm(fim)}` };
}

/** As 4 semanas anteriores, base da média. */
export function janelaBase(j: JanelaSemana): { inicio: string; fim: string } {
  return { inicio: somarDias(j.inicio, -7 * SEMANAS_MEDIA), fim: somarDias(j.inicio, -1) };
}

/**
 * Instantes UTC de uma faixa de datas de Brasília, `ate` exclusivo. Brasília
 * é UTC-3 fixo desde 2019 (mesma conta de `hojeBrasil`).
 */
export function limitesUtc(inicio: string, fim: string): { de: Date; ate: Date } {
  return { de: new Date(`${inicio}T03:00:00Z`), ate: new Date(`${somarDias(fim, 1)}T03:00:00Z`) };
}

function diasUteis(inicio: string, fim: string): string[] {
  const dias: string[] = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) {
    const semana = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (semana !== 0 && semana !== 6) dias.push(d);
  }
  return dias;
}

/**
 * Dias úteis da semana que nenhuma rodada do DJEN concluída cobriu. Feriado
 * conta como útil: a lacuna sai maior, nunca escondida.
 */
export function diasSemConsulta(j: JanelaSemana, rodadasOk: { janelaInicio: string | null; janelaFim: string | null }[]) {
  const uteis = diasUteis(j.inicio, j.fim);
  const faltando = uteis.filter(
    (d) => !rodadasOk.some((r) => r.janelaInicio && r.janelaFim && r.janelaInicio <= d && d <= r.janelaFim),
  );
  return { uteis: uteis.length, faltando: faltando.length };
}

// ── Processos ───────────────────────────────────────────────────────────────

export interface Contagem {
  nome: string;
  total: number;
}

export interface SemanaProcessos {
  janela: JanelaSemana;
  /** null quando a firma nunca consultou o DJEN: aí não há o que dizer de intimações. */
  intimacoes: null | {
    total: number;
    mediaAnterior: number;
    porTipo: Contagem[];
    diasUteis: number;
    diasSemConsulta: number;
    geobloqueios: number;
    erros: number;
  };
  andamentos: { tribunal: number; manuais: number; mediaAnterior: number; processos: number };
  novos: { judiciais: number; administrativos: number; emTriagem: number };
  mudancasEstagio: { de: EstagioProcesso; para: EstagioProcesso; total: number }[];
  /** Só na semana atual: é a foto de hoje, não da semana. */
  hoje: null | {
    triagem: number;
    revisar: number;
    parados: number;
    paradosPorComarca: Contagem[];
    paradosPorTipoAcao: Contagem[];
  };
}

export const ROTULO_ESTAGIO: Record<EstagioProcesso, string> = {
  ATIVO: 'Ativo',
  SENTENCIADO: 'Sentenciado',
  TRANSITADO: 'Transitado em julgado',
  EM_CUMPRIMENTO: 'Em cumprimento',
  SUSPENSO: 'Suspenso',
  ARQUIVADO: 'Arquivado',
  REVISAR: 'Revisar',
};

type Instancia = { _source: DatajudProcessData };

/** As instâncias com só os movimentos anteriores a `ate`. */
function ate(instancias: Instancia[], limite: Date): Instancia[] {
  return instancias.map((h) => ({
    _source: {
      ...h._source,
      movimentos: (h._source.movimentos ?? []).filter((m) => new Date(m.dataHora).getTime() < limite.getTime()),
    },
  }));
}

/**
 * Mudanças de estágio na semana, pela mesma `classificarSituacao` da busca:
 * o estágio com os movimentos de antes da semana contra o de depois. Só
 * processos com movimento do Datajud na semana podem ter mudado.
 */
export function mudancasDeEstagio(processos: Instancia[][], de: Date, limite: Date): SemanaProcessos['mudancasEstagio'] {
  const contagem = new Map<string, { de: EstagioProcesso; para: EstagioProcesso; total: number }>();
  for (const instancias of processos) {
    const antes = classificarSituacao(ate(instancias, de)).estagio;
    const depois = classificarSituacao(ate(instancias, limite)).estagio;
    if (antes === depois) continue;
    const chave = `${antes}>${depois}`;
    const atual = contagem.get(chave) ?? { de: antes, para: depois, total: 0 };
    atual.total += 1;
    contagem.set(chave, atual);
  }
  return [...contagem.values()].sort((a, b) => b.total - a.total);
}

const n = (v: number) => formatarNumero(v);
const media = (v: number) => formatarNumero(v, Number.isInteger(v) ? 0 : 1);
const variacao = (atual: number, base: number) => (base > 0 ? formatarPct(((atual - base) / base) * 100) : null);
const plural = (v: number, um: string, varios: string) => `${n(v)} ${v === 1 ? um : varios}`;

/** Aviso da lacuna do DJEN; null quando a semana foi toda consultada. */
export function avisoDjen(i: NonNullable<SemanaProcessos['intimacoes']>): string | null {
  if (i.diasSemConsulta === 0) return null;
  const bloqueio = i.geobloqueios > 0 ? `, com ${plural(i.geobloqueios, 'bloqueio geográfico', 'bloqueios geográficos')}` : '';
  if (i.diasSemConsulta === i.diasUteis) {
    return `O DJEN não foi consultado com sucesso nesta semana${bloqueio}: o número de intimações está incompleto.`;
  }
  return `Em ${n(i.diasSemConsulta)} de ${n(i.diasUteis)} dias úteis o DJEN não foi consultado com sucesso${bloqueio}: podem faltar intimações.`;
}

const totalMudancas = (s: SemanaProcessos) => s.mudancasEstagio.reduce((t, m) => t + m.total, 0);

export function payloadProcessos(s: SemanaProcessos) {
  const a = s.andamentos;
  const totalAndamentos = a.tribunal + a.manuais;
  const i = s.intimacoes;
  const aviso = i && avisoDjen(i);
  return {
    semana: `${s.janela.rotulo} (7 dias)`,
    mediaCalculadaSobre: `as ${SEMANAS_MEDIA} semanas anteriores`,
    ...(i && {
      intimacoes: {
        recebidas: n(i.total),
        mediaSemanal: media(i.mediaAnterior),
        ...(variacao(i.total, i.mediaAnterior) && { variacao: variacao(i.total, i.mediaAnterior) }),
        porTipo: i.porTipo.slice(0, 4).map((t) => ({ tipo: t.nome, total: n(t.total) })),
        ...(aviso && { aviso }),
      },
    }),
    andamentos: {
      total: n(totalAndamentos),
      doTribunal: n(a.tribunal),
      manuais: n(a.manuais),
      processosComAndamento: n(a.processos),
      mediaSemanal: media(a.mediaAnterior),
      ...(variacao(totalAndamentos, a.mediaAnterior) && { variacao: variacao(totalAndamentos, a.mediaAnterior) }),
    },
    processosNovos: {
      judiciais: n(s.novos.judiciais),
      administrativos: n(s.novos.administrativos),
      emTriagem: n(s.novos.emTriagem),
    },
    mudancasDeEstagio: s.mudancasEstagio.slice(0, 5).map((m) => ({
      de: ROTULO_ESTAGIO[m.de],
      para: ROTULO_ESTAGIO[m.para],
      processos: n(m.total),
    })),
    ...(s.hoje && {
      posicaoDeHoje: {
        emTriagem: n(s.hoje.triagem),
        paraRevisar: n(s.hoje.revisar),
        semMovimento: { criterio: `mais de ${DIAS_PARADO} dias`, processos: n(s.hoje.parados) },
        paradosPorComarca: s.hoje.paradosPorComarca.slice(0, 3).map((c) => ({ comarca: c.nome, processos: n(c.total) })),
        paradosPorTipoDeAcao: s.hoje.paradosPorTipoAcao.slice(0, 3).map((c) => ({ tipo: c.nome, processos: n(c.total) })),
      },
    }),
  };
}

export function destaquesProcessos(s: SemanaProcessos) {
  const a = s.andamentos;
  return [
    ...(s.intimacoes
      ? [{ rotulo: 'Intimações', valor: n(s.intimacoes.total), detalhe: `média ${media(s.intimacoes.mediaAnterior)}`, incompleto: s.intimacoes.diasSemConsulta > 0 }]
      : []),
    { rotulo: 'Andamentos', valor: n(a.tribunal + a.manuais), detalhe: `média ${media(a.mediaAnterior)}`, incompleto: false },
    { rotulo: 'Mudanças de estágio', valor: n(totalMudancas(s)), detalhe: null, incompleto: false },
    { rotulo: 'Processos novos', valor: n(s.novos.judiciais + s.novos.administrativos), detalhe: s.novos.emTriagem ? `${n(s.novos.emTriagem)} em triagem` : null, incompleto: false },
  ];
}

export function resumoProcessos(s: SemanaProcessos): string[] {
  const out: string[] = [];
  const i = s.intimacoes;
  if (i) {
    const aviso = avisoDjen(i);
    out.push(`${plural(i.total, 'intimação recebida', 'intimações recebidas')} (média ${media(i.mediaAnterior)})${aviso ? ', consulta incompleta' : ''}`);
  }
  const a = s.andamentos;
  out.push(`${plural(a.tribunal + a.manuais, 'andamento', 'andamentos')}: ${n(a.tribunal)} do tribunal e ${n(a.manuais)} manuais, em ${plural(a.processos, 'processo', 'processos')}`);
  const mudancas = totalMudancas(s);
  const arquivados = s.mudancasEstagio.filter((m) => m.para === 'ARQUIVADO').reduce((t, m) => t + m.total, 0);
  if (mudancas > 0) {
    out.push(`${plural(mudancas, 'processo mudou', 'processos mudaram')} de estágio${arquivados ? `, ${n(arquivados)} para Arquivado` : ''}`);
  }
  if (s.novos.emTriagem > 0) out.push(`${plural(s.novos.emTriagem, 'processo novo', 'processos novos')} em triagem, sem cliente`);
  if (s.hoje) {
    if (s.hoje.revisar > 0) out.push(`${plural(s.hoje.revisar, 'processo', 'processos')} para revisar hoje`);
    if (s.hoje.parados > 0) {
      const topo = s.hoje.paradosPorComarca[0];
      out.push(
        `${plural(s.hoje.parados, 'processo', 'processos')} sem movimento há mais de ${DIAS_PARADO} dias${topo ? `, mais em ${topo.nome} (${n(topo.total)})` : ''}`,
      );
    }
  }
  return out;
}

export function reservaProcessos(s: SemanaProcessos): Narracao {
  const a = s.andamentos;
  const total = a.tribunal + a.manuais;
  const partes: string[] = [];
  const i = s.intimacoes;
  if (i) {
    const aviso = avisoDjen(i);
    partes.push(
      `Na semana de ${s.janela.rotulo} chegaram ${plural(i.total, 'intimação', 'intimações')}, contra a média de ${media(i.mediaAnterior)}.${aviso ? ` ${aviso}` : ''}`,
    );
  }
  partes.push(
    `${i ? 'Foram' : `Na semana de ${s.janela.rotulo} foram`} registrados ${plural(total, 'andamento', 'andamentos')} (${n(a.tribunal)} do tribunal e ${n(a.manuais)} manuais), contra a média de ${media(a.mediaAnterior)}.`,
  );
  const mudancas = totalMudancas(s);
  if (mudancas > 0) partes.push(`${plural(mudancas, 'processo mudou', 'processos mudaram')} de estágio.`);
  if (s.hoje && s.hoje.revisar > 0) partes.push(`Hoje há ${plural(s.hoje.revisar, 'processo', 'processos')} para revisar.`);
  return { resumo: partes.join(' '), pontos: [] };
}

export function detalheProcessos(s: SemanaProcessos): Secao[] {
  const a = s.andamentos;
  const secoes: Secao[] = [];
  const i = s.intimacoes;
  if (i) {
    secoes.push({
      titulo: 'Intimações (DJEN)',
      linhas: [
        { rotulo: 'Recebidas na semana', valor: n(i.total) },
        { rotulo: `Média das ${SEMANAS_MEDIA} semanas anteriores`, valor: media(i.mediaAnterior) },
        ...i.porTipo.map((t) => ({ rotulo: t.nome, valor: n(t.total) })),
        { rotulo: 'Dias úteis sem consulta concluída', valor: `${n(i.diasSemConsulta)} de ${n(i.diasUteis)}` },
        { rotulo: 'Rodadas bloqueadas (fora do Brasil)', valor: n(i.geobloqueios) },
        { rotulo: 'Rodadas com erro', valor: n(i.erros) },
      ],
      nota: avisoDjen(i),
    });
  }
  secoes.push({
    titulo: 'Andamentos',
    linhas: [
      { rotulo: 'Do tribunal (Datajud)', valor: n(a.tribunal) },
      { rotulo: 'Manuais', valor: n(a.manuais) },
      { rotulo: 'Processos com andamento', valor: n(a.processos) },
      { rotulo: `Média das ${SEMANAS_MEDIA} semanas anteriores`, valor: media(a.mediaAnterior) },
    ],
    nota: 'Contados pela data do movimento. O Datajud publica com atraso: a semana atual ainda pode crescer.',
  });
  secoes.push({
    titulo: 'Processos novos',
    linhas: [
      { rotulo: 'Judiciais', valor: n(s.novos.judiciais) },
      { rotulo: 'Administrativos', valor: n(s.novos.administrativos) },
      { rotulo: 'Judiciais ainda em triagem', valor: n(s.novos.emTriagem) },
    ],
    nota: null,
  });
  secoes.push({
    titulo: 'Mudanças de estágio',
    linhas: s.mudancasEstagio.map((m) => ({ rotulo: `${ROTULO_ESTAGIO[m.de]} → ${ROTULO_ESTAGIO[m.para]}`, valor: n(m.total) })),
    nota: 'Estágio calculado pelos movimentos do Datajud antes e depois da semana (mesma regra da busca de processo).',
  });
  if (s.hoje) {
    secoes.push({
      titulo: 'Posição de hoje',
      linhas: [
        { rotulo: 'Em triagem', valor: n(s.hoje.triagem) },
        { rotulo: 'Para revisar', valor: n(s.hoje.revisar) },
        { rotulo: `Sem movimento há mais de ${DIAS_PARADO} dias`, valor: n(s.hoje.parados) },
        ...s.hoje.paradosPorComarca.map((c) => ({ rotulo: `Parados em ${c.nome}`, valor: n(c.total) })),
        ...s.hoje.paradosPorTipoAcao.map((c) => ({ rotulo: `Parados: ${c.nome}`, valor: n(c.total) })),
      ],
      nota: 'Arquivados ficam de fora dos parados.',
    });
  }
  return secoes;
}

// ── Clientes (sem IA) ───────────────────────────────────────────────────────

export interface SemanaClientes {
  janela: JanelaSemana;
  novos: number;
  mediaAnterior: number;
  pessoaFisica: number;
  pessoaJuridica: number;
  porCidade: Contagem[];
}

export function destaquesClientes(s: SemanaClientes) {
  return [
    { rotulo: 'Clientes novos', valor: n(s.novos), detalhe: `média ${media(s.mediaAnterior)}`, incompleto: false },
    { rotulo: 'Pessoa física', valor: n(s.pessoaFisica), detalhe: null, incompleto: false },
    { rotulo: 'Pessoa jurídica', valor: n(s.pessoaJuridica), detalhe: null, incompleto: false },
  ];
}

export function resumoClientes(s: SemanaClientes): string[] {
  const out = [`${plural(s.novos, 'cliente cadastrado', 'clientes cadastrados')} (média ${media(s.mediaAnterior)})`];
  const v = variacao(s.novos, s.mediaAnterior);
  if (v) out.push(`${v} contra a média das ${SEMANAS_MEDIA} semanas anteriores`);
  const topo = s.porCidade[0];
  if (topo) out.push(`Mais de ${topo.nome} (${n(topo.total)})`);
  return out;
}

export function detalheClientes(s: SemanaClientes): Secao[] {
  return [
    {
      titulo: 'Clientes novos',
      linhas: [
        { rotulo: 'Cadastrados na semana', valor: n(s.novos) },
        { rotulo: `Média das ${SEMANAS_MEDIA} semanas anteriores`, valor: media(s.mediaAnterior) },
        { rotulo: 'Pessoa física', valor: n(s.pessoaFisica) },
        { rotulo: 'Pessoa jurídica', valor: n(s.pessoaJuridica) },
        ...s.porCidade.map((c) => ({ rotulo: c.nome, valor: n(c.total) })),
      ],
      nota: 'Pela data de cadastro do cliente (ou de criação, quando vazia).',
    },
  ];
}

// ── Comum ───────────────────────────────────────────────────────────────────

export interface Secao {
  titulo: string;
  linhas: { rotulo: string; valor: string }[];
  nota: string | null;
}

export const PERGUNTAS = {
  processos: 'Como foi a semana dos processos?',
  clientes: 'Como foi a semana de clientes novos?',
} as const;

export const INSTRUCAO_PROCESSOS = `Você escreve "Como foi a semana dos processos?" no painel de Insights de um escritório de advocacia brasileiro, para os sócios.

Todo número do JSON já está calculado e formatado em pt-BR. Regras:
${REGRAS_NUMEROS}
- Sem conselhos, previsões, saudações nem causas supostas. Você não vê nomes, números de processo nem textos de intimação: não invente nenhum.
- Português do Brasil, tom objetivo de relatório.
- Comece por intimações e andamentos contra a média, depois mudanças de estágio e processos novos, por fim a posição de hoje, se houver.
- "intimacoes.aviso" quer dizer que o DJEN não foi consultado em parte da semana: cite a lacuna e nunca diga que não houve intimações. Se "intimacoes" não existir, não fale de intimações.
- "Revisar" são processos com baixa definitiva seguida de movimento relevante, que pedem conferência humana. "Triagem" são processos criados a partir de intimação, ainda sem cliente.
- Um item ausente do JSON não quer dizer zero.

Responda só com JSON:
{
  "resumo": "3 a 4 frases.",
  "pontos": [{ "titulo": "tema curto", "detalhe": "uma frase" }]
}
"pontos" tem 2 ou 3 itens, cada um uma conclusão distinta dos dados.`;
