import { Hono } from 'hono';
import { db } from '../db';
import { honorarios, clientes } from '../db/schema';
import { eq, and, ilike, or, sql, desc } from 'drizzle-orm';
import { authMiddleware, Variables } from '../middleware/auth';
import { honorarioSchema } from '@smartlaw/shared';

const honorariosRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  
  .get('/', async (c) => {
    const user = c.get('user');
    const { status, page = '1', limit = '10' } = c.req.query();
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const where = [eq(honorarios.firmId, user.firmId)];

    if (status) {
      where.push(eq(honorarios.status, status));
    }

    const data = await db
      .select({
        id: honorarios.id,
        descricao: honorarios.descricao,
        valor: honorarios.valor,
        valorPago: honorarios.valorPago,
        dataVenc: honorarios.dataVenc,
        status: honorarios.status,
        cliente: {
          id: clientes.id,
          nome: clientes.nome,
        }
      })
      .from(honorarios)
      .leftJoin(clientes, eq(honorarios.clienteId, clientes.id))
      .where(and(...where))
      .limit(limitNum)
      .offset(offset)
      .orderBy(desc(honorarios.dataVenc));

    return c.json(data);
  })

  .post('/', async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    
    const result = honorarioSchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: 'Dados inválidos', details: result.error.format() }, 400);
    }

    const [newHonorario] = await db
      .insert(honorarios)
      .values({
        ...result.data,
        firmId: user.firmId,
      })
      .returning();

    return c.json(newHonorario, 201);
  });

export default honorariosRoutes;
