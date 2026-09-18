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
 * Códigos da Tabela Processual Unificada que encerram a tramitação. Trânsito
 * em julgado (848) fica de fora de propósito: cumprimento de sentença continua
 * no mesmo número.
 */
const CODIGOS_ARQUIVAMENTO = new Set([22 /* Baixa Definitiva */, 246 /* Arquivado definitivamente */]);

export interface SituacaoSugerida {
  situacao: 'ATIVO' | 'ARQUIVADO';
  ultimoMovimento: DatajudMovimento | null;
  dataArquivamento: Date | null;
}

export function situacaoSugerida(hits: ComSource[]): SituacaoSugerida {
  const atual = instanciaAtual(hits);
  const movimentos = ordenarMovimentos(atual?._source.movimentos);
  const ultimo = movimentos[0] ?? null;
  // Só considera arquivado se o arquivamento for o evento mais recente da
  // instância mais alta — um desarquivamento posterior reabre o processo.
  const arquivado = ultimo?.codigo !== undefined && CODIGOS_ARQUIVAMENTO.has(ultimo.codigo);
  return {
    situacao: arquivado ? 'ARQUIVADO' : 'ATIVO',
    ultimoMovimento: ultimo,
    dataArquivamento: arquivado && ultimo ? new Date(ultimo.dataHora) : null,
  };
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
