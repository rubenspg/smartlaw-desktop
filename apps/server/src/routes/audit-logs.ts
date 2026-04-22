import { Hono } from 'hono';
import { db } from '../db';
import { auditLogs, profiles } from '../db/schema';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { authMiddleware, Variables } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const auditLogsRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  .use(requireAdmin)

  .get('/', async (c) => {
    const user = c.get('user');
    const { q, limit = '100' } = c.req.query();
    const limitNum = Math.min(parseInt(limit) || 100, 500);

    const where = [eq(auditLogs.firmId, user.firmId)];
    if (q) {
      where.push(
        or(
          ilike(auditLogs.tableName, `%${q}%`),
          ilike(auditLogs.action, `%${q}%`),
          ilike(auditLogs.recordId, `%${q}%`),
          ilike(profiles.nome, `%${q}%`),
        )!,
      );
    }

    const data = await db
      .select({
        id: auditLogs.id,
        tableName: auditLogs.tableName,
        recordId: auditLogs.recordId,
        action: auditLogs.action,
        oldData: auditLogs.oldData,
        newData: auditLogs.newData,
        userId: auditLogs.userId,
        firmId: auditLogs.firmId,
        createdAt: auditLogs.createdAt,
        usuario: {
          id: profiles.id,
          nome: profiles.nome,
        },
      })
      .from(auditLogs)
      .leftJoin(profiles, eq(auditLogs.userId, profiles.id))
      .where(and(...where))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limitNum);

    return c.json(data);
  });

export default auditLogsRoutes;
export type AuditLogsRoutes = typeof auditLogsRoutes;
