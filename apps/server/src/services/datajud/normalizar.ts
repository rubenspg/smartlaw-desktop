import { createHash } from 'node:crypto';
import type { DatajudMovimento, DatajudProcessData, DriftResult } from '@smartlaw/shared';

type ComSource = { _source: DatajudProcessData };

/**
 * Ordem das instâncias, da origem para cima. Um processo segue OU o rito
 * comum (G1 → G2 → G3) OU o dos juizados (JE → TR); as duas trilhas
 * compartilham a mesma escala para o desempate valer nos dois casos.
 */
export const ORDEM_GRAU: Record<string, number> = { G1: 1, JE: 1, G2: 2, TR: 2, G3: 3, SUP: 3 };

export function ordemGrau(grau?: string): number {
  return (grau && ORDEM_GRAU[grau]) || 9;
}

export function ordenarInstancias<T extends ComSource>(hits: T[]): T[] {
  return [...hits].sort(
    (a, b) =>
      ordemGrau(a._source.grau) - ordemGrau(b._source.grau) ||
      (a._source.dataHoraUltimaAtualizacao ?? '').localeCompare(b._source.dataHoraUltimaAtualizacao ?? ''),
  );
}

/** Do mais recente para o mais antigo. O Datajud não garante ordem alguma. */
export function ordenarMovimentos(movimentos: DatajudMovimento[] = []): DatajudMovimento[] {
  return [...movimentos].sort((a, b) => b.dataHora.localeCompare(a.dataHora));
}

/** A instância "atual": a mais alta; empate pela atualização mais recente. */
export function instanciaAtual<T extends ComSource>(hits: T[]): T | undefined {
  const ordenadas = ordenarInstancias(hits);
  return ordenadas[ordenadas.length - 1];
}

/**
 * Identidade estável de um movimento. O Datajud não dá id por movimento e dois
 * movimentos podem ter o mesmo código com um segundo de diferença, então a
 * chave usa tudo que os distingue. `firmId` entra porque `andamentos.external_id`
 * é único na tabela toda e duas firmas podem acompanhar o mesmo processo.
 */
export function chaveMovimento(firmId: string, docId: string, m: DatajudMovimento): string {
  const complementos = (m.complementosTabelados ?? [])
    .map((c) => `${c.codigo ?? ''}:${c.valor ?? ''}:${c.nome ?? ''}`)
    .sort()
    .join('|');
  const base = [firmId, docId, m.codigo ?? '', m.dataHora, m.nome, complementos].join('\n');
  return 'datajud:' + createHash('sha1').update(base).digest('hex');
}

/** "Conclusão — para julgamento" / "Petição — Petição (outras)". */
export function historicoMovimento(m: DatajudMovimento): string {
  const complementos = (m.complementosTabelados ?? [])
    .map((c) => c.nome)
    .filter((n): n is string => Boolean(n));
  return complementos.length ? `${m.nome} — ${complementos.join('; ')}` : m.nome;
}

/** `20110803143540` → Date (UTC, como os movimentos). Devolve null se não parsear. */
export function parseDataAjuizamento(valor?: string): Date | null {
  if (!valor) return null;
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?$/.exec(valor.trim());
  if (!m) {
    const d = new Date(valor);
    return isNaN(d.getTime()) ? null : d;
  }
  const [, a, me, di, h = '00', mi = '00', s = '00'] = m;
  const d = new Date(Date.UTC(+a, +me - 1, +di, +h, +mi, +s));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Classificação do estágio do processo a partir dos códigos da Tabela
 * Processual Unificada (TPU) de TODAS as instâncias, em ordem cronológica.
 *
 * Calibrada em 2026-09-18 sobre os 983 processos da firma que existem no
 * Datajud: 712 têm Baixa Definitiva (22) ou Definitivo (246) como último
 * movimento; outros 76 têm a baixa seguida só de burocracia (petição,
 * documento, mudança de assunto…), que não reabre nada; nenhum tem
 * desarquivamento (861) e só 2 têm arquivamento provisório (245). RPV e
 * precatório não aparecem nos complementos do TRF4/TJRS, então "pagou" é
 * lido pela classe (Cumprimento de Sentença…) + baixa.
 *
 * Trânsito em julgado (848) NÃO arquiva: o cumprimento de sentença segue no
 * mesmo número. Um movimento fora da lista de ruído depois da baixa não
 * reabre automaticamente: vira REVISAR, para uma pessoa olhar.
 */
export const TPU = {
  BAIXA_DEFINITIVA: 22,
  ARQUIVADO_DEFINITIVO: 246,
  ARQUIVADO_PROVISORIO: 245,
  DESARQUIVAMENTO: 861,
  TRANSITO_EM_JULGADO: 848,
  EXTINCAO_EXECUCAO: 196,
  SUSPENSAO_CUMPRIDA: 12065,
  PROCEDENCIA: 219,
  IMPROCEDENCIA: 220,
  PROCEDENCIA_PARCIAL: 221,
} as const;

const CODIGOS_ARQUIVAMENTO = new Set<number>([TPU.BAIXA_DEFINITIVA, TPU.ARQUIVADO_DEFINITIVO]);
const CODIGOS_SUSPENSAO = new Set<number>([TPU.ARQUIVADO_PROVISORIO, TPU.SUSPENSAO_CUMPRIDA]);
const CODIGOS_JULGAMENTO = new Set<number>([TPU.PROCEDENCIA, TPU.IMPROCEDENCIA, TPU.PROCEDENCIA_PARCIAL]);

/**
 * Movimentos que o eproc/PJe lança depois da baixa sem que o processo volte a
 * tramitar (os 76 casos da calibração). Qualquer outro código depois da baixa
 * pede revisão humana.
 */
export const RUIDO_POS_BAIXA = new Set<number>([
  85, // Petição
  92, // Publicação
  581, // Documento
  60, // Expedição de documento
  1051, // Decurso de Prazo
  1061, // Disponibilização no DJe
  11383, // Ato ordinatório
  12143, // Mudança de Assunto Processual
  12265, // Expedida/certificada
  12282, // Expedida/Certificada
  12266, // Confirmada
  12281, // Comunicação eletrônica
  12291, // Movimentação processual
  12293, // Ato cumprido pela parte ou interessado
  36, // Redistribuição
  898, // Por decisão judicial
]);

export type EstagioProcesso =
  | 'ATIVO'
  | 'SENTENCIADO'
  | 'TRANSITADO'
  | 'EM_CUMPRIMENTO'
  | 'SUSPENSO'
  | 'ARQUIVADO'
  | 'REVISAR';

export type ResultadoJulgamento = 'PROCEDENTE' | 'PARCIALMENTE_PROCEDENTE' | 'IMPROCEDENTE';

export interface MovimentoComGrau extends DatajudMovimento {
  grau: string;
}

export interface ClassificacaoProcesso {
  estagio: EstagioProcesso;
  /** O que cabe em `processos_judiciais.situacao`: só ARQUIVADO fecha. */
  situacao: 'ATIVO' | 'ARQUIVADO';
  resultado: ResultadoJulgamento | null;
  dataArquivamento: Date | null;
  dataTransito: Date | null;
  /** Último movimento cronológico entre todas as instâncias. */
  ultimoMovimento: MovimentoComGrau | null;
  /** Movimentos de ruído ignorados depois da baixa. */
  residuais: number;
  /** Explicação curta para a tela ("Baixa Definitiva em 12/03/2024 (G1)"). */
  motivo: string;
}

/** Todos os movimentos de todas as instâncias, do mais antigo para o mais novo. */
export function movimentosCronologicos(hits: ComSource[]): MovimentoComGrau[] {
  return hits
    .flatMap((h) => (h._source.movimentos ?? []).map((m) => ({ ...m, grau: h._source.grau ?? '?' })))
    .sort((a, b) => a.dataHora.localeCompare(b.dataHora));
}

const ehClasseCumprimento = (hits: ComSource[]) =>
  hits.some((h) => /cumprimento de senten|execu[çc][ãa]o/i.test(h._source.classe?.nome ?? ''));

const dataBr = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

export function classificarSituacao(hits: ComSource[]): ClassificacaoProcesso {
  const movs = movimentosCronologicos(hits);
  const ultimo = movs[movs.length - 1] ?? null;

  const ultimoJulgamento = [...movs].reverse().find((m) => m.codigo !== undefined && CODIGOS_JULGAMENTO.has(m.codigo));
  const resultado: ResultadoJulgamento | null =
    ultimoJulgamento?.codigo === TPU.PROCEDENCIA
      ? 'PROCEDENTE'
      : ultimoJulgamento?.codigo === TPU.PROCEDENCIA_PARCIAL
        ? 'PARCIALMENTE_PROCEDENTE'
        : ultimoJulgamento?.codigo === TPU.IMPROCEDENCIA
          ? 'IMPROCEDENTE'
          : null;
  const transito = [...movs].reverse().find((m) => m.codigo === TPU.TRANSITO_EM_JULGADO);
  const dataTransito = transito ? new Date(transito.dataHora) : null;

  const base = { resultado, dataTransito, ultimoMovimento: ultimo, residuais: 0 };
  const rotulo = (m: MovimentoComGrau) => `${m.nome} em ${dataBr(m.dataHora)} (${m.grau})`;

  if (!ultimo) {
    return { ...base, estagio: 'ATIVO', situacao: 'ATIVO', dataArquivamento: null, motivo: 'Sem movimentos no Datajud' };
  }

  // 1-3. Baixa/arquivamento definitivo e o que veio depois.
  let idxBaixa = -1;
  for (let i = movs.length - 1; i >= 0; i--) {
    if (movs[i].codigo !== undefined && CODIGOS_ARQUIVAMENTO.has(movs[i].codigo!)) {
      idxBaixa = i;
      break;
    }
  }
  if (idxBaixa >= 0) {
    const baixa = movs[idxBaixa];
    const depois = movs.slice(idxBaixa + 1);
    const estranhos = depois.filter((m) => m.codigo === undefined || !RUIDO_POS_BAIXA.has(m.codigo));
    if (estranhos.length === 0) {
      return {
        ...base,
        estagio: 'ARQUIVADO',
        situacao: 'ARQUIVADO',
        dataArquivamento: new Date(baixa.dataHora),
        residuais: depois.length,
        motivo: depois.length ? `${rotulo(baixa)}; ${depois.length} movimento(s) burocrático(s) depois` : rotulo(baixa),
      };
    }
    return {
      ...base,
      estagio: 'REVISAR',
      situacao: 'ATIVO',
      dataArquivamento: null,
      residuais: depois.length - estranhos.length,
      motivo: `${rotulo(baixa)}, mas depois houve ${rotulo(estranhos[estranhos.length - 1])}`,
    };
  }

  // 4. Suspenso/sobrestado/arquivado provisoriamente, se for o último evento.
  if (ultimo.codigo !== undefined && CODIGOS_SUSPENSAO.has(ultimo.codigo)) {
    return { ...base, estagio: 'SUSPENSO', situacao: 'ATIVO', dataArquivamento: null, motivo: rotulo(ultimo) };
  }

  // 5. Cumprimento de sentença (classe) ou trânsito em julgado sem baixa.
  if (ehClasseCumprimento(hits)) {
    return {
      ...base,
      estagio: 'EM_CUMPRIMENTO',
      situacao: 'ATIVO',
      dataArquivamento: null,
      motivo: `Classe de cumprimento/execução sem baixa; último: ${rotulo(ultimo)}`,
    };
  }
  if (transito) {
    return { ...base, estagio: 'TRANSITADO', situacao: 'ATIVO', dataArquivamento: null, motivo: `${rotulo(transito)}, sem baixa` };
  }

  // 6. Sentença sem trânsito.
  if (ultimoJulgamento) {
    return {
      ...base,
      estagio: 'SENTENCIADO',
      situacao: 'ATIVO',
      dataArquivamento: null,
      motivo: `${rotulo(ultimoJulgamento)}; último: ${rotulo(ultimo)}`,
    };
  }

  // 7.
  return { ...base, estagio: 'ATIVO', situacao: 'ATIVO', dataArquivamento: null, motivo: `Último: ${rotulo(ultimo)}` };
}

export interface SituacaoSugerida {
  situacao: 'ATIVO' | 'ARQUIVADO';
  estagio: EstagioProcesso;
  ultimoMovimento: DatajudMovimento | null;
  dataArquivamento: Date | null;
}

/** Resumo de `classificarSituacao` para o cadastro: só ARQUIVADO fecha o processo. */
export function situacaoSugerida(hits: ComSource[]): SituacaoSugerida {
  const c = classificarSituacao(hits);
  return { situacao: c.situacao, estagio: c.estagio, ultimoMovimento: c.ultimoMovimento, dataArquivamento: c.dataArquivamento };
}

export interface CamposLocais {
  juizo?: string | null;
  justica?: string | null;
  orgaoJulgador?: string | null;
}

/**
 * Divergências entre o cadastro local e o tribunal. `juizo` é comparado com a
 * instância de ORIGEM (a vara), não com a atual: depois de uma apelação o
 * órgão atual é um gabinete no TRF, e isso não é o escritório ter cadastrado
 * errado. `justica` é comparada com o tribunal.
 */
export function compararCampos(local: CamposLocais, hits: ComSource[]): DriftResult['fields'] {
  const origem = ordenarInstancias(hits)[0]?._source;
  if (!origem) return [];
  const fields: DriftResult['fields'] = [];
  const remotoJuizo = origem.orgaoJulgador?.nome;
  const localJuizo = local.juizo || local.orgaoJulgador;
  if (remotoJuizo && localJuizo && localJuizo !== remotoJuizo) {
    fields.push({ field: 'juizo', local: localJuizo, remote: remotoJuizo });
  }
  if (origem.tribunal && local.justica && local.justica !== origem.tribunal) {
    fields.push({ field: 'justica', local: local.justica, remote: origem.tribunal });
  }
  return fields;
}
