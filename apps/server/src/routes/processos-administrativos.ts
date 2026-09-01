import { Hono } from 'hono';
import { db } from '../db';
import { processosAdministrativos, clientes, andamentos } from '../db/schema';
import { eq, and, ilike, or, desc, sql } from 'drizzle-orm';
import { authMiddleware, Variables } from '../middleware/auth';
import { processoAdministrativoSchema } from '@smartlaw/shared';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { parseIdParam, parsePageParams, paginated } from '../utils';

const querySchema = z.object({
  q: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  clienteId: z.string().optional(),
});

const processosAdministrativosRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  
  .get('/', zValidator('query', querySchema), async (c) => {
    const user = c.get('user');
    const { q, page: pageParam, limit: limitParam, clienteId } = c.req.valid('query');
    const { page, limit, offset } = parsePageParams(pageParam, limitParam);

    // One shape for the list whether or not a search term is present.
    const where = [eq(processosAdministrativos.firmId, user.firmId)];

    if (q) {
      const cleanQ = q.replace(/\D/g, '');
      const searchConditions = [
        ilike(processosAdministrativos.numero, `%${q}%`),
        ilike(clientes.nome, `%${q}%`),
      ];
      if (cleanQ.length > 0) {
        searchConditions.push(sql`REPLACE(REPLACE(${processosAdministrativos.numero}, '.', ''), '-', '') ILIKE ${`%${cleanQ}%`}`);
      }
      where.push(or(...searchConditions)!);
    }

    if (clienteId) {
      where.push(eq(processosAdministrativos.clienteId, parseInt(clienteId)));
    }

    const [totalRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(processosAdministrativos)
      .leftJoin(clientes, eq(processosAdministrativos.clienteId, clientes.id))
      .where(and(...where));

    const data = await db
      .select({
        id: processosAdministrativos.id,
        clienteId: processosAdministrativos.clienteId,
        numero: processosAdministrativos.numero,
        dataCadastro: processosAdministrativos.dataCadastro,
        createdAt: processosAdministrativos.createdAt,
        cliente: {
          id: clientes.id,
          nome: clientes.nome,
          celular: clientes.celular,
          telefone1: clientes.telefone1,
          telefone2: clientes.telefone2,
        },
      })
      .from(processosAdministrativos)
      .leftJoin(clientes, eq(processosAdministrativos.clienteId, clientes.id))
      .where(and(...where))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(processosAdministrativos.createdAt));

    return c.json(paginated(data, Number(totalRow?.count ?? 0), page, limit));
  })

  .get('/:id', async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);

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
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);
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
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);

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
