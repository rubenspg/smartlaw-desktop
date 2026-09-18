import { Hono } from 'hono';
import { db } from '../db';
import { processosJudiciais, clientes, andamentos, firms, municipios, processoInstancias } from '../db/schema';
import { eq, and, ilike, or, desc, asc, sql } from 'drizzle-orm';
import { authMiddleware, Variables } from '../middleware/auth';
import {
  DatajudClient,
  DatajudError,
  NumeroCnjInvalidoError,
  formatarNumeroCnj,
  ordenarMovimentos,
  parseDataAjuizamento,
  resolverChave,
  sincronizarProcesso,
  classificarSituacao,
  somenteDigitos,
  validarNumeroCnj,
} from '../services/datajud';
import { processoJudicialSchema } from '@smartlaw/shared';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { parseIdParam, parsePageParams, paginated } from '../utils';

const querySchema = z.object({
  q: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  clienteId: z.string().optional(),
});

const datajudSearchSchema = z.object({ numero: z.string().min(1, 'Número é obrigatório') });

const processosJudiciaisRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  
  .get('/', zValidator('query', querySchema), async (c) => {
    const user = c.get('user');
    const { q, page: pageParam, limit: limitParam, clienteId } = c.req.valid('query');
    const { page, limit, offset } = parsePageParams(pageParam, limitParam);

    // Single shape for the list regardless of whether a search term is present:
    // a narrow projection plus the client fields the list and WhatsApp action use.
    const where = [eq(processosJudiciais.firmId, user.firmId)];

    if (q) {
      const cleanQ = q.replace(/\D/g, '');
      const searchConditions = [
        ilike(processosJudiciais.numero, `%${q}%`),
        ilike(clientes.nome, `%${q}%`),
      ];
      if (cleanQ.length > 0) {
        searchConditions.push(sql`REPLACE(REPLACE(${processosJudiciais.numero}, '.', ''), '-', '') ILIKE ${`%${cleanQ}%`}`);
      }
      where.push(or(...searchConditions)!);
    }

    if (clienteId) {
      where.push(eq(processosJudiciais.clienteId, parseInt(clienteId)));
    }

    const [totalRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(processosJudiciais)
      .leftJoin(clientes, eq(processosJudiciais.clienteId, clientes.id))
      .where(and(...where));

    const data = await db
      .select({
        id: processosJudiciais.id,
        clienteId: processosJudiciais.clienteId,
        numero: processosJudiciais.numero,
        situacao: processosJudiciais.situacao,
        lastSync: processosJudiciais.lastSync,
        syncStatus: processosJudiciais.syncStatus,
        createdAt: processosJudiciais.createdAt,
        cliente: {
          id: clientes.id,
          nome: clientes.nome,
          celular: clientes.celular,
          telefone1: clientes.telefone1,
          telefone2: clientes.telefone2,
        },
      })
      .from(processosJudiciais)
      .leftJoin(clientes, eq(processosJudiciais.clienteId, clientes.id))
      .where(and(...where))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(processosJudiciais.createdAt));

    return c.json(paginated(data, Number(totalRow?.count ?? 0), page, limit));
  })

  .get('/:id', async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);

    const data = await db.query.processosJudiciais.findFirst({
      where: and(eq(processosJudiciais.id, id), eq(processosJudiciais.firmId, user.firmId)),
      with: {
        cliente: true,
        andamentos: {
          orderBy: [desc(andamentos.data)]
        },
        partes: {
          with: {
            posicao: true
          }
        },
        instancias: {
          columns: { raw: false },
          orderBy: [asc(processoInstancias.grauOrdem), asc(processoInstancias.dataHoraUltimaAtualizacao)],
        },
      }
    });

    if (!data) return c.json({ error: 'Processo não encontrado' }, 404);
    return c.json(data);
  })

  .put('/:id', zValidator('json', processoJudicialSchema), async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);
    const data = c.req.valid('json');

    const [updatedProcesso] = await db
      .update(processosJudiciais)
      .set({
        ...data,
        distribuicao: data.distribuicao ? new Date(data.distribuicao) : null,
        updatedAt: new Date(),
      })
      .where(and(eq(processosJudiciais.id, id), eq(processosJudiciais.firmId, user.firmId)))
      .returning();

    if (!updatedProcesso) {
      return c.json({ error: 'Processo não encontrado' }, 404);
    }

    return c.json(updatedProcesso);
  })

  .delete('/:id', async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);

    const [deletedProcesso] = await db
      .delete(processosJudiciais)
      .where(and(eq(processosJudiciais.id, id), eq(processosJudiciais.firmId, user.firmId)))
      .returning();

    if (!deletedProcesso) {
      return c.json({ error: 'Processo não encontrado' }, 404);
    }

    return c.json({ message: 'Processo excluído com sucesso' });
  })

  .post('/', zValidator('json', processoJudicialSchema), async (c) => {
    const user = c.get('user');
    const data = c.req.valid('json');

    const [newProcesso] = await db
      .insert(processosJudiciais)
      .values({
        ...data,
        firmId: user.firmId,
        dataCadastro: new Date(),
        distribuicao: data.distribuicao ? new Date(data.distribuicao) : null,
      })
      .returning();

    return c.json(newProcesso, 201);
  })

  /**
   * Consulta o Datajud antes de cadastrar. Devolve TODAS as instâncias do
   * processo (G1, G2, JE, TR…) resumidas, mais os campos sugeridos para o
   * formulário. Os movimentos completos entram no banco só na sincronização.
   */
  .post('/datajud/search', zValidator('json', datajudSearchSchema), async (c) => {
    const user = c.get('user');
    const { numero } = c.req.valid('json');
    const digitos = somenteDigitos(numero);
    if (!validarNumeroCnj(digitos)) {
      return c.json({ error: 'Número CNJ inválido: confira os 20 dígitos e os dígitos verificadores.' }, 400);
    }

    try {
      const client = await clientDaFirma(user.firmId);
      const hits = await client.buscarPorNumero(digitos);
      const origem = hits[0]?._source;
      const classificacao = classificarSituacao(hits);

      // Comarca a partir do município IBGE do órgão de origem, quando a tabela
      // de municípios foi importada (o seed padrão a deixa vazia).
      let comarcaSugerida: string | null = null;
      const ibge = origem?.orgaoJulgador?.codigoMunicipioIBGE;
      if (ibge) {
        const [m] = await db
          .select({ comarca: municipios.comarca, nome: municipios.nome })
          .from(municipios)
          .where(eq(municipios.codIbge, String(ibge)))
          .limit(1);
        comarcaSugerida = m?.comarca ?? m?.nome ?? null;
      }

      return c.json({
        numero: digitos,
        numeroFormatado: formatarNumeroCnj(digitos),
        encontrado: hits.length > 0,
        sugestao: origem
          ? {
              justica: origem.tribunal ?? null,
              juizo: origem.orgaoJulgador?.nome ?? null,
              orgaoJulgador: origem.orgaoJulgador?.nome ?? null,
              comarca: comarcaSugerida,
              distribuicao: parseDataAjuizamento(origem.dataAjuizamento)?.toISOString() ?? null,
              situacao: classificacao.situacao,
              estagio: classificacao.estagio,
              resultado: classificacao.resultado,
              motivoSituacao: classificacao.motivo,
            }
          : null,
        instancias: hits.map((h) => {
          const s = h._source;
          const movimentos = ordenarMovimentos(s.movimentos);
          return {
            docId: h._id,
            tribunal: s.tribunal ?? null,
            grau: s.grau ?? null,
            classe: s.classe?.nome ?? null,
            orgaoJulgador: s.orgaoJulgador?.nome ?? null,
            sistema: s.sistema?.nome ?? null,
            formato: s.formato?.nome ?? null,
            assuntos: (s.assuntos ?? []).map((a) => a.nome),
            dataAjuizamento: parseDataAjuizamento(s.dataAjuizamento)?.toISOString() ?? null,
            dataHoraUltimaAtualizacao: s.dataHoraUltimaAtualizacao ?? null,
            totalMovimentos: movimentos.length,
            ultimoMovimento: movimentos[0] ? { nome: movimentos[0].nome, dataHora: movimentos[0].dataHora } : null,
          };
        }),
      });
    } catch (err) {
      const { mensagem, status } = erroDatajud(err);
      return c.json({ error: mensagem }, status);
    }
  })

  /**
   * Traz o processo ao estado do tribunal: instâncias + um andamento por
   * movimento. Idempotente; ver services/datajud/sincronizar.ts.
   */
  .post('/:id/sync', async (c) => {
    const user = c.get('user');
    const id = parseIdParam(c.req.param('id'));
    if (id === null) return c.json({ error: 'ID inválido' }, 400);

    const local = await db.query.processosJudiciais.findFirst({
      where: and(eq(processosJudiciais.id, id), eq(processosJudiciais.firmId, user.firmId)),
      columns: {
        id: true, firmId: true, numero: true, juizo: true, justica: true, orgaoJulgador: true,
        comarca: true, situacao: true, distribuicao: true, dtArquivado: true,
      },
    });
    if (!local) return c.json({ error: 'Processo não encontrado' }, 404);

    if (!validarNumeroCnj(local.numero)) {
      return c.json({ error: 'O número deste processo não está no padrão CNJ; não é possível sincronizar.' }, 400);
    }

    try {
      const client = await clientDaFirma(user.firmId);
      const resultado = await sincronizarProcesso(local, client);
      if (!resultado.encontrado) return c.json({ error: 'Processo não encontrado no Datajud' }, 404);
      return c.json({ success: true, ...resultado });
    } catch (err) {
      const { mensagem, status } = erroDatajud(err);
      return c.json({ error: mensagem }, status);
    }
  });

async function clientDaFirma(firmId: string): Promise<DatajudClient> {
  const [firm] = await db.select({ key: firms.datajudApiKey }).from(firms).where(eq(firms.id, firmId)).limit(1);
  const { chave } = resolverChave(firm?.key);
  return new DatajudClient({ apiKey: chave });
}

/**
 * Mapeia falhas do Datajud para (mensagem, status). Devolve dados em vez de
 * chamar `c.json` para que o Hono continue inferindo o tipo da resposta de
 * sucesso para o cliente tipado do desktop.
 */
function erroDatajud(err: unknown): { mensagem: string; status: 400 | 502 } {
  if (err instanceof NumeroCnjInvalidoError) return { mensagem: err.message, status: 400 };
  if (err instanceof DatajudError) {
    if (err.tipo === 'sem_chave' || err.tipo === 'chave_invalida') return { mensagem: err.message, status: 400 };
    console.error('[Datajud]', err.tipo, err.status, err.message);
    return { mensagem: 'Datajud indisponível no momento. Tente novamente em instantes.', status: 502 };
  }
  console.error('[Datajud] erro inesperado:', err);
  return { mensagem: 'Erro ao consultar o Datajud.', status: 502 };
}

export default processosJudiciaisRoutes;
