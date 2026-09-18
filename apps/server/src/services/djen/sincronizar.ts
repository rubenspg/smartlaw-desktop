import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import { db } from '../../db';
import { firms, intimacoes, processosJudiciais, profiles, syncRuns, tarefas } from '../../db/schema';
import type { Feriado } from '../../db/schema';
import type { DatajudClient } from '../datajud/client';
import { formatarNumeroCnj, somenteDigitos, validarNumeroCnj } from '../datajud/cnj';
import { sincronizarProcesso } from '../datajud/sincronizar';
import { DjenClient, DjenError } from './client';
import {
  advogadosDoItem,
  chaveOab,
  dedupePorId,
  destinatariosDoItem,
  ehInformativa,
  numeroExibicao,
  prazoSugerido,
  resumoTexto,
  textoPlano,
  tituloTarefa,
} from './normalizar';
import { calcularPrazo, fimDoDiaBrasil, paraISO } from './prazos';
import type { DjenItem } from './types';

/** Uma OAB acompanhada pela firma; `usuarioId` quando o advogado é usuário do app. */
export interface OabAcompanhada {
  numero: string;
  uf: string;
  nome?: string;
  usuarioId?: string;
}

export interface OpcoesSyncDjen {
  firmId: string;
  client: DjenClient;
  /** Com um client do Datajud, cada processo criado em TRIAGEM é sincronizado na hora (fase 1). */
  datajud?: DatajudClient | null;
  /** Janela `yyyy-mm-dd` inclusive. Sem `inicio`, usa os últimos `dias` (padrão 3: o DJEN publica atrasado). */
  inicio?: string;
  fim?: string;
  dias?: number;
  /** Padrão true. Com false, a intimação de processo desconhecido fica sem vínculo. */
  criarProcessos?: boolean;
  agora?: Date;
}

export interface ResultadoSyncDjen {
  runId: number;
  status: 'SUCESSO' | 'GEOBLOQUEADO' | 'ERRO';
  itensLidos: number;
  itensNovos: number;
  processosCriados: number;
  tarefasCriadas: number;
  /** Ids dos processos criados em TRIAGEM nesta rodada — a fase 2 gera as notificações a partir daqui. */
  processosEmTriagem: number[];
  mensagem: string | null;
}

export interface ContextoAplicacao {
  firmId: string;
  oabs: OabAcompanhada[];
  feriados: Feriado[];
  datajud?: DatajudClient | null;
  criarProcessos?: boolean;
  agora?: Date;
}

export interface ResultadoAplicacao {
  itensNovos: number;
  processosCriados: number;
  tarefasCriadas: number;
  processosEmTriagem: number[];
}

/** Data de hoje em Brasília (`yyyy-mm-dd`); o Brasil não tem horário de verão. */
export function hojeBrasil(agora = new Date()): string {
  return new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * OABs que a firma acompanha: as dos usuários (profiles.oab_numero) mais
 * `firms.oabs_monitoradas`, sem repetidos. O usuário prevalece quando a mesma
 * OAB aparece nos dois lugares — é ele quem recebe a tarefa.
 */
export async function oabsDaFirma(firmId: string): Promise<{ oabs: OabAcompanhada[]; feriados: Feriado[] }> {
  const [firma] = await db
    .select({ oabsMonitoradas: firms.oabsMonitoradas, feriados: firms.feriados })
    .from(firms)
    .where(eq(firms.id, firmId));
  if (!firma) throw new Error(`Firma ${firmId} não existe.`);

  const usuarios = await db
    .select({ id: profiles.id, nome: profiles.nome, oabNumero: profiles.oabNumero, oabUf: profiles.oabUf })
    .from(profiles)
    .where(and(eq(profiles.firmId, firmId), eq(profiles.ativo, true)));

  const porChave = new Map<string, OabAcompanhada>();
  for (const u of usuarios) {
    if (!u.oabNumero || !u.oabUf) continue;
    const chave = chaveOab(u.oabNumero, u.oabUf);
    porChave.set(chave, { numero: chave.split(':')[1], uf: u.oabUf.toUpperCase(), nome: u.nome, usuarioId: u.id });
  }
  for (const o of firma.oabsMonitoradas ?? []) {
    if (!o?.numero || !o.uf) continue;
    const chave = chaveOab(o.numero, o.uf);
    if (!porChave.has(chave)) porChave.set(chave, { numero: chave.split(':')[1], uf: o.uf.toUpperCase(), nome: o.nome });
  }
  return { oabs: [...porChave.values()], feriados: firma.feriados ?? [] };
}

/**
 * Uma rodada completa do DJEN para a firma: busca por OAB, dedupe, gravação,
 * vínculo/criação de processos, tarefas de prazo — tudo registrado em
 * `sync_runs`. Nunca lança por causa do DJEN: 403 vira `GEOBLOQUEADO`, o resto
 * vira `ERRO` com mensagem. É o mesmo caminho para o botão manual e para o job
 * agendado (fase 2).
 */
export async function sincronizarIntimacoes(opts: OpcoesSyncDjen): Promise<ResultadoSyncDjen> {
  const agora = opts.agora ?? new Date();
  const fim = opts.fim ?? hojeBrasil(agora);
  const inicio = opts.inicio ?? paraISO(new Date(Date.parse(fim) - (opts.dias ?? 3) * 86_400_000));
  const { firmId } = opts;

  // Uma rodada por firma de cada vez: o job e o botão podem coincidir.
  const [emAndamento] = await db
    .select({ id: syncRuns.id })
    .from(syncRuns)
    .where(
      and(
        eq(syncRuns.firmId, firmId),
        eq(syncRuns.tipo, 'DJEN'),
        eq(syncRuns.status, 'EXECUTANDO'),
        gt(syncRuns.iniciadoEm, new Date(agora.getTime() - 30 * 60_000)),
      ),
    )
    .limit(1);
  if (emAndamento) {
    return {
      runId: emAndamento.id,
      status: 'ERRO',
      itensLidos: 0,
      itensNovos: 0,
      processosCriados: 0,
      tarefasCriadas: 0,
      processosEmTriagem: [],
      mensagem: 'Já existe uma sincronização do DJEN em andamento para esta firma.',
    };
  }

  const { oabs, feriados } = await oabsDaFirma(firmId);
  const [run] = await db
    .insert(syncRuns)
    .values({
      firmId,
      tipo: 'DJEN',
      status: 'EXECUTANDO',
      iniciadoEm: agora,
      janelaInicio: inicio,
      janelaFim: fim,
      detalhes: { oabs: oabs.map((o) => `${o.uf} ${o.numero}`) },
    })
    .returning({ id: syncRuns.id });

  const finalizar = async (
    status: ResultadoSyncDjen['status'],
    dados: Partial<ResultadoAplicacao> & { itensLidos?: number; mensagem?: string | null; detalhes?: Record<string, unknown> },
  ): Promise<ResultadoSyncDjen> => {
    const detalhesAtuais = { oabs: oabs.map((o) => `${o.uf} ${o.numero}`), ...(dados.detalhes ?? {}) };
    await db
      .update(syncRuns)
      .set({
        status,
        finalizadoEm: new Date(),
        itensLidos: dados.itensLidos ?? 0,
        itensNovos: dados.itensNovos ?? 0,
        processosCriados: dados.processosCriados ?? 0,
        tarefasCriadas: dados.tarefasCriadas ?? 0,
        mensagem: dados.mensagem ?? null,
        detalhes: detalhesAtuais,
      })
      .where(and(eq(syncRuns.id, run.id), eq(syncRuns.firmId, firmId)));
    return {
      runId: run.id,
      status,
      itensLidos: dados.itensLidos ?? 0,
      itensNovos: dados.itensNovos ?? 0,
      processosCriados: dados.processosCriados ?? 0,
      tarefasCriadas: dados.tarefasCriadas ?? 0,
      processosEmTriagem: dados.processosEmTriagem ?? [],
      mensagem: dados.mensagem ?? null,
    };
  };

  if (oabs.length === 0) {
    return finalizar('ERRO', { mensagem: 'Nenhuma OAB configurada: cadastre em Usuários (OAB) ou em Configurações → OABs monitoradas.' });
  }

  const brutos: DjenItem[] = [];
  try {
    for (const oab of oabs) {
      brutos.push(...(await opts.client.coletarPorOab({ numero: oab.numero, uf: oab.uf }, { inicio, fim })));
    }
  } catch (err) {
    if (err instanceof DjenError && err.tipo === 'geobloqueado') {
      return finalizar('GEOBLOQUEADO', {
        itensLidos: brutos.length,
        mensagem:
          'O DJEN só responde a IPs brasileiros e recusou a consulta (403). Na produção, verifique o túnel VPN do roteador (skill hp-proxmox).',
      });
    }
    console.error('[DJEN] falha na consulta:', err);
    return finalizar('ERRO', { itensLidos: brutos.length, mensagem: (err as Error).message });
  }

  const itens = dedupePorId(brutos);
  try {
    const r = await aplicarItens(itens, { firmId, oabs, feriados, datajud: opts.datajud, criarProcessos: opts.criarProcessos, agora });
    const porTribunal: Record<string, number> = {};
    for (const it of itens) porTribunal[it.siglaTribunal] = (porTribunal[it.siglaTribunal] ?? 0) + 1;
    return finalizar('SUCESSO', { ...r, itensLidos: brutos.length, detalhes: { distintos: itens.length, porTribunal } });
  } catch (err) {
    console.error('[DJEN] falha ao gravar intimações:', err);
    return finalizar('ERRO', { itensLidos: brutos.length, mensagem: `Falha ao gravar as intimações: ${(err as Error).message}` });
  }
}

/**
 * Persiste itens já buscados (e já sem repetidos). Idempotente: upsert por
 * (firm_id, external_id); só itens novos criam processo e tarefa.
 *
 * 1. Grava/atualiza cada intimação.
 * 2. Vincula por número CNJ a processos existentes (inclusive intimações
 *    antigas cujo processo foi cadastrado depois).
 * 3. Processo desconhecido — o caso normal (82% na amostra) — vira um
 *    `processo_judicial` em TRIAGEM sem cliente; o Datajud preenche o resto.
 * 4. Intimação nova que abre prazo vira tarefa para o advogado destinatário.
 */
export async function aplicarItens(itens: DjenItem[], ctx: ContextoAplicacao): Promise<ResultadoAplicacao> {
  const { firmId } = ctx;
  const agora = ctx.agora ?? new Date();
  const criarProcessos = ctx.criarProcessos ?? true;
  const oabsFirma = new Set(ctx.oabs.map((o) => chaveOab(o.numero, o.uf)));
  const usuarioPorOab = new Map(ctx.oabs.filter((o) => o.usuarioId).map((o) => [chaveOab(o.numero, o.uf), o.usuarioId!]));

  // Quem recebe a tarefa quando nenhum destinatário é usuário do app.
  const [responsavelPadrao] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.firmId, firmId), eq(profiles.ativo, true), eq(profiles.perfil, 'admin')))
    .orderBy(profiles.createdAt)
    .limit(1);

  const resultado: ResultadoAplicacao = { itensNovos: 0, processosCriados: 0, tarefasCriadas: 0, processosEmTriagem: [] };
  if (itens.length === 0) return resultado;

  const criados: number[] = await db.transaction(async (tx) => {
    // 1. Upsert das intimações, da mais antiga para a mais nova.
    const ordenados = [...itens].sort((a, b) => a.data_disponibilizacao.localeCompare(b.data_disponibilizacao) || a.id - b.id);
    const novos: Array<{ id: number; item: DjenItem; oabsAlvo: string[] }> = [];
    for (const item of ordenados) {
      const advogados = advogadosDoItem(item);
      const oabsAlvo = advogados.map((a) => `${a.uf}:${a.numero}`).filter((c) => oabsFirma.has(c));
      const plano = textoPlano(item.texto);
      const valores = {
        firmId,
        externalId: `djen:${item.id}`,
        hash: item.hash ?? null,
        numeroProcesso: somenteDigitos(item.numero_processo ?? ''),
        siglaTribunal: item.siglaTribunal ?? '',
        tipoComunicacao: item.tipoComunicacao ?? '',
        tipoDocumento: item.tipoDocumento ?? null,
        nomeOrgao: item.nomeOrgao ?? null,
        idOrgao: item.idOrgao ?? null,
        nomeClasse: item.nomeClasse ?? null,
        codigoClasse: item.codigoClasse ?? null,
        textoHtml: item.texto ?? null,
        textoPlano: plano,
        link: item.link ?? null,
        meio: item.meio ?? null,
        dataDisponibilizacao: item.data_disponibilizacao,
        destinatarios: destinatariosDoItem(item),
        advogados,
        oabsAlvo,
        ativo: item.ativo ?? true,
        motivoCancelamento: item.motivo_cancelamento ?? null,
        dataCancelamento: item.data_cancelamento ? item.data_cancelamento.slice(0, 10) : null,
        raw: item,
        updatedAt: agora,
      };
      const [linha] = await tx
        .insert(intimacoes)
        .values(valores)
        .onConflictDoUpdate({
          target: [intimacoes.firmId, intimacoes.externalId],
          // Só o que o tribunal pode mudar depois; lida/tarefa/prazo são nossos.
          set: {
            ativo: valores.ativo,
            motivoCancelamento: valores.motivoCancelamento,
            dataCancelamento: valores.dataCancelamento,
            textoHtml: valores.textoHtml,
            textoPlano: valores.textoPlano,
            link: valores.link,
            raw: valores.raw,
            updatedAt: agora,
          },
        })
        .returning({ id: intimacoes.id, inserida: sql<boolean>`(xmax = 0)` });
      if (linha.inserida) novos.push({ id: linha.id, item, oabsAlvo });
    }
    resultado.itensNovos = novos.length;

    // 2. Vínculo por número: cobre as recém-gravadas e as antigas sem processo.
    await vincularPorNumero(tx, firmId);

    // 3. Processos desconhecidos → TRIAGEM.
    const criadosAqui: number[] = [];
    if (criarProcessos && novos.length > 0) {
      const semProcesso = await tx
        .select({ numero: intimacoes.numeroProcesso })
        .from(intimacoes)
        .where(
          and(
            eq(intimacoes.firmId, firmId),
            sql`${intimacoes.processoJudicialId} IS NULL`,
            inArray(
              intimacoes.id,
              novos.map((n) => n.id),
            ),
          ),
        );
      const numeros = [...new Set(semProcesso.map((r) => r.numero))].filter((n) => validarNumeroCnj(n));
      for (const numero of numeros) {
        // O item mais recente daquele processo dá tribunal e órgão.
        const item = [...novos].reverse().find((n) => somenteDigitos(n.item.numero_processo) === numero)!.item;
        const [p] = await tx
          .insert(processosJudiciais)
          .values({
            firmId,
            clienteId: null,
            numero: formatarNumeroCnj(numero),
            dataCadastro: agora,
            justica: item.siglaTribunal ?? null,
            juizo: item.nomeOrgao ?? null,
            orgaoJulgador: item.nomeOrgao ?? null,
            situacao: 'TRIAGEM',
            createdAt: agora,
            updatedAt: agora,
          })
          .returning({ id: processosJudiciais.id });
        await tx
          .update(intimacoes)
          .set({ processoJudicialId: p.id, updatedAt: agora })
          .where(and(eq(intimacoes.firmId, firmId), eq(intimacoes.numeroProcesso, numero), sql`${intimacoes.processoJudicialId} IS NULL`));
        criadosAqui.push(p.id);
      }
    }

    // 4. Tarefas de prazo para as intimações novas que abrem prazo.
    for (const { id, item, oabsAlvo } of novos) {
      if (item.ativo === false || ehInformativa(item)) continue;
      const regra = prazoSugerido(item);
      if (!regra) continue;
      const prazo = calcularPrazo(item.data_disponibilizacao, regra.dias, { feriados: ctx.feriados });

      const [vinculo] = await tx
        .select({ processoId: intimacoes.processoJudicialId, clienteId: processosJudiciais.clienteId })
        .from(intimacoes)
        .leftJoin(processosJudiciais, eq(processosJudiciais.id, intimacoes.processoJudicialId))
        .where(and(eq(intimacoes.id, id), eq(intimacoes.firmId, firmId)));

      const usuarioId = oabsAlvo.map((c) => usuarioPorOab.get(c)).find(Boolean) ?? responsavelPadrao?.id ?? null;
      let tarefaId: number | null = null;
      if (usuarioId) {
        const [t] = await tx
          .insert(tarefas)
          .values({
            firmId,
            usuarioId,
            clienteId: vinculo?.clienteId ?? null,
            processoJudicialId: vinculo?.processoId ?? null,
            titulo: tituloTarefa(item),
            descricao: descricaoTarefa(item, regra.motivo, prazo, textoPlano(item.texto)),
            dataLimite: fimDoDiaBrasil(prazo.fim),
            prioridade: regra.dias <= 5 ? 'ALTA' : 'MEDIA',
            status: 'PENDENTE',
            createdAt: agora,
            updatedAt: agora,
          })
          .returning({ id: tarefas.id });
        tarefaId = t.id;
        resultado.tarefasCriadas++;
      }
      await tx
        .update(intimacoes)
        .set({ prazoDias: prazo.dias, prazoPublicacao: prazo.publicacao, prazoFim: prazo.fim, tarefaId, updatedAt: agora })
        .where(and(eq(intimacoes.id, id), eq(intimacoes.firmId, firmId)));
    }

    return criadosAqui;
  });

  resultado.processosCriados = criados.length;
  resultado.processosEmTriagem = criados;

  // Fora da transação: são chamadas de rede, uma por processo, com limitador.
  if (ctx.datajud && criados.length > 0) {
    const linhas = await db
      .select({
        id: processosJudiciais.id,
        firmId: processosJudiciais.firmId,
        numero: processosJudiciais.numero,
        juizo: processosJudiciais.juizo,
        justica: processosJudiciais.justica,
        orgaoJulgador: processosJudiciais.orgaoJulgador,
        comarca: processosJudiciais.comarca,
        situacao: processosJudiciais.situacao,
        distribuicao: processosJudiciais.distribuicao,
        dtArquivado: processosJudiciais.dtArquivado,
      })
      .from(processosJudiciais)
      .where(and(eq(processosJudiciais.firmId, firmId), inArray(processosJudiciais.id, criados)));
    for (const p of linhas) {
      try {
        await sincronizarProcesso(p, ctx.datajud, agora);
      } catch (err) {
        // Não derruba a rodada: o processo fica em TRIAGEM e o botão "Sincronizar" resolve depois.
        console.error(`[DJEN] Datajud falhou para o processo ${p.numero}:`, (err as Error).message);
      }
    }
  }

  return resultado;
}

type Executor = Pick<typeof db, 'execute'>;

/**
 * Liga intimações sem processo a `processos_judiciais` da mesma firma cujo
 * número, sem máscara, é o mesmo. Uma instrução só; roda a cada rodada.
 */
export async function vincularPorNumero(executor: Executor, firmId: string): Promise<void> {
  await executor.execute(sql`
    UPDATE intimacoes i
       SET processo_judicial_id = p.id, updated_at = now()
      FROM processos_judiciais p
     WHERE i.firm_id = ${firmId}
       AND p.firm_id = ${firmId}
       AND i.processo_judicial_id IS NULL
       AND regexp_replace(p.numero, '\\D', '', 'g') = i.numero_processo
  `);
}

function descricaoTarefa(item: DjenItem, motivo: string, prazo: { publicacao: string; fim: string; dias: number }, plano: string): string {
  const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  const partes = [
    `${motivo}.`,
    `Disponibilizada no DJEN em ${br(item.data_disponibilizacao)} · publicação ${br(prazo.publicacao)} · ${prazo.dias} dias úteis · termo final ${br(prazo.fim)}.`,
    `${item.siglaTribunal} · ${item.nomeOrgao ?? ''} · ${numeroExibicao(item)}`.trim(),
    '',
    resumoTexto(plano),
  ];
  if (item.link) partes.push('', `Íntegra: ${item.link}`);
  return partes.join('\n');
}
