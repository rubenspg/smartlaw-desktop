import { verify } from 'hono/jwt';
export const authMiddleware = async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized' }, 401);
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = await verify(token, process.env.JWT_SECRET, 'HS256');
        c.set('user', payload);
        await next();
    }
    catch (err) {
        return c.json({ error: 'Invalid or expired token' }, 401);
    }
};
