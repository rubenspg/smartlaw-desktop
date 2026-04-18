import { Hono } from 'hono';
import { db } from '../db';
import { clientes, processosJudiciais, processosAdministrativos } from '../db/schema';
import { eq, ilike, or, and, sql, asc } from 'drizzle-orm';
import { clienteSchema } from '@smartlaw/shared';
import { authMiddleware, Variables } from '../middleware/auth';
import { zValidator } from '@hono/zod-validator';

const clientesRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  
  .get('/', async (c) => {
    const user = c.get('user');
    const { q, situacao, page = '1', limit = '10' } = c.req.query();
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const where = [eq(clientes.firmId, user.firmId)];

    if (q) {
      where.push(or(
        ilike(clientes.nome, `%${q}%`),
        ilike(clientes.cpfCnpj, `%${q}%`),
        ilike(clientes.email, `%${q}%`)
      )!);
    }

    if (situacao) {
      where.push(eq(clientes.situacao, situacao));
    }

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(clientes)
      .where(and(...where));
    
    const total = Number(totalResult.count);

    const data = await db
      .select()
      .from(clientes)
      .where(and(...where))
      .limit(limitNum)
      .offset(offset)
      .orderBy(asc(clientes.nome));

    return c.json({
      data,
      total,
      totalPages: Math.ceil(total / limitNum),
      page: pageNum,
    });
  })

  .get('/:id', async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));

    const [cliente] = await db
      .select()
      .from(clientes)
      .where(and(eq(clientes.id, id), eq(clientes.firmId, user.firmId)))
      .limit(1);

    if (!cliente) {
      return c.json({ error: 'Cliente não encontrado' }, 404);
    }

    return c.json(cliente);
  })

  .post('/', zValidator('json', clienteSchema), async (c) => {
    const user = c.get('user');
    const data = c.req.valid('json');

    const [newCliente] = await db
      .insert(clientes)
      .values({
        ...data,
        firmId: user.firmId,
        dataCadastro: new Date(),
      })
      .returning();

    return c.json(newCliente, 201);
  })

  .put('/:id', zValidator('json', clienteSchema), async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));
    const data = c.req.valid('json');

    const [updatedCliente] = await db
      .update(clientes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(clientes.id, id), eq(clientes.firmId, user.firmId)))
      .returning();

    if (!updatedCliente) {
      return c.json({ error: 'Cliente não encontrado ou sem permissão' }, 404);
    }

    return c.json(updatedCliente);
  })

  .delete('/:id', async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));

    // Check for related processes (Judicial and Administrative)
    const [judicialCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(processosJudiciais)
      .where(eq(processosJudiciais.clienteId, id));

    const [adminCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(processosAdministrativos)
      .where(eq(processosAdministrativos.clienteId, id));

    if (Number(judicialCount.count) > 0 || Number(adminCount.count) > 0) {
      return c.json({ 
        error: 'Não é possível excluir um cliente que possui processos vinculados. Considere inativar o cliente.' 
      }, 400);
    }

    const [deletedCliente] = await db
      .delete(clientes)
      .where(and(eq(clientes.id, id), eq(clientes.firmId, user.firmId)))
      .returning();

    if (!deletedCliente) {
      return c.json({ error: 'Cliente não encontrado ou sem permissão' }, 404);
    }

    return c.json({ message: 'Cliente excluído com sucesso' });
  });

export default clientesRoutes;
export type ClientesRoutes = typeof clientesRoutes;
