import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { profiles } from '../db/schema';
import { eq } from 'drizzle-orm';
import { loginSchema } from '@smartlaw/shared';
import { authMiddleware } from '../middleware/auth';
const auth = new Hono()
    .post('/login', async (c) => {
    const { email, password } = await c.req.json();
    // Validate with Zod
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
        return c.json({ error: 'Invalid input' }, 400);
    }
    const [user] = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
    if (!user || !user.ativo) {
        return c.json({ error: 'User not found or inactive' }, 401);
    }
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
        return c.json({ error: 'Invalid credentials' }, 401);
    }
    const payload = {
        id: user.id,
        email: user.email,
        nome: user.nome,
        perfil: user.perfil || 'usuario',
        firmId: user.firmId,
        // JWT standard claims
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
    };
    const token = await sign(payload, process.env.JWT_SECRET, 'HS256');
    return c.json({
        token,
        user: {
            id: user.id,
            email: user.email,
            nome: user.nome,
            perfil: user.perfil || 'usuario',
            firmId: user.firmId,
        },
    });
})
    .get('/me', authMiddleware, async (c) => {
    const user = c.get('user');
    return c.json({ user });
});
export default auth;
