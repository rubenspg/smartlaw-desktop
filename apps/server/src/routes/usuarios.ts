import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { profiles } from '../db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { usuarioSchema, usuarioUpdateSchema } from '@smartlaw/shared';
import { authMiddleware, Variables } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const usuariosRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  .use(requireAdmin)

  .get('/', async (c) => {
    const user = c.get('user');
    const data = await db
      .select({
        id: profiles.id,
        nome: profiles.nome,
        email: profiles.email,
        perfil: profiles.perfil,
        ativo: profiles.ativo,
        firmId: profiles.firmId,
        createdAt: profiles.createdAt,
        updatedAt: profiles.updatedAt,
      })
      .from(profiles)
      .where(eq(profiles.firmId, user.firmId))
      .orderBy(asc(profiles.nome));

    return c.json(data);
  })

  .post('/', zValidator('json', usuarioSchema), async (c) => {
    const user = c.get('user');
    const { nome, email, senha, perfil } = c.req.valid('json');

    const [existing] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.email, email))
      .limit(1);

    if (existing) {
      return c.json({ error: 'Já existe um usuário com esse e-mail' }, 409);
    }

    const passwordHash = await bcrypt.hash(senha, 10);

    const [created] = await db
      .insert(profiles)
      .values({
        nome,
        email,
        passwordHash,
        perfil,
        ativo: true,
        firmId: user.firmId,
      })
      .returning({
        id: profiles.id,
        nome: profiles.nome,
        email: profiles.email,
        perfil: profiles.perfil,
        ativo: profiles.ativo,
        firmId: profiles.firmId,
        createdAt: profiles.createdAt,
        updatedAt: profiles.updatedAt,
      });

    return c.json(created, 201);
  })

  .patch('/:id', zValidator('json', usuarioUpdateSchema), async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    const data = c.req.valid('json');

    if (id === user.id && data.perfil && data.perfil !== 'admin') {
      return c.json({ error: 'Você não pode rebaixar seu próprio perfil' }, 400);
    }
    if (id === user.id && data.ativo === false) {
      return c.json({ error: 'Você não pode desativar a si mesmo' }, 400);
    }

    const [updated] = await db
      .update(profiles)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(profiles.id, id), eq(profiles.firmId, user.firmId)))
      .returning({
        id: profiles.id,
        nome: profiles.nome,
        email: profiles.email,
        perfil: profiles.perfil,
        ativo: profiles.ativo,
        firmId: profiles.firmId,
        createdAt: profiles.createdAt,
        updatedAt: profiles.updatedAt,
      });

    if (!updated) {
      return c.json({ error: 'Usuário não encontrado' }, 404);
    }

    return c.json(updated);
  })

  .delete('/:id', async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');

    if (id === user.id) {
      return c.json({ error: 'Você não pode remover a si mesmo' }, 400);
    }

    const [deleted] = await db
      .delete(profiles)
      .where(and(eq(profiles.id, id), eq(profiles.firmId, user.firmId)))
      .returning({ id: profiles.id });

    if (!deleted) {
      return c.json({ error: 'Usuário não encontrado' }, 404);
    }

    return c.json({ message: 'Usuário removido com sucesso' });
  });

export default usuariosRoutes;
export type UsuariosRoutes = typeof usuariosRoutes;
