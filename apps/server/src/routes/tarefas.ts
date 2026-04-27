import { Hono } from 'hono';
import { db } from '../db';
import { tarefas, profiles, clientes } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { tarefaSchema } from '@smartlaw/shared';
import { authMiddleware, Variables } from '../middleware/auth';
import { zValidator } from '@hono/zod-validator';

const tarefasRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  
  .get('/', async (c) => {
    const user = c.get('user');
    const { status, usuarioId } = c.req.query();
    
    const where = [eq(tarefas.firmId, user.firmId)];

    if (status) {
      where.push(eq(tarefas.status, status));
    }

    if (usuarioId) {
      where.push(eq(tarefas.usuarioId, usuarioId));
    }

    const data = await db.query.tarefas.findMany({
      where: and(...where),
      with: {
        usuario: {
          columns: {
            id: true,
            nome: true,
            email: true,
          }
        },
        cliente: {
          columns: {
            id: true,
            nome: true,
          }
        }
      },
      orderBy: [desc(tarefas.createdAt)],
    });

    return c.json(data);
  })

  .get('/:id', async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    const data = await db.query.tarefas.findFirst({
      where: and(eq(tarefas.id, id), eq(tarefas.firmId, user.firmId)),
      with: {
        usuario: {
          columns: {
            id: true,
            nome: true,
            email: true,
          }
        },
        cliente: {
          columns: {
            id: true,
            nome: true,
          }
        }
      }
    });

    if (!data) {
      return c.json({ error: 'Tarefa não encontrada' }, 404);
    }

    return c.json(data);
  })

  .post('/', zValidator('json', tarefaSchema), async (c) => {
    const user = c.get('user');
    const data = c.req.valid('json');

    const [newTarefa] = await db
      .insert(tarefas)
      .values({
        ...data,
        firmId: user.firmId,
        dataLimite: data.dataLimite ? new Date(data.dataLimite) : null,
      })
      .returning();

    return c.json(newTarefa, 201);
  })

  .put('/:id', zValidator('json', tarefaSchema), async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);
    const data = c.req.valid('json');

    const [updatedTarefa] = await db
      .update(tarefas)
      .set({
        ...data,
        dataLimite: data.dataLimite ? new Date(data.dataLimite) : null,
        updatedAt: new Date(),
      })
      .where(and(eq(tarefas.id, id), eq(tarefas.firmId, user.firmId)))
      .returning();

    if (!updatedTarefa) {
      return c.json({ error: 'Tarefa não encontrada' }, 404);
    }

    return c.json(updatedTarefa);
  })

  .delete('/:id', async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    const [deletedTarefa] = await db
      .delete(tarefas)
      .where(and(eq(tarefas.id, id), eq(tarefas.firmId, user.firmId)))
      .returning();

    if (!deletedTarefa) {
      return c.json({ error: 'Tarefa não encontrada' }, 404);
    }

    return c.json({ message: 'Tarefa excluída com sucesso' });
  });

export default tarefasRoutes;
