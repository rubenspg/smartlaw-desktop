import { Hono } from 'hono';
import { and, desc, eq, gte, isNull, isNotNull, lte } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db';
import { firms, intimacoes, syncRuns } from '../db/schema';
import { env } from '../env';
import { authMiddleware, Variables } from '../middleware/auth';
import { requirePerfil } from '../middleware/perfil';
import { DatajudClient, resolverChave } from '../services/datajud';
import { DjenClient, sincronizarIntimacoes } from '../services/djen';
import { paginated, parseIdParam, parsePageParams } from '../utils';

const DATA_ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data no formato yyyy-mm-dd');

const syncSchema = z.object({
  /** Janela em dias para trás a partir de hoje (padrão 3). Backfill: 60. */
  dias: z.number().int().min(1).max(120).optional(),
  inicio: DATA_ISO.optional(),
  fim: DATA_ISO.optional(),
});

/** Client do DJEN conforme o ambiente (ver docs/INTEGRACAO_TRIBUNAIS_INSS.md §5-6). */
function djenDoAmbiente() {
  return new DjenClient({ transporte: env.DJEN_TRANSPORT, relayUrl: env.BR_RELAY_URL, relayToken: env.BR_RELAY_TOKEN });
}

async function datajudDaFirma(firmId: string): Promise<DatajudClient | null> {
  const [firm] = await db.select({ key: firms.datajudApiKey }).from(firms).where(eq(firms.id, firmId)).limit(1);
  const { chave } = resolverChave(firm?.key);
  return chave ? new DatajudClient({ apiKey: chave }) : null;
}

// Na listagem o HTML e o `raw` ficam de fora: são ~1-8 KB por item.
const COLUNAS_LISTA = {
  id: true,
  externalId: true,
  numeroProcesso: true,
  processoJudicialId: true,
  siglaTribunal: true,
  tipoComunicacao: true,
  tipoDocumento: true,
  nomeOrgao: true,
  nomeClasse: true,
  link: true,
  meio: true,
  dataDisponibilizacao: true,
  destinatarios: true,
  oabsAlvo: true,
  ativo: true,
  motivoCancelamento: true,
  prazoDias: true,
  prazoPublicacao: true,
  prazoFim: true,
  tarefaId: true,
  lidaEm: true,
  lidaPor: true,
  createdAt: true,
} as const;

const intimacoesRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)

  /**
   * ?lida=0|1 &tribunal=TRF4 &inicio=yyyy-mm-dd &fim=yyyy-mm-dd &processoId=
   * &page &limit. Da mais recente para a mais antiga.
   */
  .get('/', async (c) => {
    const user = c.get('user');
    const q = c.req.query();
    const { page, limit, offset } = parsePageParams(q.page, q.limit ?? '50');

    const where = [eq(intimacoes.firmId, user.firmId)];
    if (q.lida === '0') where.push(isNull(intimacoes.lidaEm));
    if (q.lida === '1') where.push(isNotNull(intimacoes.lidaEm));
    if (q.tribunal) where.push(eq(intimacoes.siglaTribunal, q.tribunal.toUpperCase()));
    if (q.inicio && DATA_ISO.safeParse(q.inicio).success) where.push(gte(intimacoes.dataDisponibilizacao, q.inicio));
    if (q.fim && DATA_ISO.safeParse(q.fim).success) where.push(lte(intimacoes.dataDisponibilizacao, q.fim));
    if (q.processoId) {
      const pid = parseIdParam(q.processoId);
      if (pid === null) return c.json({ error: 'processoId inválido' }, 400);
      where.push(eq(intimacoes.processoJudicialId, pid));
    }

    const [data, total] = await Promise.all([
      db.query.intimacoes.findMany({
        where: and(...where),
        columns: COLUNAS_LISTA,
        with: {
          processo: {
            columns: { id: true, numero: true, situacao: true, clienteId: true },
            with: { cliente: { columns: { id: true, nome: true } } },
          },
        },
        orderBy: [desc(intimacoes.dataDisponibilizacao), desc(intimacoes.id)],
        limit,
        offset,
      }),
      db.$count(intimacoes, and(...where)),
    ]);
    return c.json(paginated(data, total, page, limit));
  })

  /** Últimas rodadas do DJEN (status, contagens, mensagem de erro). */
  .get('/runs', async (c) => {
    const user = c.get('user');
    const data = await db
      .select()
      .from(syncRuns)
      .where(and(eq(syncRuns.firmId, user.firmId), eq(syncRuns.tipo, 'DJEN')))
      .orderBy(desc(syncRuns.iniciadoEm))
      .limit(20);
    return c.json(data);
  })

  /** O servidor consegue falar com o DJEN agora? (`geobloqueado` = túnel fora do ar.) */
  .get('/status', async (c) => {
    const acesso = await djenDoAmbiente().verificarAcesso();
    return c.json({ transporte: env.DJEN_TRANSPORT, acesso });
  })

  .get('/:id', async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);

    const data = await db.query.intimacoes.findFirst({
      where: and(eq(intimacoes.id, id), eq(intimacoes.firmId, user.firmId)),
      columns: { raw: false },
      with: {
        processo: {
          columns: { id: true, numero: true, situacao: true, clienteId: true },
          with: { cliente: { columns: { id: true, nome: true } } },
        },
        tarefa: { columns: { id: true, titulo: true, dataLimite: true, status: true, usuarioId: true } },
      },
    });
    if (!data) return c.json({ error: 'Intimação não encontrada' }, 404);
    return c.json(data);
  })

  .post('/:id/lida', async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);
    const [updated] = await db
      .update(intimacoes)
      .set({ lidaEm: new Date(), lidaPor: user.id, updatedAt: new Date() })
      .where(and(eq(intimacoes.id, id), eq(intimacoes.firmId, user.firmId)))
      .returning({ id: intimacoes.id, lidaEm: intimacoes.lidaEm, lidaPor: intimacoes.lidaPor });
    if (!updated) return c.json({ error: 'Intimação não encontrada' }, 404);
    return c.json(updated);
  })

  .delete('/:id/lida', async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);
    const [updated] = await db
      .update(intimacoes)
      .set({ lidaEm: null, lidaPor: null, updatedAt: new Date() })
      .where(and(eq(intimacoes.id, id), eq(intimacoes.firmId, user.firmId)))
      .returning({ id: intimacoes.id, lidaEm: intimacoes.lidaEm, lidaPor: intimacoes.lidaPor });
    if (!updated) return c.json({ error: 'Intimação não encontrada' }, 404);
    return c.json(updated);
  })

  /**
   * Rodada manual (o job da fase 2 chama o mesmo `sincronizarIntimacoes`).
   * Responde só quando termina: um backfill de 60 dias com ~470 itens e ~260
   * processos novos leva alguns minutos por causa do Datajud.
   */
  .post('/sync', requirePerfil('admin', 'administrativo'), zValidator('json', syncSchema), async (c) => {
    const user = c.get('user');
    const { dias, inicio, fim } = c.req.valid('json');
    const resultado = await sincronizarIntimacoes({
      firmId: user.firmId,
      client: djenDoAmbiente(),
      datajud: await datajudDaFirma(user.firmId),
      dias,
      inicio,
      fim,
    });
    return c.json(resultado, resultado.status === 'SUCESSO' ? 200 : 502);
  });

export default intimacoesRoutes;
