import { Hono } from 'hono';
import { db } from '../db';
import { processosJudiciais, clientes, andamentos } from '../db/schema';
import { eq, and, ilike, or, sql, desc } from 'drizzle-orm';
import { authMiddleware, Variables } from '../middleware/auth';
import { DatajudService } from '../services/DatajudService';
import { ComparisonService } from '../services/ComparisonService';
import { processoJudicialSchema } from '@smartlaw/shared';

const processosJudiciaisRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  
  .get('/', async (c) => {
    const user = c.get('user');
    const { q, page = '1', limit = '10' } = c.req.query();
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const where = [eq(processosJudiciais.firmId, user.firmId)];

    if (q) {
      where.push(or(
        ilike(processosJudiciais.numero, `%${q}%`),
        ilike(clientes.nome, `%${q}%`)
      )!);
    }

    const data = await db
      .select({
        id: processosJudiciais.id,
        numero: processosJudiciais.numero,
        situacao: processosJudiciais.situacao,
        lastSync: processosJudiciais.lastSync,
        syncStatus: processosJudiciais.syncStatus,
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
  })

  .get('/:id', async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));

    const data = await db.query.processosJudiciais.findFirst({
      where: and(eq(processosJudiciais.id, id), eq(processosJudiciais.firmId, user.firmId)),
      with: {
        cliente: true,
        andamentos: {
          orderBy: [desc(andamentos.data)]
        }
      }
    });

    if (!data) return c.json({ error: 'Processo não encontrado' }, 404);
    return c.json(data);
  })

  .post('/', async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    
    const result = processoJudicialSchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: 'Dados inválidos', details: result.error.format() }, 400);
    }

    const [newProcesso] = await db
      .insert(processosJudiciais)
      .values({
        ...result.data,
        firmId: user.firmId,
        dataCadastro: new Date(),
      })
      .returning();

    return c.json(newProcesso, 201);
  })

  .post('/datajud/search', async (c) => {
    const { numero } = await c.req.json();
    if (!numero) return c.json({ error: 'Número é obrigatório' }, 400);

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
