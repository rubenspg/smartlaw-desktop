import { Hono } from 'hono';
import { db } from '../db';
import { clientes } from '../db/schema';
import { eq, ilike, or, and, sql, desc, asc } from 'drizzle-orm';
import { clienteSchema } from '@smartlaw/shared';
import { authMiddleware, Variables } from '../middleware/auth';

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

  .post('/', async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    
    const result = clienteSchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: 'Dados inválidos', details: result.error.format() }, 400);
    }

    const [newCliente] = await db
      .insert(clientes)
      .values({
        ...result.data,
        firmId: user.firmId,
        dataCadastro: new Date(),
      })
      .returning();

    return c.json(newCliente, 201);
  })

  .put('/:id', async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();

    const result = clienteSchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: 'Dados inválidos', details: result.error.format() }, 400);
    }

    const [updatedCliente] = await db
      .update(clientes)
      .set({
        ...result.data,
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

    // TODO: Check if cliente has related processes before deleting

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
