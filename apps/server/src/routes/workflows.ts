import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { workflowAtivoSchema, workflowSchema, type WorkflowInput } from '@smartlaw/shared';
import { db } from '../db';
import { clientes, profiles, workflowExecucoes, workflows } from '../db/schema';
import { authMiddleware, Variables } from '../middleware/auth';
import { PERFIS_FLUXOS, requirePerfil } from '../middleware/perfil';
import { listarSituacoes } from '../services/workflows';
import { parseIdParam } from '../utils';

/**
 * Situações e responsáveis citados no fluxo precisam ser da própria firma —
 * sem isso um admin poderia gravar o UUID de um usuário de outro escritório e
 * o motor criaria tarefas para ele.
 */
async function validarReferencias(firmId: string, data: WorkflowInput): Promise<string | null> {
  const codigos = new Set((await listarSituacoes(firmId)).map((s) => s.codigo));
  const situacoes = [
    data.condicoes.situacaoAnterior,
    data.condicoes.situacaoNova,
    ...data.acoes.map((a) => (a.tipo === 'ALTERAR_SITUACAO_CLIENTE' ? a.situacao : undefined)),
  ].filter((s): s is string => Boolean(s));
  const desconhecida = situacoes.find((s) => !codigos.has(s));
  if (desconhecida) return `Situação desconhecida: ${desconhecida}`;

  const usuarios = [
    ...new Set(data.acoes.flatMap((a) => (a.tipo === 'CRIAR_TAREFA' ? [a.usuarioId] : []))),
  ];
  if (usuarios.length > 0) {
    const encontrados = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(
        and(eq(profiles.firmId, firmId), eq(profiles.ativo, true), inArray(profiles.id, usuarios)),
      );
    if (encontrados.length !== usuarios.length) {
      return 'Responsável da tarefa não encontrado ou inativo';
    }
  }
  return null;
}

const workflowsRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  .use(requirePerfil(...PERFIS_FLUXOS))

  .get('/', async (c) => {
    const user = c.get('user');
    const lista = await db
      .select()
      .from(workflows)
      .where(eq(workflows.firmId, user.firmId))
      .orderBy(asc(workflows.nome));

    const resumo = await db
      .select({
        workflowId: workflowExecucoes.workflowId,
        total: sql<number>`count(*)::int`,
        ultima: sql<string | null>`max(${workflowExecucoes.createdAt})`,
      })
      .from(workflowExecucoes)
      .where(eq(workflowExecucoes.firmId, user.firmId))
      .groupBy(workflowExecucoes.workflowId);
    const porFluxo = new Map(resumo.map((r) => [r.workflowId, r]));

    return c.json(
      lista.map((w) => ({
        ...w,
        execucoes: Number(porFluxo.get(w.id)?.total ?? 0),
        ultimaExecucao: porFluxo.get(w.id)?.ultima ?? null,
      })),
    );
  })

  // Antes de '/:id' para "execucoes" não ser lido como id.
  .get('/execucoes', async (c) => {
    const user = c.get('user');
    const workflowId = parseIdParam(c.req.query('workflowId') ?? '');
    const where = [eq(workflowExecucoes.firmId, user.firmId)];
    if (workflowId !== null) where.push(eq(workflowExecucoes.workflowId, workflowId));

    const data = await db
      .select({
        id: workflowExecucoes.id,
        workflowId: workflowExecucoes.workflowId,
        workflowNome: workflowExecucoes.workflowNome,
        gatilho: workflowExecucoes.gatilho,
        status: workflowExecucoes.status,
        resultado: workflowExecucoes.resultado,
        erro: workflowExecucoes.erro,
        createdAt: workflowExecucoes.createdAt,
        clienteId: workflowExecucoes.clienteId,
        clienteNome: clientes.nome,
        disparadoPorNome: profiles.nome,
      })
      .from(workflowExecucoes)
      .leftJoin(
        clientes,
        and(eq(clientes.id, workflowExecucoes.clienteId), eq(clientes.firmId, user.firmId)),
      )
      .leftJoin(
        profiles,
        and(eq(profiles.id, workflowExecucoes.disparadoPor), eq(profiles.firmId, user.firmId)),
      )
      .where(and(...where))
      .orderBy(desc(workflowExecucoes.createdAt), desc(workflowExecucoes.id))
      .limit(200);

    return c.json(data);
  })

  .get('/:id', async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);

    const [fluxo] = await db
      .select()
      .from(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.firmId, user.firmId)));
    if (!fluxo) return c.json({ error: 'Fluxo não encontrado' }, 404);
    return c.json(fluxo);
  })

  .post('/', zValidator('json', workflowSchema), async (c) => {
    const user = c.get('user');
    const data = c.req.valid('json');
    const erro = await validarReferencias(user.firmId, data);
    if (erro) return c.json({ error: erro }, 400);

    const [novo] = await db
      .insert(workflows)
      .values({ ...data, firmId: user.firmId, criadoPor: user.id })
      .returning();
    return c.json(novo, 201);
  })

  .put('/:id', zValidator('json', workflowSchema), async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);
    const data = c.req.valid('json');
    const erro = await validarReferencias(user.firmId, data);
    if (erro) return c.json({ error: erro }, 400);

    const [atualizado] = await db
      .update(workflows)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(workflows.id, id), eq(workflows.firmId, user.firmId)))
      .returning();
    if (!atualizado) return c.json({ error: 'Fluxo não encontrado' }, 404);
    return c.json(atualizado);
  })

  .patch('/:id/ativo', zValidator('json', workflowAtivoSchema), async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);

    const [atualizado] = await db
      .update(workflows)
      .set({ ativo: c.req.valid('json').ativo, updatedAt: new Date() })
      .where(and(eq(workflows.id, id), eq(workflows.firmId, user.firmId)))
      .returning();
    if (!atualizado) return c.json({ error: 'Fluxo não encontrado' }, 404);
    return c.json(atualizado);
  })

  .delete('/:id', async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);

    const [excluido] = await db
      .delete(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.firmId, user.firmId)))
      .returning({ id: workflows.id });
    if (!excluido) return c.json({ error: 'Fluxo não encontrado' }, 404);
    return c.json({ message: 'Fluxo excluído' });
  });

export default workflowsRoutes;
