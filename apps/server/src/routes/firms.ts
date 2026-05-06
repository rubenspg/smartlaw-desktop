import { Hono } from 'hono';
import { db } from '../db';
import { firms } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authMiddleware, Variables } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const firmsRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  
  .get('/me', async (c) => {
    const user = c.get('user');
    const [firm] = await db
      .select()
      .from(firms)
      .where(eq(firms.id, user.firmId))
      .limit(1);

    if (!firm) {
      return c.json({ error: 'Firma não encontrada' }, 404);
    }

    return c.json(firm);
  })

  .patch('/me', requireAdmin, async (c) => {
    const user = c.get('user');
    const data = await c.req.json();
    console.log('Update firm request for user:', user.id, 'firm:', user.firmId);
    console.log('Payload keys:', Object.keys(data));
    if (data.logo) {
      console.log('Logo size:', data.logo.length, 'chars');
    }

    try {
      const [updated] = await db
        .update(firms)
        .set({
          nome: data.nome,
          logo: data.logo,
          datajudApiKey: data.datajudApiKey,
        })
        .where(eq(firms.id, user.firmId))
        .returning();

      if (!updated) {
        console.error('Firm not found for update:', user.firmId);
        return c.json({ error: 'Firma não encontrada' }, 404);
      }

      console.log('Firm updated successfully');
      return c.json(updated);
    } catch (err: any) {
      console.error('Error updating firm:', err);
      return c.json({ error: err.message }, 500);
    }
  });

export default firmsRoutes;
