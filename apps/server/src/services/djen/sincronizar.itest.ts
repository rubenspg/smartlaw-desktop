import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { firms, intimacoes, processosJudiciais, profiles, syncRuns, tarefas } from '../../db/schema';
import { criarFirma, criarUsuario, limparBanco } from '../../../test/helpers';
import { DatajudClient } from '../datajud/client';
import { formatarNumeroCnj, validarNumeroCnj } from '../datajud/cnj';
import { DjenClient } from './client';
import { dedupePorId, ehInformativa, prazoSugerido } from './normalizar';
import { calcularPrazo, fimDoDiaBrasil } from './prazos';
import { sincronizarIntimacoes } from './sincronizar';
import type { DjenItem, DjenResposta } from './types';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const pastaFixtures = path.join(aqui, '../../../test/fixtures/djen');
const fixture = (nome: string): DjenResposta => JSON.parse(readFileSync(path.join(pastaFixtures, nome), 'utf8'));

// Os três advogados da firma (confirmados 2026-09-18); os fixtures são as
// respostas reais do DJEN para cada OAB, com as partes anonimizadas.
const OABS = [
  { numero: '62492', uf: 'RS', nome: 'Rafael Plentz Gonçalves' },
  { numero: '55817', uf: 'RS', nome: 'Mauricio Ferron' },
  { numero: '127837', uf: 'RS', nome: 'Maria Eduarda Girelli Gonçalves' },
];
const FERIADOS_RS = [
  { data: '02-02', nome: 'Nossa Senhora dos Navegantes (Porto Alegre)' },
  { data: '09-20', nome: 'Revolução Farroupilha (RS)' },
];

/** `fetch` falso: serve o fixture da OAB pedida na página 1 e nada nas seguintes. */
function clientComFixtures(status = 200) {
  const fetchFn = (async (input: RequestInfo | URL) => {
    if (status !== 200) return new Response('Forbidden', { status });
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const oab = url.searchParams.get('numeroOab') ?? '';
    const pagina = url.searchParams.get('pagina') ?? '1';
    const arquivo = path.join(pastaFixtures, `oab-${oab}.json`);
    const items = pagina === '1' && existsSync(arquivo) ? fixture(`oab-${oab}.json`).items : [];
    return new Response(JSON.stringify({ status: 'success', count: items.length, items }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return new DjenClient({ fetchFn, minIntervalMs: 0 });
}

/** Datajud falso que nunca encontra nada: basta para provar que o sync foi chamado. */
function datajudVazio() {
  const fetchFn = (async () =>
    new Response(JSON.stringify({ took: 1, hits: { total: { value: 0 }, hits: [] } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as unknown as typeof fetch;
  return new DatajudClient({ apiKey: 'teste', fetchFn, minIntervalMs: 0 });
}

const TODOS: DjenItem[] = dedupePorId(
  ['oab-62492.json', 'oab-55817.json', 'oab-127837.json'].flatMap((f) => fixture(f).items),
);
const NUMEROS = [...new Set(TODOS.map((i) => i.numero_processo))].filter(validarNumeroCnj);
const COM_PRAZO = TODOS.filter((i) => i.ativo !== false && !ehInformativa(i) && prazoSugerido(i));
const SO_55817 = 719954197; // único item que não é endereçado ao 62492

async function firmaPronta(nome = 'Escritório Teste') {
  const firma = await criarFirma(nome);
  await db.update(firms).set({ oabsMonitoradas: OABS, feriados: FERIADOS_RS }).where(eq(firms.id, firma.id));
  const admin = await criarUsuario({ firmId: firma.id, email: `admin@${nome.replace(/\W/g, '')}.local`, perfil: 'admin', nome: 'Admin' });
  const rafael = await criarUsuario({ firmId: firma.id, email: `rafael@${nome.replace(/\W/g, '')}.local`, nome: 'Rafael' });
  await db.update(profiles).set({ oabNumero: '62492', oabUf: 'RS' }).where(eq(profiles.id, rafael.id));
  return { firma, admin, rafael };
}

const JANELA = { inicio: '2026-08-01', fim: '2026-09-18', agora: new Date('2026-09-18T20:00:00Z') };

describe('sincronizarIntimacoes', () => {
  beforeEach(limparBanco);

  it('grava, deduplica entre OABs, vincula, cria TRIAGEM e tarefas', async () => {
    const { firma, admin, rafael } = await firmaPronta();
    // Um processo já cadastrado, com máscara — deve ser vinculado, não criado.
    const existente = TODOS.find((i) => i.id !== SO_55817)!;
    const [pExistente] = await db
      .insert(processosJudiciais)
      .values({ firmId: firma.id, numero: formatarNumeroCnj(existente.numero_processo), situacao: 'ATIVO' })
      .returning();

    const r = await sincronizarIntimacoes({ firmId: firma.id, client: clientComFixtures(), ...JANELA });

    expect(r.status).toBe('SUCESSO');
    expect(r.itensLidos).toBe(31 + 31 + 3); // uma consulta por OAB, sem dedupe
    expect(r.itensNovos).toBe(TODOS.length); // 32: os sócios compartilham quase tudo
    expect(r.processosCriados).toBe(NUMEROS.length - 1);
    expect(r.processosEmTriagem).toHaveLength(NUMEROS.length - 1);
    expect(r.tarefasCriadas).toBe(COM_PRAZO.length);

    const linhas = await db.query.intimacoes.findMany({ where: eq(intimacoes.firmId, firma.id) });
    expect(linhas).toHaveLength(TODOS.length);
    expect(linhas.every((l) => l.processoJudicialId !== null)).toBe(true);
    expect(linhas.every((l) => l.numeroProcesso.length === 20)).toBe(true);
    expect(linhas.every((l) => l.textoPlano && !/<[a-z]+>/i.test(l.textoPlano))).toBe(true);

    const vinculada = linhas.find((l) => l.externalId === `djen:${existente.id}`)!;
    expect(vinculada.processoJudicialId).toBe(pExistente.id);

    const triagem = await db.query.processosJudiciais.findMany({
      where: and(eq(processosJudiciais.firmId, firma.id), eq(processosJudiciais.situacao, 'TRIAGEM')),
    });
    expect(triagem).toHaveLength(NUMEROS.length - 1);
    expect(triagem.every((p) => p.clienteId === null && /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(p.numero))).toBe(true);
    expect(triagem.every((p) => p.justica && p.juizo)).toBe(true);

    // Tarefa vai para o usuário cuja OAB está no item; sem usuário, para o admin.
    const doRafael = linhas.find((l) => l.oabsAlvo.includes('RS:62492') && l.tarefaId)!;
    const [t1] = await db.select().from(tarefas).where(eq(tarefas.id, doRafael.tarefaId!));
    expect(t1.usuarioId).toBe(rafael.id);
    expect(t1.processoJudicialId).toBe(doRafael.processoJudicialId);
    expect(t1.status).toBe('PENDENTE');
    expect(t1.titulo).toMatch(/^(Intimação|Citação) — .+ — \d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/);

    const soMauricio = linhas.find((l) => l.externalId === `djen:${SO_55817}`)!;
    expect(soMauricio.oabsAlvo).toEqual(['RS:55817']);
    if (soMauricio.tarefaId) {
      const [t2] = await db.select().from(tarefas).where(eq(tarefas.id, soMauricio.tarefaId));
      expect(t2.usuarioId).toBe(admin.id);
    }

    const [run] = await db.select().from(syncRuns).where(eq(syncRuns.firmId, firma.id));
    expect(run.status).toBe('SUCESSO');
    expect(run.itensNovos).toBe(TODOS.length);
    expect(run.finalizadoEm).not.toBeNull();
    expect((run.detalhes as { porTribunal: Record<string, number> }).porTribunal.TRF4).toBeGreaterThan(0);
  });

  it('é idempotente: a segunda rodada não grava nada', async () => {
    const { firma } = await firmaPronta();
    await sincronizarIntimacoes({ firmId: firma.id, client: clientComFixtures(), ...JANELA });

    const r2 = await sincronizarIntimacoes({ firmId: firma.id, client: clientComFixtures(), ...JANELA });

    expect(r2.status).toBe('SUCESSO');
    expect(r2.itensNovos).toBe(0);
    expect(r2.processosCriados).toBe(0);
    expect(r2.tarefasCriadas).toBe(0);
    expect(await db.$count(intimacoes, eq(intimacoes.firmId, firma.id))).toBe(TODOS.length);
    expect(await db.$count(tarefas, eq(tarefas.firmId, firma.id))).toBe(COM_PRAZO.length);
    expect(await db.$count(processosJudiciais, eq(processosJudiciais.firmId, firma.id))).toBe(NUMEROS.length);
    expect(await db.$count(syncRuns, eq(syncRuns.firmId, firma.id))).toBe(2);
  });

  it('calcula o prazo com o calendário da firma e agenda a tarefa no termo final', async () => {
    const { firma } = await firmaPronta();
    await sincronizarIntimacoes({ firmId: firma.id, client: clientComFixtures(), ...JANELA });

    const atos = TODOS.filter((i) => i.tipoComunicacao === 'Intimação' && i.tipoDocumento === 'Ato ordinatório');
    expect(atos.length).toBeGreaterThan(0);
    for (const item of atos) {
      const [l] = await db.select().from(intimacoes).where(and(eq(intimacoes.firmId, firma.id), eq(intimacoes.externalId, `djen:${item.id}`)));
      const esperado = calcularPrazo(item.data_disponibilizacao, 5, { feriados: FERIADOS_RS });
      expect(l.prazoDias).toBe(5);
      expect(l.prazoPublicacao).toBe(esperado.publicacao);
      expect(l.prazoFim).toBe(esperado.fim);
      const [t] = await db.select().from(tarefas).where(eq(tarefas.id, l.tarefaId!));
      expect(t.dataLimite?.toISOString()).toBe(fimDoDiaBrasil(esperado.fim).toISOString());
      expect(t.prioridade).toBe('ALTA');
      expect(t.descricao).toContain('218');
    }

    // 07/09/2026 é feriado: a publicação é dia 08.
    const noFeriado = TODOS.find((i) => i.data_disponibilizacao === '2026-09-07' && !ehInformativa(i));
    if (noFeriado) {
      const [l] = await db.select().from(intimacoes).where(and(eq(intimacoes.firmId, firma.id), eq(intimacoes.externalId, `djen:${noFeriado.id}`)));
      expect(l.prazoPublicacao).toBe('2026-09-08');
    }
  });

  it('informativas são guardadas sem prazo nem tarefa', async () => {
    const { firma } = await firmaPronta();
    await sincronizarIntimacoes({ firmId: firma.id, client: clientComFixtures(), ...JANELA });

    const informativas = TODOS.filter(ehInformativa);
    expect(informativas.length).toBeGreaterThan(0);
    for (const item of informativas) {
      const [l] = await db.select().from(intimacoes).where(and(eq(intimacoes.firmId, firma.id), eq(intimacoes.externalId, `djen:${item.id}`)));
      expect(l).toBeDefined();
      expect(l.tarefaId).toBeNull();
      expect(l.prazoDias).toBeNull();
    }
  });

  it('403 termina como GEOBLOQUEADO, nunca como sucesso com zero itens', async () => {
    const { firma } = await firmaPronta();

    const r = await sincronizarIntimacoes({ firmId: firma.id, client: clientComFixtures(403), ...JANELA });

    expect(r.status).toBe('GEOBLOQUEADO');
    expect(r.mensagem).toMatch(/403/);
    expect(r.mensagem).toMatch(/roteador/);
    const [run] = await db.select().from(syncRuns).where(eq(syncRuns.firmId, firma.id));
    expect(run.status).toBe('GEOBLOQUEADO');
    expect(await db.$count(intimacoes, eq(intimacoes.firmId, firma.id))).toBe(0);
  });

  it('sem OAB configurada a rodada falha com instrução, sem consultar o DJEN', async () => {
    const firma = await criarFirma();
    const r = await sincronizarIntimacoes({ firmId: firma.id, client: clientComFixtures(403), ...JANELA });
    expect(r.status).toBe('ERRO');
    expect(r.mensagem).toMatch(/OAB/);
  });

  it('não roda duas vezes ao mesmo tempo para a mesma firma', async () => {
    const { firma } = await firmaPronta();
    await db.insert(syncRuns).values({ firmId: firma.id, tipo: 'DJEN', status: 'EXECUTANDO', iniciadoEm: JANELA.agora });

    const r = await sincronizarIntimacoes({ firmId: firma.id, client: clientComFixtures(), ...JANELA });

    expect(r.status).toBe('ERRO');
    expect(r.mensagem).toMatch(/em andamento/);
    expect(await db.$count(syncRuns, eq(syncRuns.firmId, firma.id))).toBe(1);
  });

  it('com criarProcessos=false a intimação fica sem vínculo e é ligada quando o processo aparece', async () => {
    const { firma } = await firmaPronta();
    const r1 = await sincronizarIntimacoes({ firmId: firma.id, client: clientComFixtures(), criarProcessos: false, ...JANELA });
    expect(r1.processosCriados).toBe(0);
    expect(r1.tarefasCriadas).toBe(COM_PRAZO.length); // a tarefa existe mesmo sem processo
    const antes = await db.query.intimacoes.findMany({ where: eq(intimacoes.firmId, firma.id) });
    expect(antes.every((l) => l.processoJudicialId === null)).toBe(true);

    const alvo = TODOS[0];
    const [p] = await db
      .insert(processosJudiciais)
      .values({ firmId: firma.id, numero: formatarNumeroCnj(alvo.numero_processo) })
      .returning();
    const r2 = await sincronizarIntimacoes({ firmId: firma.id, client: clientComFixtures(), ...JANELA });
    expect(r2.itensNovos).toBe(0);

    const [l] = await db.select().from(intimacoes).where(and(eq(intimacoes.firmId, firma.id), eq(intimacoes.externalId, `djen:${alvo.id}`)));
    expect(l.processoJudicialId).toBe(p.id);
  });

  it('com um client do Datajud, cada processo em TRIAGEM é sincronizado na hora', async () => {
    const { firma } = await firmaPronta();
    const r = await sincronizarIntimacoes({ firmId: firma.id, client: clientComFixtures(), datajud: datajudVazio(), ...JANELA });
    expect(r.processosCriados).toBeGreaterThan(0);

    const triagem = await db.query.processosJudiciais.findMany({ where: eq(processosJudiciais.firmId, firma.id) });
    expect(triagem.every((p) => p.lastSync !== null && p.syncStatus === 'NAO_ENCONTRADO')).toBe(true);
    expect(triagem.every((p) => p.situacao === 'TRIAGEM')).toBe(true);
  });

  it('duas firmas com os mesmos advogados não colidem', async () => {
    const a = await firmaPronta('Firma A');
    const b = await firmaPronta('Firma B');
    await sincronizarIntimacoes({ firmId: a.firma.id, client: clientComFixtures(), ...JANELA });
    const rb = await sincronizarIntimacoes({ firmId: b.firma.id, client: clientComFixtures(), ...JANELA });

    expect(rb.itensNovos).toBe(TODOS.length);
    expect(await db.$count(intimacoes, eq(intimacoes.firmId, a.firma.id))).toBe(TODOS.length);
    expect(await db.$count(intimacoes, eq(intimacoes.firmId, b.firma.id))).toBe(TODOS.length);
    expect(await db.$count(processosJudiciais, eq(processosJudiciais.firmId, b.firma.id))).toBe(NUMEROS.length);
  });
});
