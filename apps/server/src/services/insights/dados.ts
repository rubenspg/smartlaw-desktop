import { and, count, eq, gte, inArray, isNotNull, lt, lte, ne, or, sql } from 'drizzle-orm';
import type { DatajudProcessData } from '@smartlaw/shared';
import { db } from '../../db';
import {
  andamentos,
  clientes,
  intimacoes,
  processoInstancias,
  processosAdministrativos,
  processosJudiciais,
  syncRuns,
  tiposAcao,
} from '../../db/schema';
import { classificarSituacao } from '../datajud/normalizar';
import {
  DIAS_PARADO,
  diasSemConsulta,
  janelaBase,
  limitesUtc,
  mudancasDeEstagio,
  SEMANAS_MEDIA,
  type Contagem,
  type JanelaSemana,
  type SemanaClientes,
  type SemanaProcessos,
} from './semana';

/**
 * Leitura do banco para os cards semanais. Toda consulta filtra por `firmId`
 * (insights.itest.ts prova o isolamento) e devolve só contagens: os campos de
 * pessoa e de texto nunca saem daqui.
 */

type Instancia = { _source: DatajudProcessData };

// A data em que o processo/cliente entrou no escritório; created_at quando o
// cadastro antigo veio sem data.
const entradaJudicial = sql`coalesce(${processosJudiciais.dataCadastro}, ${processosJudiciais.createdAt})`;
const entradaAdmin = sql`coalesce(${processosAdministrativos.dataCadastro}, ${processosAdministrativos.createdAt})`;
const entradaCliente = sql`coalesce(${clientes.dataCadastro}, ${clientes.createdAt})`;

// Situação é texto livre (cadastros antigos têm "BAIXADO", "Arquivado"...).
const encerrado = sql`upper(coalesce(${processosJudiciais.situacao}, '')) similar to '(ARQUIV|BAIXAD|ENCERRAD|EXTINT)%'`;

/** Instâncias dos processos, só com o que `classificarSituacao` lê. */
async function instanciasDe(firmId: string, processoIds: number[]): Promise<Instancia[][]> {
  if (processoIds.length === 0) return [];
  const linhas = await db
    .select({
      processoId: processoInstancias.processoJudicialId,
      grau: processoInstancias.grau,
      classe: sql<DatajudProcessData['classe']>`${processoInstancias.raw}->'classe'`,
      movimentos: sql<DatajudProcessData['movimentos']>`coalesce(${processoInstancias.raw}->'movimentos', '[]'::jsonb)`,
    })
    .from(processoInstancias)
    .where(and(eq(processoInstancias.firmId, firmId), inArray(processoInstancias.processoJudicialId, processoIds)));
  const porProcesso = new Map<number, Instancia[]>();
  for (const l of linhas) {
    const lista = porProcesso.get(l.processoId) ?? [];
    lista.push({ _source: { grau: l.grau, classe: l.classe, movimentos: l.movimentos } as DatajudProcessData });
    porProcesso.set(l.processoId, lista);
  }
  return [...porProcesso.values()];
}

const contagens = (linhas: { nome: string | null; total: number }[]): Contagem[] =>
  linhas.filter((l) => l.nome).map((l) => ({ nome: l.nome!, total: Number(l.total) }));

async function intimacoesDaSemana(firmId: string, j: JanelaSemana): Promise<SemanaProcessos['intimacoes']> {
  const [usou] = await db
    .select({ id: syncRuns.id })
    .from(syncRuns)
    .where(and(eq(syncRuns.firmId, firmId), eq(syncRuns.tipo, 'DJEN')))
    .limit(1);
  if (!usou) return null;

  const base = janelaBase(j);
  const { de, ate } = limitesUtc(j.inicio, j.fim);
  const doDjen = (inicio: string, fim: string) =>
    and(
      eq(intimacoes.firmId, firmId),
      eq(intimacoes.ativo, true),
      gte(intimacoes.dataDisponibilizacao, inicio),
      lte(intimacoes.dataDisponibilizacao, fim),
    );

  const [porTipo, [anterior], cobertura, rodadas] = await Promise.all([
    db
      .select({ nome: intimacoes.tipoComunicacao, total: count() })
      .from(intimacoes)
      .where(doDjen(j.inicio, j.fim))
      .groupBy(intimacoes.tipoComunicacao)
      .orderBy(sql`count(*) desc`),
    db.select({ total: count() }).from(intimacoes).where(doDjen(base.inicio, base.fim)),
    // Uma rodada concluída depois (backfill) também cobre a semana.
    db
      .select({ janelaInicio: syncRuns.janelaInicio, janelaFim: syncRuns.janelaFim })
      .from(syncRuns)
      .where(
        and(
          eq(syncRuns.firmId, firmId),
          eq(syncRuns.tipo, 'DJEN'),
          eq(syncRuns.status, 'SUCESSO'),
          lte(syncRuns.janelaInicio, j.fim),
          gte(syncRuns.janelaFim, j.inicio),
        ),
      ),
    db
      .select({ status: syncRuns.status, total: count() })
      .from(syncRuns)
      .where(and(eq(syncRuns.firmId, firmId), eq(syncRuns.tipo, 'DJEN'), gte(syncRuns.iniciadoEm, de), lt(syncRuns.iniciadoEm, ate)))
      .groupBy(syncRuns.status),
  ]);

  const tipos = contagens(porTipo);
  const { uteis, faltando } = diasSemConsulta(j, cobertura);
  const rodadasCom = (status: string) => Number(rodadas.find((r) => r.status === status)?.total ?? 0);
  return {
    total: tipos.reduce((t, c) => t + c.total, 0),
    mediaAnterior: Number(anterior.total) / SEMANAS_MEDIA,
    porTipo: tipos,
    diasUteis: uteis,
    diasSemConsulta: faltando,
    geobloqueios: rodadasCom('GEOBLOQUEADO'),
    erros: rodadasCom('ERRO'),
  };
}

async function andamentosDaSemana(firmId: string, j: JanelaSemana) {
  const base = janelaBase(j);
  const semana = limitesUtc(j.inicio, j.fim);
  const anterior = limitesUtc(base.inicio, base.fim);
  // SISTEMA são avisos gerados pelo próprio app, não movimento do processo.
  const doPeriodo = (de: Date, ate: Date) =>
    and(
      eq(andamentos.firmId, firmId),
      gte(andamentos.data, de),
      lt(andamentos.data, ate),
      or(sql`${andamentos.tipo} is null`, ne(andamentos.tipo, 'SISTEMA')),
    );

  const [porTipo, [processos], [noAnterior], movidosNoDatajud] = await Promise.all([
    db
      .select({ tribunal: sql<boolean>`coalesce(${andamentos.tipo} = 'DATAJUD', false)`, total: count() })
      .from(andamentos)
      .where(doPeriodo(semana.de, semana.ate))
      .groupBy(sql`1`),
    db
      .select({
        total: sql<number>`count(distinct coalesce('j' || ${andamentos.processoJudicialId}, 'a' || ${andamentos.processoAdminId}))::int`,
      })
      .from(andamentos)
      .where(doPeriodo(semana.de, semana.ate)),
    db.select({ total: count() }).from(andamentos).where(doPeriodo(anterior.de, anterior.ate)),
    db
      .selectDistinct({ id: andamentos.processoJudicialId })
      .from(andamentos)
      .where(and(doPeriodo(semana.de, semana.ate), eq(andamentos.tipo, 'DATAJUD'), isNotNull(andamentos.processoJudicialId))),
  ]);

  const instancias = await instanciasDe(
    firmId,
    movidosNoDatajud.map((m) => m.id!),
  );
  return {
    andamentos: {
      tribunal: Number(porTipo.find((p) => p.tribunal)?.total ?? 0),
      manuais: Number(porTipo.find((p) => !p.tribunal)?.total ?? 0),
      mediaAnterior: Number(noAnterior.total) / SEMANAS_MEDIA,
      processos: Number(processos.total),
    },
    mudancasEstagio: mudancasDeEstagio(instancias, semana.de, semana.ate),
  };
}

async function novosDaSemana(firmId: string, j: JanelaSemana): Promise<SemanaProcessos['novos']> {
  const { de, ate } = limitesUtc(j.inicio, j.fim);
  const [[judiciais], [administrativos]] = await Promise.all([
    db
      .select({
        total: count(),
        triagem: sql<number>`count(*) filter (where ${processosJudiciais.situacao} = 'TRIAGEM')::int`,
      })
      .from(processosJudiciais)
      .where(and(eq(processosJudiciais.firmId, firmId), sql`${entradaJudicial} >= ${de}`, sql`${entradaJudicial} < ${ate}`)),
    db
      .select({ total: count() })
      .from(processosAdministrativos)
      .where(and(eq(processosAdministrativos.firmId, firmId), sql`${entradaAdmin} >= ${de}`, sql`${entradaAdmin} < ${ate}`)),
  ]);
  return { judiciais: Number(judiciais.total), administrativos: Number(administrativos.total), emTriagem: Number(judiciais.triagem) };
}

/** Foto de hoje: triagem, revisar e parados. */
async function posicaoDeHoje(firmId: string, agora: Date): Promise<NonNullable<SemanaProcessos['hoje']>> {
  const limite = new Date(agora.getTime() - DIAS_PARADO * 86_400_000);
  const ultimoMovimento = sql`(
    select max(${andamentos.data}) from ${andamentos}
    where ${andamentos.firmId} = ${firmId}
      and ${andamentos.processoJudicialId} = ${processosJudiciais.id}
      and (${andamentos.tipo} is null or ${andamentos.tipo} <> 'SISTEMA')
  )`;
  const referencia = sql`coalesce(${ultimoMovimento}, ${processosJudiciais.distribuicao}, ${entradaJudicial})`;

  const [[triagem], comBaixa, parados] = await Promise.all([
    db
      .select({ total: count() })
      .from(processosJudiciais)
      .where(and(eq(processosJudiciais.firmId, firmId), eq(processosJudiciais.situacao, 'TRIAGEM'))),
    // REVISAR só existe depois de uma baixa (22) ou arquivamento definitivo (246).
    db
      .selectDistinct({ id: processoInstancias.processoJudicialId })
      .from(processoInstancias)
      .where(
        and(
          eq(processoInstancias.firmId, firmId),
          sql`(${processoInstancias.raw}->'movimentos' @> '[{"codigo":22}]' or ${processoInstancias.raw}->'movimentos' @> '[{"codigo":246}]')`,
        ),
      ),
    db
      .select({ comarca: processosJudiciais.comarca, tipoAcao: tiposAcao.descricao, total: count() })
      .from(processosJudiciais)
      .leftJoin(tiposAcao, eq(tiposAcao.codigo, processosJudiciais.tipoAcaoId))
      .where(and(eq(processosJudiciais.firmId, firmId), sql`not (${encerrado})`, sql`${referencia} < ${limite}`))
      .groupBy(processosJudiciais.comarca, tiposAcao.descricao),
  ]);

  const revisar = (await instanciasDe(firmId, comBaixa.map((c) => c.id))).filter(
    (instancias) => classificarSituacao(instancias).estagio === 'REVISAR',
  ).length;

  const somarPor = (chave: 'comarca' | 'tipoAcao') => {
    const mapa = new Map<string, number>();
    for (const p of parados) {
      const nome = p[chave]?.trim();
      if (nome) mapa.set(nome, (mapa.get(nome) ?? 0) + Number(p.total));
    }
    return [...mapa].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total).slice(0, 5);
  };

  return {
    triagem: Number(triagem.total),
    revisar,
    parados: parados.reduce((t, p) => t + Number(p.total), 0),
    paradosPorComarca: somarPor('comarca'),
    paradosPorTipoAcao: somarPor('tipoAcao'),
  };
}

export async function carregarSemanaProcessos(
  firmId: string,
  janela: JanelaSemana,
  atual: boolean,
  agora: Date,
): Promise<SemanaProcessos> {
  const [intimacoesSemana, { andamentos: andamentosSemana, mudancasEstagio }, novos, hoje] = await Promise.all([
    intimacoesDaSemana(firmId, janela),
    andamentosDaSemana(firmId, janela),
    novosDaSemana(firmId, janela),
    atual ? posicaoDeHoje(firmId, agora) : Promise.resolve(null),
  ]);
  return { janela, intimacoes: intimacoesSemana, andamentos: andamentosSemana, novos, mudancasEstagio, hoje };
}

export async function carregarSemanaClientes(firmId: string, janela: JanelaSemana): Promise<SemanaClientes> {
  const base = janelaBase(janela);
  const semana = limitesUtc(janela.inicio, janela.fim);
  const anterior = limitesUtc(base.inicio, base.fim);
  const doPeriodo = (de: Date, ate: Date) =>
    and(eq(clientes.firmId, firmId), sql`${entradaCliente} >= ${de}`, sql`${entradaCliente} < ${ate}`);

  const [porTipo, [noAnterior], porCidade] = await Promise.all([
    db.select({ tipo: clientes.tipo, total: count() }).from(clientes).where(doPeriodo(semana.de, semana.ate)).groupBy(clientes.tipo),
    db.select({ total: count() }).from(clientes).where(doPeriodo(anterior.de, anterior.ate)),
    db
      .select({ nome: clientes.municipio, total: count() })
      .from(clientes)
      .where(and(doPeriodo(semana.de, semana.ate), isNotNull(clientes.municipio)))
      .groupBy(clientes.municipio)
      .orderBy(sql`count(*) desc`)
      .limit(3),
  ]);

  const doTipo = (t: string) => Number(porTipo.find((p) => p.tipo === t)?.total ?? 0);
  return {
    janela,
    novos: porTipo.reduce((t, p) => t + Number(p.total), 0),
    mediaAnterior: Number(noAnterior.total) / SEMANAS_MEDIA,
    pessoaFisica: doTipo('F'),
    pessoaJuridica: doTipo('J'),
    porCidade: contagens(porCidade),
  };
}
