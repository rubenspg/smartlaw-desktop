import { Hono } from 'hono';
import { db } from '../db';
import { honorarios, clientes } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authMiddleware, Variables } from '../middleware/auth';
import { honorarioSchema, type HonorarioSummary } from '@smartlaw/shared';
import { zValidator } from '@hono/zod-validator';

const honorariosRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)

  .get('/summary', async (c) => {
    const user = c.get('user');
    const { month, year } = c.req.query();
    
    // Only admins can see the financial summary (totals)
    if (user.perfil !== 'admin') {
      return c.json({
        totalRecebido: 0,
        totalPendente: 0,
        totalAtrasado: 0,
      } as HonorarioSummary);
    }

    const now = new Date();
    const targetMonth = month ? parseInt(month) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year) : now.getFullYear();
    const todayStr = now.toISOString().split('T')[0];

    // Filter by month/year based on dataVenc
    const monthFilter = sql`EXTRACT(MONTH FROM ${honorarios.dataVenc}) = ${targetMonth} AND EXTRACT(YEAR FROM ${honorarios.dataVenc}) = ${targetYear}`;

    const [summary] = await db
      .select({
        totalRecebido: sql<number>`COALESCE(SUM(
          CASE 
            WHEN ${honorarios.status} = 'PAGO' 
            THEN ${honorarios.valorPago}
            ELSE 0 
          END
        )::double precision, 0)`,
        totalPendente: sql<number>`COALESCE(SUM(
          CASE 
            WHEN ${honorarios.status} = 'PENDENTE' AND ${honorarios.dataVenc} >= ${todayStr} 
            THEN (${honorarios.valor} - COALESCE(${honorarios.valorPago}, 0))
            ELSE 0 
          END
        )::double precision, 0)`,
        totalAtrasado: sql<number>`COALESCE(SUM(
          CASE 
            WHEN ${honorarios.status} = 'PENDENTE' AND ${honorarios.dataVenc} < ${todayStr} 
            THEN (${honorarios.valor} - COALESCE(${honorarios.valorPago}, 0))
            ELSE 0 
          END
        )::double precision, 0)`,
      })
      .from(honorarios)
      .where(and(eq(honorarios.firmId, user.firmId), monthFilter));

    return c.json(summary as HonorarioSummary);
  })

  .get('/', async (c) => {
    const user = c.get('user');
    const { status, page = '1', limit = '10', month, year } = c.req.query();

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 10);
    const offset = (pageNum - 1) * limitNum;

    const where = [eq(honorarios.firmId, user.firmId)];
    if (status) where.push(eq(honorarios.status, status));

    if (month && year) {
      where.push(sql`EXTRACT(MONTH FROM ${honorarios.dataVenc}) = ${parseInt(month)}`);
      where.push(sql`EXTRACT(YEAR FROM ${honorarios.dataVenc}) = ${parseInt(year)}`);
    } else {
      // Default to current month if no filter is provided
      const now = new Date();
      where.push(sql`EXTRACT(MONTH FROM ${honorarios.dataVenc}) = ${now.getMonth() + 1}`);
      where.push(sql`EXTRACT(YEAR FROM ${honorarios.dataVenc}) = ${now.getFullYear()}`);
    }

    const data = await db
      .select({
        id: honorarios.id,
        clienteId: honorarios.clienteId,
        processoJudicialId: honorarios.processoJudicialId,
        processoAdminId: honorarios.processoAdminId,
        descricao: honorarios.descricao,
        valor: honorarios.valor,
        valorPago: honorarios.valorPago,
        dataVenc: honorarios.dataVenc,
        dataPagto: honorarios.dataPagto,
        status: honorarios.status,
        tipo: honorarios.tipo,
        observacoes: honorarios.observacoes,
        cliente: {
          id: clientes.id,
          nome: clientes.nome,
        },
      })
      .from(honorarios)
      .leftJoin(clientes, eq(honorarios.clienteId, clientes.id))
      .where(and(...where))
      .limit(limitNum)
      .offset(offset)
      .orderBy(desc(honorarios.dataVenc));

    return c.json(data);
  })

  .get('/:id', async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    const [data] = await db
      .select({
        id: honorarios.id,
        clienteId: honorarios.clienteId,
        processoJudicialId: honorarios.processoJudicialId,
        processoAdminId: honorarios.processoAdminId,
        descricao: honorarios.descricao,
        valor: honorarios.valor,
        valorPago: honorarios.valorPago,
        dataVenc: honorarios.dataVenc,
        dataPagto: honorarios.dataPagto,
        status: honorarios.status,
        tipo: honorarios.tipo,
        observacoes: honorarios.observacoes,
        createdAt: honorarios.createdAt,
        updatedAt: honorarios.updatedAt,
        cliente: {
          id: clientes.id,
          nome: clientes.nome,
        },
      })
      .from(honorarios)
      .leftJoin(clientes, eq(honorarios.clienteId, clientes.id))
      .where(and(eq(honorarios.id, id), eq(honorarios.firmId, user.firmId)));

    if (!data) return c.json({ error: 'Honorário não encontrado' }, 404);
    return c.json(data);
  })

  .post('/', zValidator('json', honorarioSchema), async (c) => {
    const user = c.get('user');
    const data = c.req.valid('json');

    const [newHonorario] = await db
      .insert(honorarios)
      .values({ ...data, firmId: user.firmId })
      .returning();

    return c.json(newHonorario, 201);
  })

  .put('/:id', zValidator('json', honorarioSchema), async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);
    const data = c.req.valid('json');

    const [updated] = await db
      .update(honorarios)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(honorarios.id, id), eq(honorarios.firmId, user.firmId)))
      .returning();

    if (!updated) return c.json({ error: 'Honorário não encontrado' }, 404);
    return c.json(updated);
  })

  .delete('/:id', async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    const [deleted] = await db
      .delete(honorarios)
      .where(and(eq(honorarios.id, id), eq(honorarios.firmId, user.firmId)))
      .returning();

    if (!deleted) return c.json({ error: 'Honorário não encontrado' }, 404);
    return c.json({ message: 'Honorário excluído com sucesso' });
  });

export default honorariosRoutes;
