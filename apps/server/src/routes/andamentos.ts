import { Hono } from 'hono';
import { db } from '../db';
import { andamentos } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, Variables } from '../middleware/auth';
import { andamentoSchema } from '@smartlaw/shared';
import { zValidator } from '@hono/zod-validator';
import { parseIdParam } from '../utils';

const andamentosRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)

  .post('/', zValidator('json', andamentoSchema), async (c) => {
    const user = c.get('user');
    const data = c.req.valid('json');

    const [newAndamento] = await db
      .insert(andamentos)
      .values({
        ...data,
        data: new Date(data.data),
        inclusao: new Date(),
        firmId: user.firmId,
        tipo: data.tipo || 'MANUAL',
      })
      .returning();

    return c.json(newAndamento, 201);
  })

  .delete('/:id', async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);

    const [deleted] = await db
      .delete(andamentos)
      .where(and(eq(andamentos.id, id), eq(andamentos.firmId, user.firmId)))
      .returning();

    if (!deleted) return c.json({ error: 'Andamento não encontrado' }, 404);
    return c.json({ message: 'Andamento excluído com sucesso' });
  });

export default andamentosRoutes;
