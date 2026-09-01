import { Hono } from 'hono';
import { db } from '../db';
import { honorarios, clientes, processosJudiciais, processosAdministrativos } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authMiddleware, Variables } from '../middleware/auth';
import { PERFIS_FINANCEIRO, requirePerfil } from '../middleware/perfil';
import { honorarioSchema, type HonorarioSummary } from '@smartlaw/shared';
import { zValidator } from '@hono/zod-validator';
import { parseIdParam, parsePageParams, paginated } from '../utils';

// Todo o módulo financeiro é restrito aos mesmos perfis.
const honorariosRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  .use(requirePerfil(...PERFIS_FINANCEIRO))

  .get('/summary', async (c) => {
    const user = c.get('user');
    const { month, year, clienteId } = c.req.query();

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const where = [eq(honorarios.firmId, user.firmId)];
    
    if (clienteId) {
      where.push(eq(honorarios.clienteId, parseInt(clienteId)));
    }

    if (month && year) {
      where.push(sql`EXTRACT(MONTH FROM ${honorarios.dataVenc}) = ${parseInt(month)}`);
      where.push(sql`EXTRACT(YEAR FROM ${honorarios.dataVenc}) = ${parseInt(year)}`);
    }

    const [summary] = await db
      .select({
        totalRecebido: sql<number>`COALESCE(SUM(${honorarios.valorPago})::double precision, 0)`,
        totalPendente: sql<number>`COALESCE(SUM(
          CASE 
            WHEN ${honorarios.status} = 'PENDENTE' AND ${honorarios.dataVenc} >= ${todayStr} 
            THEN (${honorarios.valor} - COALESCE(${honorarios.valorPago}, 0))
            ELSE 0 
          END
        )::double precision, 0)`,
        totalAtrasado: sql<number>`COALESCE(SUM(
          CASE 
            WHEN ${honorarios.status} = 'PENDENTE' AND ${honorarios.dataVenc} < ${todayStr} 
            THEN (${honorarios.valor} - COALESCE(${honorarios.valorPago}, 0))
            ELSE 0 
          END
        )::double precision, 0)`,
      })
      .from(honorarios)
      .where(and(...where, sql`${honorarios.status} != 'CANCELADO'`));

    return c.json(summary as HonorarioSummary);
  })

  .get('/', async (c) => {
    const user = c.get('user');
    const { status, page: pageParam, limit: limitParam, month, year, clienteId } = c.req.query();
    const { page, limit, offset } = parsePageParams(pageParam, limitParam);

    const where = [eq(honorarios.firmId, user.firmId)];
    if (status) where.push(eq(honorarios.status, status));
    if (clienteId) where.push(eq(honorarios.clienteId, parseInt(clienteId)));

    if (month && year) {
      where.push(sql`EXTRACT(MONTH FROM ${honorarios.dataVenc}) = ${parseInt(month)}`);
      where.push(sql`EXTRACT(YEAR FROM ${honorarios.dataVenc}) = ${parseInt(year)}`);
    } else if (!clienteId) {
      // Default to current month only if no clienteId is provided
      const now = new Date();
      where.push(sql`EXTRACT(MONTH FROM ${honorarios.dataVenc}) = ${now.getMonth() + 1}`);
      where.push(sql`EXTRACT(YEAR FROM ${honorarios.dataVenc}) = ${now.getFullYear()}`);
    }

    const [totalRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(honorarios)
      .where(and(...where));

    const data = await db
      .select({
        id: honorarios.id,
        clienteId: honorarios.clienteId,
        processoJudicialId: honorarios.processoJudicialId,
        processoAdminId: honorarios.processoAdminId,
        descricao: honorarios.descricao,
        valor: honorarios.valor,
        valorPago: honorarios.valorPago,
        dataVenc: honorarios.dataVenc,
        dataPagto: honorarios.dataPagto,
        status: honorarios.status,
        tipo: honorarios.tipo,
        observacoes: honorarios.observacoes,
        cliente: {
          id: clientes.id,
          nome: clientes.nome,
        },
        processoJudicial: {
          id: processosJudiciais.id,
          numero: processosJudiciais.numero,
        },
        processoAdmin: {
          id: processosAdministrativos.id,
          numero: processosAdministrativos.numero,
        },
      })
      .from(honorarios)
      .leftJoin(clientes, eq(honorarios.clienteId, clientes.id))
      .leftJoin(processosJudiciais, eq(honorarios.processoJudicialId, processosJudiciais.id))
      .leftJoin(processosAdministrativos, eq(honorarios.processoAdminId, processosAdministrativos.id))
      .where(and(...where))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(honorarios.dataVenc));

    return c.json(paginated(data, Number(totalRow?.count ?? 0), page, limit));
  })

  .get('/:id', async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);

    const [data] = await db
      .select({
        id: honorarios.id,
        clienteId: honorarios.clienteId,
        processoJudicialId: honorarios.processoJudicialId,
        processoAdminId: honorarios.processoAdminId,
        descricao: honorarios.descricao,
        valor: honorarios.valor,
        valorPago: honorarios.valorPago,
        dataVenc: honorarios.dataVenc,
        dataPagto: honorarios.dataPagto,
        status: honorarios.status,
        tipo: honorarios.tipo,
        observacoes: honorarios.observacoes,
        createdAt: honorarios.createdAt,
        updatedAt: honorarios.updatedAt,
        cliente: {
          id: clientes.id,
          nome: clientes.nome,
        },
        processoJudicial: {
          id: processosJudiciais.id,
          numero: processosJudiciais.numero,
        },
        processoAdmin: {
          id: processosAdministrativos.id,
          numero: processosAdministrativos.numero,
        },
      })
      .from(honorarios)
      .leftJoin(clientes, eq(honorarios.clienteId, clientes.id))
      .leftJoin(processosJudiciais, eq(honorarios.processoJudicialId, processosJudiciais.id))
      .leftJoin(processosAdministrativos, eq(honorarios.processoAdminId, processosAdministrativos.id))
      .where(and(eq(honorarios.id, id), eq(honorarios.firmId, user.firmId)));

    if (!data) return c.json({ error: 'Honorário não encontrado' }, 404);
    return c.json(data);
  })

  .post('/', zValidator('json', honorarioSchema), async (c) => {
    const user = c.get('user');
    const data = c.req.valid('json');

    try {
      const [newHonorario] = await db
        .insert(honorarios)
        .values({ ...data, firmId: user.firmId })
        .returning();

      return c.json(newHonorario, 201);
    } catch (err: any) {
      console.error('[Honorarios] Erro ao inserir honorário:', err);
      return c.json({ error: 'Erro interno ao salvar honorário' }, 500);
    }
  })

  .put('/:id', zValidator('json', honorarioSchema), async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);
    const data = c.req.valid('json');

    const [updated] = await db
      .update(honorarios)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(honorarios.id, id), eq(honorarios.firmId, user.firmId)))
      .returning();

    if (!updated) return c.json({ error: 'Honorário não encontrado' }, 404);
    return c.json(updated);
  })

  .delete('/:id', async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);

    const [deleted] = await db
      .delete(honorarios)
      .where(and(eq(honorarios.id, id), eq(honorarios.firmId, user.firmId)))
      .returning();

    if (!deleted) return c.json({ error: 'Honorário não encontrado' }, 404);
    return c.json({ message: 'Honorário excluído com sucesso' });
  });

export default honorariosRoutes;
