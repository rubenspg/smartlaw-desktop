import { Hono } from 'hono';
import { db } from '../db';
import { firms } from '../db/schema';
import { eq } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { firmUpdateSchema } from '@smartlaw/shared';
import { authMiddleware, Variables } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const firmsRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)

  // A chave do Datajud nunca é devolvida ao cliente — apenas se existe ou não.
  .get('/me', async (c) => {
    const user = c.get('user');
    const [firm] = await db
      .select({
        id: firms.id,
        nome: firms.nome,
        logo: firms.logo,
        createdAt: firms.createdAt,
        datajudApiKey: firms.datajudApiKey,
      })
      .from(firms)
      .where(eq(firms.id, user.firmId))
      .limit(1);

    if (!firm) {
      return c.json({ error: 'Firma não encontrada' }, 404);
    }

    const { datajudApiKey, ...safeFirm } = firm;
    return c.json({ ...safeFirm, hasDatajudKey: Boolean(datajudApiKey) });
  })

  .patch('/me', requireAdmin, zValidator('json', firmUpdateSchema), async (c) => {
    const user = c.get('user');
    const { nome, logo, datajudApiKey } = c.req.valid('json');

    const [updated] = await db
      .update(firms)
      .set({
        nome,
        logo,
        // Campo em branco mantém a chave existente; só grava quando há valor novo.
        datajudApiKey: datajudApiKey?.trim() ? datajudApiKey.trim() : undefined,
      })
      .where(eq(firms.id, user.firmId))
      .returning({
        id: firms.id,
        nome: firms.nome,
        logo: firms.logo,
        createdAt: firms.createdAt,
      });

    if (!updated) {
      return c.json({ error: 'Firma não encontrada' }, 404);
    }

    return c.json(updated);
  });

export default firmsRoutes;
