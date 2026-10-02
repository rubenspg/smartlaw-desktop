import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, eq, sql } from 'drizzle-orm';
import { clienteSituacaoSchema } from '@smartlaw/shared';
import { db } from '../db';
import { clienteSituacoes, clientes, workflows } from '../db/schema';
import { authMiddleware, Variables } from '../middleware/auth';
import { PERFIS_FLUXOS, requirePerfil } from '../middleware/perfil';
import { codigoDaSituacao, listarSituacoes } from '../services/workflows';
import { parseIdParam } from '../utils';

/**
 * Situações de cliente da firma. Todos leem (a lista de clientes e o
 * formulário usam); só quem edita fluxos cadastra, altera e exclui.
 */
const clienteSituacoesRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)

  .get('/', async (c) => {
    const user = c.get('user');
    return c.json(await listarSituacoes(user.firmId));
  })

  .post('/', requirePerfil(...PERFIS_FLUXOS), zValidator('json', clienteSituacaoSchema), async (c) => {
    const user = c.get('user');
    const data = c.req.valid('json');
    const codigo = codigoDaSituacao(data.nome);
    if (!codigo) return c.json({ error: 'Use letras ou números no nome da situação' }, 400);

    await listarSituacoes(user.firmId); // garante as padrão antes da primeira criada
    const [nova] = await db
      .insert(clienteSituacoes)
      .values({ ...data, codigo, firmId: user.firmId })
      .onConflictDoNothing()
      .returning();
    if (!nova) return c.json({ error: 'Já existe uma situação com esse nome' }, 409);
    return c.json(nova, 201);
  })

  // O código não muda: é ele que está gravado nos clientes e nos fluxos.
  .put('/:id', requirePerfil(...PERFIS_FLUXOS), zValidator('json', clienteSituacaoSchema), async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);
    const data = c.req.valid('json');

    const [atualizada] = await db
      .update(clienteSituacoes)
      .set(data)
      .where(and(eq(clienteSituacoes.id, id), eq(clienteSituacoes.firmId, user.firmId)))
      .returning();
    if (!atualizada) return c.json({ error: 'Situação não encontrada' }, 404);
    return c.json(atualizada);
  })

  .delete('/:id', requirePerfil(...PERFIS_FLUXOS), async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id') ?? '');
    if (id === null) return c.json({ error: 'ID inválido' }, 400);

    const [situacao] = await db
      .select()
      .from(clienteSituacoes)
      .where(and(eq(clienteSituacoes.id, id), eq(clienteSituacoes.firmId, user.firmId)));
    if (!situacao) return c.json({ error: 'Situação não encontrada' }, 404);
    if (situacao.sistema) {
      return c.json({ error: 'Ativo e Inativo são situações do sistema e não podem ser excluídas' }, 400);
    }

    const [emUso] = await db
      .select({ total: sql<number>`count(*)` })
      .from(clientes)
      .where(and(eq(clientes.firmId, user.firmId), eq(clientes.situacao, situacao.codigo)));
    if (Number(emUso.total) > 0) {
      return c.json(
        { error: `${emUso.total} cliente(s) estão nesta situação. Mova-os para outra antes de excluir.` },
        400,
      );
    }

    const fluxos = await db
      .select({ nome: workflows.nome, condicoes: workflows.condicoes, acoes: workflows.acoes })
      .from(workflows)
      .where(eq(workflows.firmId, user.firmId));
    const usam = fluxos.filter(
      (f) =>
        f.condicoes.situacaoAnterior === situacao.codigo ||
        f.condicoes.situacaoNova === situacao.codigo ||
        f.acoes.some((a) => a.tipo === 'ALTERAR_SITUACAO_CLIENTE' && a.situacao === situacao.codigo),
    );
    if (usam.length > 0) {
      return c.json(
        { error: `Usada pelo(s) fluxo(s): ${usam.map((f) => f.nome).join(', ')}. Edite-os antes de excluir.` },
        400,
      );
    }

    await db
      .delete(clienteSituacoes)
      .where(and(eq(clienteSituacoes.id, id), eq(clienteSituacoes.firmId, user.firmId)));
    return c.json({ message: 'Situação excluída' });
  });

export default clienteSituacoesRoutes;
