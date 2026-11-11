import { and, asc, count, desc, eq, gte, isNotNull, isNull, lt, lte, ne, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import { andamentos, intimacoes, processosJudiciais, syncRuns, tarefas } from '../../db/schema';
import { DIAS_A_FRENTE, diaUtilAnterior, inicioDoDiaUtc, somarDias, type DiaDados, type StatusRodada } from './dia';

/**
 * Leitura do banco para o "Resumo do dia". Toda consulta filtra por `firmId`;
 * as de tarefa também por `usuarioId`: o resumo é pessoal, como a lista de
 * tarefas da tela inicial, inclusive para admin.
 */

const DIA_MS = 86_400_000;
const MAX_ITENS = 6;

export interface ItemDoDia {
  id: number;
  titulo: string;
  dataLimite: string;
  prioridade: string | null;
  categoria: string | null;
  atrasada: boolean;
}

export async function carregarDia(firmId: string, usuarioId: string, hoje: string): Promise<{ dados: DiaDados; itens: ItemDoDia[] }> {
  const desde = diaUtilAnterior(hoje);
  const inicioHoje = inicioDoDiaUtc(hoje);
  const fimHoje = inicioDoDiaUtc(somarDias(hoje, 1));
  const fimHorizonte = inicioDoDiaUtc(somarDias(hoje, DIAS_A_FRENTE + 1));
  const inicioNovidades = inicioDoDiaUtc(desde);
  const ultimoDiaPrazo = somarDias(hoje, DIAS_A_FRENTE);

  const minhasPendentes = and(eq(tarefas.firmId, firmId), eq(tarefas.usuarioId, usuarioId), eq(tarefas.status, 'PENDENTE'));
  const ateHoje = and(minhasPendentes, lt(tarefas.dataLimite, fimHoje));

  // Prazo de intimação ainda aberto: sem tarefa, ou com a tarefa pendente.
  const prazoAberto = and(
    eq(intimacoes.firmId, firmId),
    eq(intimacoes.ativo, true),
    gte(intimacoes.prazoFim, hoje),
    lte(intimacoes.prazoFim, ultimoDiaPrazo),
    or(isNull(intimacoes.tarefaId), eq(tarefas.status, 'PENDENTE')),
  );

  const [[contagem], porCategoria, itens, [usouDjen], [rodada], [naoLidas], novasPorTipo, [prazos], [doTribunal], [triagem]] =
    await Promise.all([
      db
        .select({
          atrasadas: sql<number>`count(*) filter (where ${tarefas.dataLimite} < ${inicioHoje})::int`,
          hoje: sql<number>`count(*) filter (where ${tarefas.dataLimite} >= ${inicioHoje} and ${tarefas.dataLimite} < ${fimHoje})::int`,
          proximosDias: sql<number>`count(*) filter (where ${tarefas.dataLimite} >= ${fimHoje} and ${tarefas.dataLimite} < ${fimHorizonte})::int`,
          semPrazo: sql<number>`count(*) filter (where ${tarefas.dataLimite} is null)::int`,
          prioridadeAlta: sql<number>`count(*) filter (where ${tarefas.prioridade} = 'ALTA' and ${tarefas.dataLimite} < ${fimHorizonte})::int`,
          maisAntiga: sql<string | null>`min(${tarefas.dataLimite}) filter (where ${tarefas.dataLimite} < ${inicioHoje})`,
        })
        .from(tarefas)
        .where(minhasPendentes),
      db
        .select({ nome: sql<string>`coalesce(${tarefas.categoria}, 'GERAL')`, total: count() })
        .from(tarefas)
        .where(ateHoje)
        .groupBy(sql`1`)
        .orderBy(sql`count(*) desc`),
      db
        .select({
          id: tarefas.id,
          titulo: tarefas.titulo,
          dataLimite: tarefas.dataLimite,
          prioridade: tarefas.prioridade,
          categoria: tarefas.categoria,
        })
        .from(tarefas)
        .where(ateHoje)
        .orderBy(asc(tarefas.dataLimite))
        .limit(MAX_ITENS),
      db
        .select({ id: syncRuns.id })
        .from(syncRuns)
        .where(and(eq(syncRuns.firmId, firmId), eq(syncRuns.tipo, 'DJEN')))
        .limit(1),
      // A última rodada concluída: uma em execução não diz nada ainda.
      db
        .select({ status: syncRuns.status })
        .from(syncRuns)
        .where(and(eq(syncRuns.firmId, firmId), eq(syncRuns.tipo, 'DJEN'), ne(syncRuns.status, 'EXECUTANDO')))
        .orderBy(desc(syncRuns.iniciadoEm))
        .limit(1),
      db
        .select({ total: count() })
        .from(intimacoes)
        .where(and(eq(intimacoes.firmId, firmId), eq(intimacoes.ativo, true), isNull(intimacoes.lidaEm))),
      db
        .select({ nome: intimacoes.tipoComunicacao, total: count() })
        .from(intimacoes)
        .where(and(eq(intimacoes.firmId, firmId), eq(intimacoes.ativo, true), gte(intimacoes.dataDisponibilizacao, desde)))
        .groupBy(intimacoes.tipoComunicacao)
        .orderBy(sql`count(*) desc`),
      db
        .select({ total: count(), proximo: sql<string | null>`min(${intimacoes.prazoFim})` })
        .from(intimacoes)
        // O join repete o firmId: a tarefa de outra firma nunca entra na conta.
        .leftJoin(tarefas, and(eq(tarefas.id, intimacoes.tarefaId), eq(tarefas.firmId, firmId)))
        .where(prazoAberto),
      db
        .select({
          total: count(),
          processos: sql<number>`count(distinct ${andamentos.processoJudicialId})::int`,
        })
        .from(andamentos)
        .where(
          and(
            eq(andamentos.firmId, firmId),
            eq(andamentos.tipo, 'DATAJUD'),
            isNotNull(andamentos.processoJudicialId),
            gte(andamentos.inclusao, inicioNovidades),
          ),
        ),
      db
        .select({ total: count() })
        .from(processosJudiciais)
        .where(and(eq(processosJudiciais.firmId, firmId), eq(processosJudiciais.situacao, 'TRIAGEM'))),
    ]);

  const atrasadas = Number(contagem?.atrasadas ?? 0);
  const maisAntiga = contagem?.maisAntiga ? new Date(contagem.maisAntiga) : null;
  const novas = novasPorTipo.map((p) => ({ nome: p.nome, total: Number(p.total) }));

  const dados: DiaDados = {
    hoje,
    desde,
    tarefas: {
      atrasadas,
      hoje: Number(contagem?.hoje ?? 0),
      proximosDias: Number(contagem?.proximosDias ?? 0),
      semPrazo: Number(contagem?.semPrazo ?? 0),
      prioridadeAlta: Number(contagem?.prioridadeAlta ?? 0),
      maiorAtrasoDias: maisAntiga ? Math.max(1, Math.ceil((inicioHoje.getTime() - maisAntiga.getTime()) / DIA_MS)) : null,
      porCategoria: porCategoria.map((c) => ({ nome: c.nome, total: Number(c.total) })),
    },
    intimacoes: usouDjen
      ? {
          naoLidas: Number(naoLidas?.total ?? 0),
          novas: novas.reduce((t, p) => t + p.total, 0),
          porTipo: novas,
          prazosProximos: Number(prazos?.total ?? 0),
          proximoPrazo: prazos?.proximo ?? null,
          ultimaRodada: (rodada?.status as StatusRodada | undefined) ?? null,
        }
      : null,
    andamentos: { tribunal: Number(doTribunal?.total ?? 0), processos: Number(doTribunal?.processos ?? 0) },
    triagem: Number(triagem?.total ?? 0),
  };

  return {
    dados,
    itens: itens.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      dataLimite: t.dataLimite!.toISOString(),
      prioridade: t.prioridade,
      categoria: t.categoria,
      atrasada: t.dataLimite!.getTime() < inicioHoje.getTime(),
    })),
  };
}
