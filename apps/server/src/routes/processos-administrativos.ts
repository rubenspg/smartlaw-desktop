import { Hono } from 'hono';
import { db } from '../db';
import { processosAdministrativos, clientes, andamentos } from '../db/schema';
import { eq, and, ilike, or, desc } from 'drizzle-orm';
import { authMiddleware, Variables } from '../middleware/auth';
import { processoAdministrativoSchema } from '@smartlaw/shared';
import { zValidator } from '@hono/zod-validator';

const processosAdministrativosRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  
  .get('/', async (c) => {
    const user = c.get('user');
    const { q, page = '1', limit = '10', clienteId } = c.req.query();

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const where = [eq(processosAdministrativos.firmId, user.firmId)];

    if (q) {
      where.push(or(
        ilike(processosAdministrativos.numero, `%${q}%`),
        ilike(clientes.nome, `%${q}%`)
      )!);
    }

    if (clienteId) {
      where.push(eq(processosAdministrativos.clienteId, parseInt(clienteId)));
    }

    const data = await db
      .select({
        id: processosAdministrativos.id,
        numero: processosAdministrativos.numero,
        dataCadastro: processosAdministrativos.dataCadastro,
        cliente: {
          id: clientes.id,
          nome: clientes.nome,
        }
      })
      .from(processosAdministrativos)
      .leftJoin(clientes, eq(processosAdministrativos.clienteId, clientes.id))
      .where(and(...where))
      .limit(limitNum)
      .offset(offset)
      .orderBy(desc(processosAdministrativos.createdAt));

    return c.json(data);
  })

  .get('/:id', async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));

    const data = await db.query.processosAdministrativos.findFirst({
      where: and(eq(processosAdministrativos.id, id), eq(processosAdministrativos.firmId, user.firmId)),
      with: {
        cliente: true,
        andamentos: {
          orderBy: [desc(andamentos.data)]
        }
      }
    });

    if (!data) return c.json({ error: 'Processo não encontrado' }, 404);
    return c.json(data);
  })

  .post('/', zValidator('json', processoAdministrativoSchema), async (c) => {
    const user = c.get('user');
    const data = c.req.valid('json');

    const [newProcesso] = await db
      .insert(processosAdministrativos)
      .values({
        ...data,
        firmId: user.firmId,
        dataCadastro: data.dataCadastro ? new Date(data.dataCadastro) : new Date(),
        abertura: data.abertura ? new Date(data.abertura) : null,
        inicioBeneficio: data.inicioBeneficio ? new Date(data.inicioBeneficio) : null,
      })
      .returning();

    return c.json(newProcesso, 201);
  })

  .put('/:id', zValidator('json', processoAdministrativoSchema), async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));
    const data = c.req.valid('json');

    const [updatedProcesso] = await db
      .update(processosAdministrativos)
      .set({
        ...data,
        dataCadastro: data.dataCadastro ? new Date(data.dataCadastro) : undefined,
        abertura: data.abertura ? new Date(data.abertura) : undefined,
        inicioBeneficio: data.inicioBeneficio ? new Date(data.inicioBeneficio) : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(processosAdministrativos.id, id), eq(processosAdministrativos.firmId, user.firmId)))
      .returning();

    if (!updatedProcesso) {
      return c.json({ error: 'Processo não encontrado ou sem permissão' }, 404);
    }

    return c.json(updatedProcesso);
  })

  .delete('/:id', async (c) => {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));

    const [deletedProcesso] = await db
      .delete(processosAdministrativos)
      .where(and(eq(processosAdministrativos.id, id), eq(processosAdministrativos.firmId, user.firmId)))
      .returning();

    if (!deletedProcesso) {
      return c.json({ error: 'Processo não encontrado ou sem permissão' }, 404);
    }

    return c.json({ message: 'Processo excluído com sucesso' });
  });

export default processosAdministrativosRoutes;
