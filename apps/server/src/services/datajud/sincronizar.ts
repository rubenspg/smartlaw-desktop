import { and, eq } from 'drizzle-orm';
import type { DriftResult } from '@smartlaw/shared';
import { db } from '../../db';
import { andamentos, processoInstancias, processosJudiciais } from '../../db/schema';
import type { DatajudClient, DatajudHit } from './client';
import { somenteDigitos } from './cnj';
import type { EstagioProcesso } from './normalizar';
import {
  chaveMovimento,
  compararCampos,
  historicoMovimento,
  ordemGrau,
  ordenarInstancias,
  parseDataAjuizamento,
  situacaoSugerida,
} from './normalizar';

export interface ProcessoParaSync {
  id: number;
  firmId: string;
  numero: string;
  juizo: string | null;
  justica: string | null;
  orgaoJulgador: string | null;
  comarca: string | null;
  situacao: string | null;
  distribuicao: Date | null;
  dtArquivado: Date | null;
}

export interface ResultadoSync extends DriftResult {
  encontrado: boolean;
  instancias: number;
  situacao: string | null;
  /** Estágio classificado pelos códigos TPU (ver classificarSituacao); null se não encontrado. */
  estagio: EstagioProcesso | null;
}

/**
 * Traz um processo ao estado do tribunal: uma linha em `processo_instancias`
 * por documento do Datajud e um `andamento` (tipo DATAJUD) por movimento.
 *
 * Idempotente: instâncias fazem upsert por (firm_id, datajud_doc_id) e
 * movimentos são inseridos com ON CONFLICT DO NOTHING em `external_id`, então
 * rodar duas vezes seguidas devolve `newMovements: 0`. Campos do cadastro só
 * são preenchidos quando estão vazios — o tribunal nunca sobrescreve o que o
 * escritório digitou; divergências voltam em `fields`.
 *
 * É o mesmo caminho para o botão "Sincronizar" e para o job em lote da fase 2.
 */
export async function sincronizarProcesso(
  processo: ProcessoParaSync,
  client: DatajudClient,
  agora: Date = new Date(),
): Promise<ResultadoSync> {
  const hits = await client.buscarPorNumero(processo.numero);
  return aplicarInstancias(processo, hits, agora);
}

/** Mesma persistência, mas com os documentos já em mãos (lote da fase 2). */
export async function aplicarInstancias(
  processo: ProcessoParaSync,
  hitsBrutos: DatajudHit[],
  agora: Date = new Date(),
): Promise<ResultadoSync> {
  const { id: processoId, firmId } = processo;
  const hits = ordenarInstancias(hitsBrutos);

  if (hits.length === 0) {
    await db
      .update(processosJudiciais)
      .set({ lastSync: agora, syncStatus: 'NAO_ENCONTRADO', updatedAt: agora })
      .where(and(eq(processosJudiciais.id, processoId), eq(processosJudiciais.firmId, firmId)));
    return { encontrado: false, instancias: 0, hasDrift: false, fields: [], newMovements: 0, situacao: null, estagio: null };
  }

  const fields = compararCampos(processo, hits);
  const sugestao = situacaoSugerida(hits);
  const origem = hits[0]._source;

  const novos = await db.transaction(async (tx) => {
    const idsPorDoc = new Map<string, number>();
    for (const hit of hits) {
      const s = hit._source;
      const valores = {
        firmId,
        processoJudicialId: processoId,
        datajudDocId: hit._id,
        tribunal: s.tribunal ?? '',
        grau: s.grau ?? '',
        grauOrdem: ordemGrau(s.grau),
        numeroProcesso: somenteDigitos(s.numeroProcesso),
        classeCodigo: s.classe?.codigo ?? null,
        classeNome: s.classe?.nome ?? null,
        orgaoJulgadorCodigo: numeroOuNull(s.orgaoJulgador?.codigo),
        orgaoJulgadorNome: s.orgaoJulgador?.nome ?? null,
        codigoMunicipioIbge: s.orgaoJulgador?.codigoMunicipioIBGE ?? null,
        sistema: s.sistema?.nome ?? null,
        formato: s.formato?.nome ?? null,
        nivelSigilo: s.nivelSigilo ?? null,
        assuntos: s.assuntos ?? [],
        dataAjuizamento: parseDataAjuizamento(s.dataAjuizamento),
        dataHoraUltimaAtualizacao: s.dataHoraUltimaAtualizacao ? new Date(s.dataHoraUltimaAtualizacao) : null,
        totalMovimentos: s.movimentos?.length ?? 0,
        raw: s,
        syncedAt: agora,
        updatedAt: agora,
      };
      const [linha] = await tx
        .insert(processoInstancias)
        .values(valores)
        .onConflictDoUpdate({
          target: [processoInstancias.firmId, processoInstancias.datajudDocId],
          set: valores,
        })
        .returning({ id: processoInstancias.id });
      idsPorDoc.set(hit._id, linha.id);
    }

    const linhasAndamento = hits.flatMap((hit) =>
      (hit._source.movimentos ?? []).map((m) => ({
        firmId,
        processoJudicialId: processoId,
        instanciaId: idsPorDoc.get(hit._id) ?? null,
        data: new Date(m.dataHora),
        inclusao: agora,
        historico: historicoMovimento(m),
        tipo: 'DATAJUD',
        externalId: chaveMovimento(firmId, hit._id, m),
      })),
    );

    let inseridos = 0;
    // Lotes de 200: 116 movimentos numa instância é comum; 1000+ acontece.
    for (let i = 0; i < linhasAndamento.length; i += 200) {
      const lote = linhasAndamento.slice(i, i + 200);
      const r = await tx
        .insert(andamentos)
        .values(lote)
        .onConflictDoNothing({ target: andamentos.externalId })
        .returning({ id: andamentos.id });
      inseridos += r.length;
    }

    // Preenche só o que está vazio; o cadastro do escritório prevalece.
    const patch: Partial<typeof processosJudiciais.$inferInsert> = {
      lastSync: agora,
      syncStatus: fields.length > 0 ? 'DIVERGENTE' : 'SUCESSO',
      updatedAt: agora,
    };
    if (!processo.juizo && origem.orgaoJulgador?.nome) patch.juizo = origem.orgaoJulgador.nome;
    if (!processo.orgaoJulgador && origem.orgaoJulgador?.nome) patch.orgaoJulgador = origem.orgaoJulgador.nome;
    if (!processo.justica && origem.tribunal) patch.justica = origem.tribunal;
    if (!processo.distribuicao) {
      const ajuizamento = parseDataAjuizamento(origem.dataAjuizamento);
      if (ajuizamento) patch.distribuicao = ajuizamento;
    }
    if (!processo.situacao || processo.situacao === 'N/A') patch.situacao = sugestao.situacao;
    if (!processo.dtArquivado && sugestao.dataArquivamento) patch.dtArquivado = sugestao.dataArquivamento;

    await tx
      .update(processosJudiciais)
      .set(patch)
      .where(and(eq(processosJudiciais.id, processoId), eq(processosJudiciais.firmId, firmId)));

    return inseridos;
  });

  return {
    encontrado: true,
    instancias: hits.length,
    hasDrift: fields.length > 0,
    fields,
    newMovements: novos,
    situacao: sugestao.situacao,
    estagio: sugestao.estagio,
  };
}

function numeroOuNull(v: number | string | undefined): number | null {
  if (v === undefined || v === null) return null;
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
