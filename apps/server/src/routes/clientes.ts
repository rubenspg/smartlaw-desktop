import { Hono } from 'hono';
import { db } from '../db';
import { clientes, processosJudiciais, processosAdministrativos } from '../db/schema';
import { eq, ilike, or, and, sql, asc, inArray } from 'drizzle-orm';
import { clienteSchema } from '@smartlaw/shared';
import { authMiddleware, Variables } from '../middleware/auth';
import { zValidator } from '@hono/zod-validator';
import { parseIdParam } from '../utils';
import { dispararEvento, listarSituacoes, situacaoExiste } from '../services/workflows';

async function buscarCliente(id: number, firmId: string) {
  const [cliente] = await db
    .select()
    .from(clientes)
    .where(and(eq(clientes.id, id), eq(clientes.firmId, firmId)))
    .limit(1);
  return cliente;
}

const clientesRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  
  .get('/', async (c) => {
    const user = c.get('user');
    const { q, situacao, page = '1', limit = '10' } = c.req.query();
    
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 10);
    const offset = (pageNum - 1) * limitNum;

    const where = [eq(clientes.firmId, user.firmId)];

    if (q) {
      where.push(or(
        ilike(clientes.nome, `%${q}%`),
        ilike(clientes.cpfCnpj, `%${q}%`),
        ilike(clientes.email, `%${q}%`)
      )!);
    }

    // "ativos" = todas as situações que contam como ativo (Ativo, Em revisão…);
    // é o filtro padrão da lista, para um cliente movido por fluxo não sumir.
    if (situacao === 'ativos') {
      const ativas = (await listarSituacoes(user.firmId))
        .filter((s) => s.contaComoAtivo)
        .map((s) => s.codigo);
      where.push(inArray(clientes.situacao, ativas));
    } else if (situacao) {
      where.push(eq(clientes.situacao, situacao));
    }

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(clientes)
      .where(and(...where));
    
    const total = Number(totalResult.count);

    const data = await db
      .select()
      .from(clientes)
      .where(and(...where))
      .limit(limitNum)
      .offset(offset)
      .orderBy(asc(clientes.nome));

    return c.json({
      data,
      total,
      totalPages: Math.ceil(total / limitNum),
      page: pageNum,
    });
  })

  .get('/:id', async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);

    const cliente = await buscarCliente(id, user.firmId);

    if (!cliente) {
      return c.json({ error: 'Cliente não encontrado' }, 404);
    }

    return c.json(cliente);
  })

  .post('/', zValidator('json', clienteSchema), async (c) => {
    const user = c.get('user');
    const data = c.req.valid('json');
    if (data.situacao && !(await situacaoExiste(user.firmId, data.situacao))) {
      return c.json({ error: 'Situação inválida' }, 400);
    }

    const [newCliente] = await db
      .insert(clientes)
      .values({
        ...data,
        firmId: user.firmId,
        dataCadastro: new Date(),
      })
      .returning();

    await dispararEvento({
      gatilho: 'CLIENTE_CRIADO',
      firmId: user.firmId,
      clienteId: newCliente.id,
      usuarioId: user.id,
    });

    // Um fluxo pode ter mudado a situação: devolve o cliente como ficou.
    return c.json((await buscarCliente(newCliente.id, user.firmId)) ?? newCliente, 201);
  })

  .put('/:id', zValidator('json', clienteSchema), async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);
    const data = c.req.valid('json');
    if (data.situacao && !(await situacaoExiste(user.firmId, data.situacao))) {
      return c.json({ error: 'Situação inválida' }, 400);
    }

    const anterior = await buscarCliente(id, user.firmId);
    if (!anterior) {
      return c.json({ error: 'Cliente não encontrado ou sem permissão' }, 404);
    }

    const [updatedCliente] = await db
      .update(clientes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(clientes.id, id), eq(clientes.firmId, user.firmId)))
      .returning();

    if (!updatedCliente) {
      return c.json({ error: 'Cliente não encontrado ou sem permissão' }, 404);
    }

    if (updatedCliente.situacao !== anterior.situacao) {
      await dispararEvento({
        gatilho: 'CLIENTE_SITUACAO_ALTERADA',
        firmId: user.firmId,
        clienteId: id,
        usuarioId: user.id,
        situacaoAnterior: anterior.situacao,
        situacaoNova: updatedCliente.situacao,
      });
      return c.json((await buscarCliente(id, user.firmId)) ?? updatedCliente);
    }

    return c.json(updatedCliente);
  })

  .delete('/:id', async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);

    // Check for related processes (Judicial and Administrative)
    const [judicialCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(processosJudiciais)
      .where(eq(processosJudiciais.clienteId, id));

    const [adminCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(processosAdministrativos)
      .where(eq(processosAdministrativos.clienteId, id));

    if (Number(judicialCount.count) > 0 || Number(adminCount.count) > 0) {
      return c.json({ 
        error: 'Não é possível excluir um cliente que possui processos vinculados. Considere inativar o cliente.' 
      }, 400);
    }

    const [deletedCliente] = await db
      .delete(clientes)
      .where(and(eq(clientes.id, id), eq(clientes.firmId, user.firmId)))
      .returning();

    if (!deletedCliente) {
      return c.json({ error: 'Cliente não encontrado ou sem permissão' }, 404);
    }

    return c.json({ message: 'Cliente excluído com sucesso' });
  });

export default clientesRoutes;
export type ClientesRoutes = typeof clientesRoutes;
