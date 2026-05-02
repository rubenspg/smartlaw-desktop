import { Hono } from 'hono';
import { db } from '../db';
import { processosJudiciais, clientes, andamentos } from '../db/schema';
import { eq, and, ilike, or, desc } from 'drizzle-orm';
import { authMiddleware, Variables } from '../middleware/auth';
import { DatajudService } from '../services/DatajudService';
import { ComparisonService } from '../services/ComparisonService';
import { processoJudicialSchema } from '@smartlaw/shared';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

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
    const { q, page = '1', limit = '10', clienteId } = c.req.valid('query');

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 10);
    const offset = (pageNum - 1) * limitNum;

    // Use .select() when q is provided to support searching by client name
    if (q) {
      const where = [eq(processosJudiciais.firmId, user.firmId)];
      where.push(or(
        ilike(processosJudiciais.numero, `%${q}%`),
        ilike(clientes.nome, `%${q}%`)
      )!);

      if (clienteId) {
        where.push(eq(processosJudiciais.clienteId, parseInt(clienteId)));
      }

      const data = await db
        .select({
          id: processosJudiciais.id,
          numero: processosJudiciais.numero,
          situacao: processosJudiciais.situacao,
          lastSync: processosJudiciais.lastSync,
          syncStatus: processosJudiciais.syncStatus,
          createdAt: processosJudiciais.createdAt,
          cliente: {
            id: clientes.id,
            nome: clientes.nome,
          }
        })
        .from(processosJudiciais)
        .leftJoin(clientes, eq(processosJudiciais.clienteId, clientes.id))
        .where(and(...where))
        .limit(limitNum)
        .offset(offset)
        .orderBy(desc(processosJudiciais.createdAt));

      return c.json(data);
    }

    // Use db.query for cleaner relation handling when no complex search is needed
    const data = await db.query.processosJudiciais.findMany({
      where: (processos, { eq, and }) => {
        const conditions = [eq(processos.firmId, user.firmId)];
        if (clienteId) {
          conditions.push(eq(processos.clienteId, parseInt(clienteId)));
        }
        return and(...conditions);
      },
      with: {
        cliente: true,
      },
      limit: limitNum,
      offset: offset,
      orderBy: [desc(processosJudiciais.createdAt)],
    });

    return c.json(data);
  })

  .get('/:id', async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

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
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);
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
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

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
    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
    const numero = (rawBody as Record<string, unknown>)?.numero;
    if (!numero || typeof numero !== 'string') return c.json({ error: 'Número é obrigatório' }, 400);

    try {
      const source = await DatajudService.fetchFromDatajud(numero);
      return c.json({ data: { hits: { hits: source ? [{ _source: source }] : [] } } });
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  })

  .post('/:id/sync', async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    try {
      const local = await db.query.processosJudiciais.findFirst({
        where: and(eq(processosJudiciais.id, id), eq(processosJudiciais.firmId, user.firmId)),
        with: {
          andamentos: true
        }
      });

      if (!local) return c.json({ error: 'Processo não encontrado' }, 404);

      const remote = await DatajudService.fetchFromDatajud(local.numero);
      if (!remote) return c.json({ error: 'Processo não encontrado no Datajud' }, 404);

      const drift = ComparisonService.checkDrift(local, remote);

      await db.update(processosJudiciais)
        .set({
          lastSync: new Date(),
          syncStatus: drift.hasDrift ? 'DIVERGENTE' : 'SUCESSO',
          datajudRaw: remote as any
        })
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
      return c.json({ error: 'Erro ao sincronizar: ' + err.message }, 500);
    }
  });

export default processosJudiciaisRoutes;
