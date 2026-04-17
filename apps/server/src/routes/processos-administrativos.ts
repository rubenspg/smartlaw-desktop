import { Hono } from 'hono';
import { db } from '../db';
import { processosAdministrativos, clientes, andamentos } from '../db/schema';
import { eq, and, ilike, or, sql, desc } from 'drizzle-orm';
import { authMiddleware, Variables } from '../middleware/auth';
import { processoAdministrativoSchema } from '@smartlaw/shared';

const processosAdministrativosRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  
  .get('/', async (c) => {
    const user = c.get('user');
    const { q, page = '1', limit = '10' } = c.req.query();
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const where = [eq(processosAdministrativos.firmId, user.firmId)];

    if (q) {
      where.push(or(
        ilike(processosAdministrativos.numero, `%${q}%`),
        ilike(clientes.nome, `%${q}%`)
      )!);
    }

    const data = await db
      .select({
        id: processosAdministrativos.id,
        numero: processosAdministrativos.numero,
        dataCadastro: processosAdministrativos.dataCadastro,
        cliente: {
          id: clientes.id,
          nome: clientes.nome,
        }
      })
      .from(processosAdministrativos)
      .leftJoin(clientes, eq(processosAdministrativos.clienteId, clientes.id))
      .where(and(...where))
      .limit(limitNum)
      .offset(offset)
      .orderBy(desc(processosAdministrativos.createdAt));

    return c.json(data);
  })

  .get('/:id', async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));

    const data = await db.query.processosAdministrativos.findFirst({
      where: and(eq(processosAdministrativos.id, id), eq(processosAdministrativos.firmId, user.firmId)),
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
    
    const result = processoAdministrativoSchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: 'Dados inválidos', details: result.error.format() }, 400);
    }

    const [newProcesso] = await db
      .insert(processosAdministrativos)
      .values({
        ...result.data,
        firmId: user.firmId,
        dataCadastro: new Date(),
      })
      .returning();

    return c.json(newProcesso, 201);
  })

  .put('/:id', async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();

    const result = processoAdministrativoSchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: 'Dados inválidos', details: result.error.format() }, 400);
    }

    const [updatedProcesso] = await db
      .update(processosAdministrativos)
      .set({
        ...result.data,
        updatedAt: new Date(),
      })
      .where(and(eq(processosAdministrativos.id, id), eq(processosAdministrativos.firmId, user.firmId)))
      .returning();

    if (!updatedProcesso) {
      return c.json({ error: 'Processo não encontrado ou sem permissão' }, 404);
    }

    return c.json(updatedProcesso);
  })

  .delete('/:id', async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));

    const [deletedProcesso] = await db
      .delete(processosAdministrativos)
      .where(and(eq(processosAdministrativos.id, id), eq(processosAdministrativos.firmId, user.firmId)))
      .returning();

    if (!deletedProcesso) {
      return c.json({ error: 'Processo não encontrado ou sem permissão' }, 404);
    }

    return c.json({ message: 'Processo excluído com sucesso' });
  });

export default processosAdministrativosRoutes;
