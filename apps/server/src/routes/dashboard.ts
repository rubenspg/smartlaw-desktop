import { Hono } from 'hono';
import { db } from '../db';
import { clientes, processosJudiciais, processosAdministrativos, andamentos } from '../db/schema';
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { authMiddleware, Variables } from '../middleware/auth';

const dashboard = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  .get('/', async (c) => {
    const user = c.get('user');
    const firmFilter = { firmId: user.firmId };

    const [
      [clientesCount],
      [judiciaisCount],
      [adminCount],
      aquisicaoRows,
      idadeRows,
      cidadeRows,
      profissaoRows,
      comarcaRows,
      situacaoRows,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(clientes)
        .where(eq(clientes.firmId, firmFilter.firmId)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(processosJudiciais)
        .where(eq(processosJudiciais.firmId, firmFilter.firmId)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(processosAdministrativos)
        .where(eq(processosAdministrativos.firmId, firmFilter.firmId)),

      // Aquisição mensal de clientes (usa data_cadastro; fallback created_at)
      db.execute<{ mes: string; total: number }>(sql`
        SELECT
          to_char(date_trunc('month', COALESCE(data_cadastro, created_at)), 'YYYY-MM') AS mes,
          COUNT(*)::int AS total
        FROM clientes
        WHERE firm_id = ${firmFilter.firmId}
          AND COALESCE(data_cadastro, created_at) IS NOT NULL
        GROUP BY 1
        ORDER BY 1 ASC
      `),

      // Demografia — faixas de idade
      db.execute<{ faixa: string; total: number }>(sql`
        SELECT faixa, COUNT(*)::int AS total FROM (
          SELECT
            CASE
              WHEN nascimento IS NULL THEN 'Desconhecida'
              WHEN EXTRACT(YEAR FROM age(nascimento)) < 18 THEN '< 18'
              WHEN EXTRACT(YEAR FROM age(nascimento)) < 30 THEN '18-29'
              WHEN EXTRACT(YEAR FROM age(nascimento)) < 45 THEN '30-44'
              WHEN EXTRACT(YEAR FROM age(nascimento)) < 60 THEN '45-59'
              WHEN EXTRACT(YEAR FROM age(nascimento)) < 75 THEN '60-74'
              ELSE '75+'
            END AS faixa
          FROM clientes
          WHERE firm_id = ${firmFilter.firmId}
        ) t
        GROUP BY faixa
        ORDER BY total DESC
      `),

      // Top cidades
      db
        .select({
          cidade: clientes.municipio,
          total: sql<number>`count(*)::int`,
        })
        .from(clientes)
        .where(and(eq(clientes.firmId, firmFilter.firmId), isNotNull(clientes.municipio)))
        .groupBy(clientes.municipio)
        .orderBy(sql`count(*) desc`)
        .limit(5),

      // Top profissões
      db
        .select({
          profissao: clientes.profissao,
          total: sql<number>`count(*)::int`,
        })
        .from(clientes)
        .where(and(eq(clientes.firmId, firmFilter.firmId), isNotNull(clientes.profissao)))
        .groupBy(clientes.profissao)
        .orderBy(sql`count(*) desc`)
        .limit(5),

      // Judiciais por comarca
      db
        .select({
          comarca: processosJudiciais.comarca,
          total: sql<number>`count(*)::int`,
        })
        .from(processosJudiciais)
        .where(
          and(
            eq(processosJudiciais.firmId, firmFilter.firmId),
            isNotNull(processosJudiciais.comarca),
          ),
        )
        .groupBy(processosJudiciais.comarca)
        .orderBy(sql`count(*) desc`)
        .limit(8),

      // Judiciais por situação
      db
        .select({
          situacao: processosJudiciais.situacao,
          total: sql<number>`count(*)::int`,
        })
        .from(processosJudiciais)
        .where(
          and(
            eq(processosJudiciais.firmId, firmFilter.firmId),
            isNotNull(processosJudiciais.situacao),
          ),
        )
        .groupBy(processosJudiciais.situacao)
        .orderBy(sql`count(*) desc`),
    ]);

    return c.json({
      totais: {
        clientes: Number(clientesCount?.count ?? 0),
        processosJudiciais: Number(judiciaisCount?.count ?? 0),
        processosAdministrativos: Number(adminCount?.count ?? 0),
      },
      aquisicaoClientes: [...aquisicaoRows].map((r: any) => ({
        mes: r.mes,
        total: Number(r.total),
      })),
      demografia: {
        idade: [...idadeRows].map((r: any) => ({
          faixa: r.faixa,
          total: Number(r.total),
        })),
        cidades: cidadeRows.map((r) => ({
          cidade: r.cidade ?? '—',
          total: Number(r.total),
        })),
        profissoes: profissaoRows.map((r) => ({
          profissao: r.profissao ?? '—',
          total: Number(r.total),
        })),
      },
      judiciaisPorComarca: comarcaRows.map((r) => ({
        comarca: r.comarca ?? '—',
        total: Number(r.total),
      })),
      judiciaisPorSituacao: situacaoRows.map((r) => ({
        situacao: r.situacao ?? '—',
        total: Number(r.total),
      })),
    });
  });

const dashboardRoutes = dashboard
  .get('/recentes', async (c) => {
    const user = c.get('user');

    const data = await db.query.andamentos.findMany({
      where: eq(andamentos.firmId, user.firmId),
      with: {
        processoJudicial: {
          columns: { id: true, numero: true },
          with: { cliente: { columns: { id: true, nome: true } } },
        },
        processoAdmin: {
          columns: { id: true, numero: true },
          with: { cliente: { columns: { id: true, nome: true } } },
        },
      },
      orderBy: [desc(andamentos.inclusao)],
      limit: 10,
    });

    return c.json(data);
  });

export default dashboardRoutes;
export type DashboardRoutes = typeof dashboardRoutes;
