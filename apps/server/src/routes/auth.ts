import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { profiles } from '../db/schema';
import { eq } from 'drizzle-orm';
import { loginSchema } from '@smartlaw/shared';
import { env } from '../env';
import { authMiddleware, UserPayload, Variables } from '../middleware/auth';
import {
  verificarLimiteLogin,
  registrarFalhaLogin,
  limparFalhasLogin,
  ipDoCliente,
} from '../middleware/rate-limit';

const auth = new Hono<{ Variables: Variables }>()
  .post('/login', async (c) => {
    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    // Validate with Zod
    const result = loginSchema.safeParse(rawBody);
    if (!result.success) {
      return c.json({ error: 'Invalid input' }, 400);
    }

    const { email, password } = result.data;

    // Limite por IP + e-mail. Antes do bcrypt de propósito: a verificação é o
    // trabalho caro, e é justamente ele que não queremos oferecer de graça.
    const ip = ipDoCliente({
      cfConnectingIp: c.req.header('cf-connecting-ip'),
      xForwardedFor: c.req.header('x-forwarded-for'),
    });

    const limite = verificarLimiteLogin(ip, email);
    if (!limite.permitido) {
      return c.json(
        { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
        429,
        { 'Retry-After': String(limite.retryAfter) },
      );
    }

    const [user] = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);

    // Resposta idêntica para usuário inexistente, inativo e senha errada:
    // diferenciar permitiria enumerar e-mails válidos.
    const isValid = user?.ativo
      ? await bcrypt.compare(password, user.passwordHash)
      : false;

    if (!user || !user.ativo || !isValid) {
      registrarFalhaLogin(ip, email);
      return c.json({ error: 'Credenciais inválidas' }, 401);
    }

    // Acertou: zera o contador, para que errar a senha e acertar em seguida —
    // o caso normal — nunca acumule em direção ao bloqueio.
    limparFalhasLogin(ip, email);

    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      nome: user.nome,
      perfil: user.perfil || 'usuario',
      firmId: user.firmId!,
      // JWT standard claims
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
    };

    const token = await sign(payload, env.JWT_SECRET, 'HS256');

    // Return the same clean user shape as /auth/me, rather than leaking the raw
    // JWT payload (which carries standard claims and a looser perfil type).
    return c.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        perfil: user.perfil || 'usuario',
        firmId: user.firmId!,
      },
    });
  })
  // Lê do banco em vez de confiar nas claims do token: o JWT vive 7 dias, então
  // desativar ou rebaixar um usuário não teria efeito até a expiração.
  .get('/me', authMiddleware, async (c) => {
    const claims = c.get('user');

    const [profile] = await db
      .select({
        id: profiles.id,
        email: profiles.email,
        nome: profiles.nome,
        perfil: profiles.perfil,
        firmId: profiles.firmId,
        ativo: profiles.ativo,
      })
      .from(profiles)
      .where(eq(profiles.id, claims.id))
      .limit(1);

    if (!profile || !profile.ativo) {
      return c.json({ error: 'Conta inativa ou inexistente' }, 401);
    }

    const { ativo: _ativo, ...user } = profile;
    return c.json({ user: { ...user, perfil: user.perfil || 'usuario' } });
  });

export default auth;
export type AuthRoutes = typeof auth;
