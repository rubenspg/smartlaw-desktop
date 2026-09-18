import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { andamentos, clientes, processoInstancias, processosJudiciais } from '../../db/schema';
import { criarFirma, limparBanco } from '../../../test/helpers';
import { DatajudClient } from './client';
import { sincronizarProcesso } from './sincronizar';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const respostaFixture = (nome: string) =>
  readFileSync(path.join(aqui, '../../../test/fixtures/datajud', nome), 'utf8');

/** Um `fetch` que devolve o fixture para qualquer `_search`, sem tocar a rede. */
function clientComFixture(nome: string | null, status = 200) {
  const fetchFn = (async () =>
    new Response(nome ? respostaFixture(nome) : JSON.stringify({ took: 1, hits: { total: { value: 0 }, hits: [] } }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })) as unknown as typeof fetch;
  return new DatajudClient({ apiKey: 'teste', fetchFn, minIntervalMs: 0 });
}

async function criarProcesso(firmId: string, numero: string, extra: Partial<typeof processosJudiciais.$inferInsert> = {}) {
  const [cli] = await db.insert(clientes).values({ firmId, tipo: 'F', nome: 'Cliente' }).returning();
  const [p] = await db
    .insert(processosJudiciais)
    .values({ firmId, clienteId: cli.id, numero, ...extra })
    .returning();
  return p;
}

const NUMERO = '5019210-08.2021.4.04.7100';
const FIXTURE = 'trf4-5019210-08.2021.4.04.7100.json';
// O documento G1 traz 116 movimentos, mas 3 são cópias exatas (mesmo código,
// instante, nome e complementos — "Expedida/certificada" repetida pelo eproc).
// A chave por conteúdo os funde de propósito: 113 + 6 = 119 andamentos.
const DISTINTOS = 113 + 6;

describe('sincronizarProcesso', () => {
  beforeEach(limparBanco);

  it('grava uma instância por documento e um andamento por movimento', async () => {
    const firma = await criarFirma();
    const p = await criarProcesso(firma.id, NUMERO);

    const r = await sincronizarProcesso(p, clientComFixture(FIXTURE));

    expect(r.encontrado).toBe(true);
    expect(r.instancias).toBe(2);
    expect(r.newMovements).toBe(DISTINTOS);

    const inst = await db.query.processoInstancias.findMany({
      where: eq(processoInstancias.processoJudicialId, p.id),
      orderBy: (t, { asc }) => [asc(t.grauOrdem)],
    });
    expect(inst.map((i) => i.grau)).toEqual(['G1', 'G2']);
    expect(inst[0].totalMovimentos).toBe(116); // contagem bruta do tribunal
    expect(inst[0].datajudDocId).toBe('TRF4_G1_50192100820214047100');

    const ands = await db.query.andamentos.findMany({ where: eq(andamentos.processoJudicialId, p.id) });
    expect(ands).toHaveLength(DISTINTOS);
    expect(ands.every((a) => a.tipo === 'DATAJUD' && a.externalId?.startsWith('datajud:'))).toBe(true);
    expect(ands.filter((a) => a.instanciaId === inst[1].id)).toHaveLength(6);
  });

  it('é idempotente: a segunda rodada não insere nada', async () => {
    const firma = await criarFirma();
    const p = await criarProcesso(firma.id, NUMERO);
    await sincronizarProcesso(p, clientComFixture(FIXTURE));

    const r2 = await sincronizarProcesso(p, clientComFixture(FIXTURE));
    expect(r2.newMovements).toBe(0);
    expect(r2.instancias).toBe(2);
    const ands = await db.query.andamentos.findMany({ where: eq(andamentos.processoJudicialId, p.id) });
    expect(ands).toHaveLength(DISTINTOS);
    const inst = await db.query.processoInstancias.findMany({ where: eq(processoInstancias.processoJudicialId, p.id) });
    expect(inst).toHaveLength(2);
  });

  it('preenche só os campos vazios e nunca sobrescreve o cadastro', async () => {
    const firma = await criarFirma();
    const p = await criarProcesso(firma.id, NUMERO, { justica: 'Federal', situacao: null, juizo: null });

    const r = await sincronizarProcesso(p, clientComFixture(FIXTURE));

    const [dep] = await db.select().from(processosJudiciais).where(eq(processosJudiciais.id, p.id));
    expect(dep.justica).toBe('Federal'); // preservado
    expect(dep.juizo).toBeTruthy(); // preenchido a partir da origem (G1)
    expect(dep.situacao).toBe('ATIVO');
    expect(dep.distribuicao?.toISOString()).toBe('2021-04-21T18:59:53.000Z'); // dataAjuizamento do G1
    expect(dep.lastSync).not.toBeNull();
    // 'Federal' ≠ 'TRF4' é divergência, não erro.
    expect(dep.syncStatus).toBe('DIVERGENTE');
    expect(r.fields.map((f) => f.field)).toContain('justica');
  });

  it('marca NAO_ENCONTRADO quando o Datajud não tem o processo', async () => {
    const firma = await criarFirma();
    const p = await criarProcesso(firma.id, NUMERO);

    const r = await sincronizarProcesso(p, clientComFixture(null));
    expect(r.encontrado).toBe(false);
    const [dep] = await db.select().from(processosJudiciais).where(eq(processosJudiciais.id, p.id));
    expect(dep.syncStatus).toBe('NAO_ENCONTRADO');
    expect(await db.query.andamentos.findMany({ where: eq(andamentos.processoJudicialId, p.id) })).toHaveLength(0);
  });

  it('duas firmas com o mesmo processo não colidem em external_id', async () => {
    const a = await criarFirma('Firma A');
    const b = await criarFirma('Firma B');
    const pa = await criarProcesso(a.id, NUMERO);
    const pb = await criarProcesso(b.id, NUMERO);

    await sincronizarProcesso(pa, clientComFixture(FIXTURE));
    const rb = await sincronizarProcesso(pb, clientComFixture(FIXTURE));

    expect(rb.newMovements).toBe(DISTINTOS);
    const deB = await db.query.andamentos.findMany({
      where: and(eq(andamentos.firmId, b.id), eq(andamentos.processoJudicialId, pb.id)),
    });
    expect(deB).toHaveLength(DISTINTOS);
  });
});
