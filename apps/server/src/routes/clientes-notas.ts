import { Hono } from 'hono';
import { db } from '../db';
import { clientesNotas, profiles } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { clienteNotaSchema } from '@smartlaw/shared';
import { authMiddleware, Variables } from '../middleware/auth';

const clientesNotasRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  
  .get('/:clienteId', async (c) => {
    const user = c.get('user');
    const clienteId = parseInt(c.req.param('clienteId'));

    const data = await db
      .select({
        id: clientesNotas.id,
        texto: clientesNotas.texto,
        createdAt: clientesNotas.createdAt,
        usuario: {
          nome: profiles.nome,
        }
      })
      .from(clientesNotas)
      .leftJoin(profiles, eq(clientesNotas.usuarioId, profiles.id))
      .where(and(eq(clientesNotas.clienteId, clienteId), eq(clientesNotas.firmId, user.firmId)))
      .orderBy(desc(clientesNotas.createdAt));

    return c.json(data);
  })

  .post('/', async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    
    const result = clienteNotaSchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: 'Dados inválidos', details: result.error.format() }, 400);
    }

    const [newNota] = await db
      .insert(clientesNotas)
      .values({
        clienteId: result.data.clienteId,
        texto: result.data.texto,
        usuarioId: user.id,
        firmId: user.firmId,
      })
      .returning();

    return c.json(newNota, 201);
  })

  .delete('/:id', async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));

    const [deletedNota] = await db
      .delete(clientesNotas)
      .where(and(eq(clientesNotas.id, id), eq(clientesNotas.firmId, user.firmId)))
      .returning();

    if (!deletedNota) {
      return c.json({ error: 'Nota não encontrada ou sem permissão' }, 404);
    }

    return c.json({ message: 'Nota excluída com sucesso' });
  });

export default clientesNotasRoutes;
export type ClientesNotasRoutes = typeof clientesNotasRoutes;
