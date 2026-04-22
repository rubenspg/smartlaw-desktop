import { Hono } from 'hono';
import { db } from '../db';
import { honorarios, clientes } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware, Variables } from '../middleware/auth';
import { honorarioSchema } from '@smartlaw/shared';
import { zValidator } from '@hono/zod-validator';

const honorariosRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)

  .get('/', async (c) => {
    const user = c.get('user');
    const { status, page = '1', limit = '10' } = c.req.query();

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const where = [eq(honorarios.firmId, user.firmId)];
    if (status) where.push(eq(honorarios.status, status));

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

    const [deleted] = await db
      .delete(honorarios)
      .where(and(eq(honorarios.id, id), eq(honorarios.firmId, user.firmId)))
      .returning();

    if (!deleted) return c.json({ error: 'Honorário não encontrado' }, 404);
    return c.json({ message: 'Honorário excluído com sucesso' });
  });

export default honorariosRoutes;
