import { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import { JWTPayload } from 'hono/utils/jwt/types';

export interface UserPayload extends JWTPayload {
  id: string;
  email: string;
  nome: string;
  perfil: string;
  firmId: string;
}

export type Variables = {
  user: UserPayload;
};

export const authMiddleware = async (c: Context<{ Variables: Variables }>, next: Next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = await verify(token, process.env.JWT_SECRET!, 'HS256');
    c.set('user', payload as unknown as UserPayload);
    await next();
  } catch (err) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
};
