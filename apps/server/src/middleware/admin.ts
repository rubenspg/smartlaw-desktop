import { Context, Next } from 'hono';
import { Variables } from './auth';

export const requireAdmin = async (
  c: Context<{ Variables: Variables }>,
  next: Next,
) => {
  const user = c.get('user');
  if (!user || user.perfil !== 'admin') {
    return c.json({ error: 'Acesso restrito a administradores' }, 403);
  }
  await next();
};
