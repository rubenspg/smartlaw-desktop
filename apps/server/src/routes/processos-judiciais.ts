import { Hono } from 'hono';
import { db } from '../db';
import { processosJudiciais, clientes, andamentos, firms } from '../db/schema';
import { eq, and, ilike, or, desc, sql } from 'drizzle-orm';
import { authMiddleware, Variables } from '../middleware/auth';
import { DatajudService } from '../services/DatajudService';
import { ComparisonService } from '../services/ComparisonService';
import { processoJudicialSchema } from '@smartlaw/shared';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { parseIdParam, parsePageParams, paginated } from '../utils';

const querySchema = z.object({
  q: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  clienteId: z.string().optional(),
});

const processosJudiciaisRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  
  .get('/', zValidator('query', querySchema), async (c) => {
    const user = c.get('user');
    const { q, page: pageParam, limit: limitParam, clienteId } = c.req.valid('query');
    const { page, limit, offset } = parsePageParams(pageParam, limitParam);

    // Single shape for the list regardless of whether a search term is present:
    // a narrow projection plus the client fields the list and WhatsApp action use.
    const where = [eq(processosJudiciais.firmId, user.firmId)];

    if (q) {
      const cleanQ = q.replace(/\D/g, '');
      const searchConditions = [
        ilike(processosJudiciais.numero, `%${q}%`),
        ilike(clientes.nome, `%${q}%`),
      ];
      if (cleanQ.length > 0) {
        searchConditions.push(sql`REPLACE(REPLACE(${processosJudiciais.numero}, '.', ''), '-', '') ILIKE ${`%${cleanQ}%`}`);
      }
      where.push(or(...searchConditions)!);
    }

    if (clienteId) {
      where.push(eq(processosJudiciais.clienteId, parseInt(clienteId)));
    }

    const [totalRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(processosJudiciais)
      .leftJoin(clientes, eq(processosJudiciais.clienteId, clientes.id))
      .where(and(...where));

    const data = await db
      .select({
        id: processosJudiciais.id,
        clienteId: processosJudiciais.clienteId,
        numero: processosJudiciais.numero,
        situacao: processosJudiciais.situacao,
        lastSync: processosJudiciais.lastSync,
        syncStatus: processosJudiciais.syncStatus,
        createdAt: processosJudiciais.createdAt,
        cliente: {
          id: clientes.id,
          nome: clientes.nome,
          celular: clientes.celular,
          telefone1: clientes.telefone1,
          telefone2: clientes.telefone2,
        },
      })
      .from(processosJudiciais)
      .leftJoin(clientes, eq(processosJudiciais.clienteId, clientes.id))
      .where(and(...where))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(processosJudiciais.createdAt));

    return c.json(paginated(data, Number(totalRow?.count ?? 0), page, limit));
  })

  .get('/:id', async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);

    const data = await db.query.processosJudiciais.findFirst({
      where: and(eq(processosJudiciais.id, id), eq(processosJudiciais.firmId, user.firmId)),
      with: {
        cliente: true,
        andamentos: {
          orderBy: [desc(andamentos.data)]
        },
        partes: {
          with: {
            posicao: true
          }
        }
      }
    });

    if (!data) return c.json({ error: 'Processo não encontrado' }, 404);
    return c.json(data);
  })

  .put('/:id', zValidator('json', processoJudicialSchema), async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);
    const data = c.req.valid('json');

    const [updatedProcesso] = await db
      .update(processosJudiciais)
      .set({
        ...data,
        distribuicao: data.distribuicao ? new Date(data.distribuicao) : null,
        updatedAt: new Date(),
      })
      .where(and(eq(processosJudiciais.id, id), eq(processosJudiciais.firmId, user.firmId)))
      .returning();

    if (!updatedProcesso) {
      return c.json({ error: 'Processo não encontrado' }, 404);
    }

    return c.json(updatedProcesso);
  })

  .delete('/:id', async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);

    const [deletedProcesso] = await db
      .delete(processosJudiciais)
      .where(and(eq(processosJudiciais.id, id), eq(processosJudiciais.firmId, user.firmId)))
      .returning();

    if (!deletedProcesso) {
      return c.json({ error: 'Processo não encontrado' }, 404);
    }

    return c.json({ message: 'Processo excluído com sucesso' });
  })

  .post('/', zValidator('json', processoJudicialSchema), async (c) => {
    const user = c.get('user');
    const data = c.req.valid('json');

    const [newProcesso] = await db
      .insert(processosJudiciais)
      .values({
        ...data,
        firmId: user.firmId,
        dataCadastro: new Date(),
        distribuicao: data.distribuicao ? new Date(data.distribuicao) : null,
      })
      .returning();

    return c.json(newProcesso, 201);
  })

  .post('/datajud/search', async (c) => {
    const user = c.get('user');
    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
    const numero = (rawBody as Record<string, unknown>)?.numero;
    if (!numero || typeof numero !== 'string') return c.json({ error: 'Número é obrigatório' }, 400);

    try {
      // Get firm specific API key
      const [firm] = await db.select({ key: firms.datajudApiKey }).from(firms).where(eq(firms.id, user.firmId)).limit(1);
      
      const source = await DatajudService.fetchFromDatajud(numero, firm?.key || undefined);
      return c.json({ data: { hits: { hits: source ? [{ _source: source }] : [] } } });
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  })

  .post('/:id/sync', async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);

    try {
      const local = await db.query.processosJudiciais.findFirst({
        where: and(eq(processosJudiciais.id, id), eq(processosJudiciais.firmId, user.firmId)),
        with: {
          andamentos: true
        }
      });

      if (!local) return c.json({ error: 'Processo não encontrado' }, 404);

      // Get firm specific API key
      const [firm] = await db.select({ key: firms.datajudApiKey }).from(firms).where(eq(firms.id, user.firmId)).limit(1);

      const remote = await DatajudService.fetchFromDatajud(local.numero, firm?.key || undefined);
      if (!remote) return c.json({ error: 'Processo não encontrado no Datajud' }, 404);

      const drift = ComparisonService.checkDrift(local, remote);

      // Update basic fields if they are missing
      const updateData: any = {
        lastSync: new Date(),
        syncStatus: drift.hasDrift ? 'DIVERGENTE' : 'SUCESSO',
        datajudRaw: remote as any
      };

      if (!local.juizo && remote.orgaoJulgador?.nome) updateData.juizo = remote.orgaoJulgador.nome;
      if (!local.justica && remote.tribunal) updateData.justica = remote.tribunal;
      
      // Update situacao based on latest movement if it's currently empty/NA
      if ((!local.situacao || local.situacao === 'N/A') && remote.movimentos && remote.movimentos.length > 0) {
        updateData.situacao = remote.movimentos[0].nome;
      }

      await db.update(processosJudiciais)
        .set(updateData)
        .where(eq(processosJudiciais.id, id));

      if (drift.newMovements > 0) {
        await db.insert(andamentos).values({
          data: new Date(),
          inclusao: new Date(),
          tipo: 'SISTEMA',
          historico: `Sincronização Datajud: detectadas ${drift.newMovements} novas movimentações no tribunal.`,
          processoJudicialId: id,
          firmId: user.firmId,
        });
      }

      return c.json({ 
        success: true, 
        hasDrift: drift.hasDrift, 
        fields: drift.fields,
        newMovements: drift.newMovements 
      });
    } catch (err: any) {
      console.error('Sync Error:', err);
      return c.json({ error: 'Erro ao sincronizar: ' + err.message }, 500);
    }
  });

export default processosJudiciaisRoutes;
