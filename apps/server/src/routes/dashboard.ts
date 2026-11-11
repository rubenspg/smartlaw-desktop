import { Hono } from 'hono';
import { db } from '../db';
import { clientes, processosJudiciais, processosAdministrativos, andamentos, tarefas, honorarios } from '../db/schema';
import { and, desc, eq, isNotNull, isNull, ne, lt, gte, lte, sql, or } from 'drizzle-orm';
import { authMiddleware, Variables } from '../middleware/auth';
import { PERFIS_FINANCEIRO, Perfil, requirePerfil } from '../middleware/perfil';
import { env } from '../env';
import { hojeBrasil } from '../services/djen';
import { narrar } from '../services/ia/narrar';
import { carregarDia } from '../services/resumo/dados';
import { avisosDoDia, destaquesDia, INSTRUCAO_DIA, payloadDia, PERGUNTA_DIA, reservaDia } from '../services/resumo/dia';

const dashboard = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  .get('/', requirePerfil('admin', 'administrativo', 'secretaria'), async (c) => {
    const user = c.get('user');
    // Números financeiros só para os perfis do módulo financeiro — os demais
    // recebem o restante do dashboard sem o bloco `financeiro`.
    const podeVerFinanceiro = PERFIS_FINANCEIRO.includes(user.perfil as Perfil);

    const firmFilter = { firmId: user.firmId };
    const { year: yearParam, month: monthParam } = c.req.query();
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();
    const month = monthParam ? parseInt(monthParam) : undefined;

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
      financeiroMensaisRows,
      [financeiroTotaisRow],
      tarefasPorPrioridadeRows,
      tarefasPorStatusRows,
      [tarefasTotalRow],
      [tarefasAtrasadasRow],
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

      // Financeiro: receita mensal agrupada pelo ano selecionado
      db
        .select({
          mes: sql<string>`to_char(date_trunc('month', ${honorarios.dataVenc}), 'YYYY-MM')`,
          recebido: sql<number>`COALESCE(SUM(${honorarios.valorPago})::double precision, 0)`,
          pendente: sql<number>`COALESCE(SUM(CASE WHEN ${honorarios.status} = 'PENDENTE' AND ${honorarios.dataVenc} >= CURRENT_DATE THEN (${honorarios.valor} - COALESCE(${honorarios.valorPago}, 0)) ELSE 0 END)::double precision, 0)`,
          atrasado: sql<number>`COALESCE(SUM(CASE WHEN ${honorarios.status} = 'PENDENTE' AND ${honorarios.dataVenc} < CURRENT_DATE THEN (${honorarios.valor} - COALESCE(${honorarios.valorPago}, 0)) ELSE 0 END)::double precision, 0)`,
        })
        .from(honorarios)
        .where(
          and(
            eq(honorarios.firmId, firmFilter.firmId),
            sql`EXTRACT(YEAR FROM ${honorarios.dataVenc}) = ${year}`,
            month && month > 0 ? sql`EXTRACT(MONTH FROM ${honorarios.dataVenc}) = ${month}` : undefined,
            ne(honorarios.status, 'CANCELADO'),
          ),
        )
        .groupBy(sql`1`)
        .orderBy(sql`1 ASC`),

      // Financeiro: totais do ano/mês selecionado
      db
        .select({
          total_recebido: sql<number>`COALESCE(SUM(${honorarios.valorPago})::double precision, 0)`,
          total_pendente: sql<number>`COALESCE(SUM(CASE WHEN ${honorarios.status} = 'PENDENTE' AND ${honorarios.dataVenc} >= CURRENT_DATE THEN (${honorarios.valor} - COALESCE(${honorarios.valorPago}, 0)) ELSE 0 END)::double precision, 0)`,
          total_atrasado: sql<number>`COALESCE(SUM(CASE WHEN ${honorarios.status} = 'PENDENTE' AND ${honorarios.dataVenc} < CURRENT_DATE THEN (${honorarios.valor} - COALESCE(${honorarios.valorPago}, 0)) ELSE 0 END)::double precision, 0)`,
        })
        .from(honorarios)
        .where(
          and(
            eq(honorarios.firmId, firmFilter.firmId),
            sql`EXTRACT(YEAR FROM ${honorarios.dataVenc}) = ${year}`,
            month && month > 0 ? sql`EXTRACT(MONTH FROM ${honorarios.dataVenc}) = ${month}` : undefined,
            ne(honorarios.status, 'CANCELADO'),
          ),
        ),

      // Tarefas por prioridade (apenas ativas)
      db
        .select({
          prioridade: tarefas.prioridade,
          total: sql<number>`count(*)::int`,
        })
        .from(tarefas)
        .where(and(eq(tarefas.firmId, firmFilter.firmId), ne(tarefas.status, 'CONCLUIDA')))
        .groupBy(tarefas.prioridade)
        .orderBy(sql`count(*) desc`),

      // Tarefas por status
      db
        .select({
          status: tarefas.status,
          total: sql<number>`count(*)::int`,
        })
        .from(tarefas)
        .where(eq(tarefas.firmId, firmFilter.firmId))
        .groupBy(tarefas.status)
        .orderBy(sql`count(*) desc`),

      // Total tarefas ativas
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tarefas)
        .where(and(eq(tarefas.firmId, firmFilter.firmId), ne(tarefas.status, 'CONCLUIDA'))),

      // Tarefas atrasadas (ativas com data_limite no passado)
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tarefas)
        .where(
          and(
            eq(tarefas.firmId, firmFilter.firmId),
            ne(tarefas.status, 'CONCLUIDA'),
            sql`${tarefas.dataLimite} < NOW()`,
          ),
        ),
    ]);

    const financeiroTotais = (financeiroTotaisRow || {}) as any;

    const financeiro = {
      mensais: Array.isArray(financeiroMensaisRows) ? financeiroMensaisRows.map((r: any) => ({
        mes: r.mes || '—',
        recebido: Number(r.recebido || 0),
        pendente: Number(r.pendente || 0),
        atrasado: Number(r.atrasado || 0),
      })) : [],
      totalRecebido: Number(financeiroTotais?.total_recebido || 0),
      totalPendente: Number(financeiroTotais?.total_pendente || 0),
      totalAtrasado: Number(financeiroTotais?.total_atrasado || 0),
    };

    const tarefasStats = {
      total: Number(tarefasTotalRow?.count || 0),
      atrasadas: Number(tarefasAtrasadasRow?.count || 0),
      porPrioridade: Array.isArray(tarefasPorPrioridadeRows) ? tarefasPorPrioridadeRows.map((r) => ({
        prioridade: r.prioridade ?? 'Sem prioridade',
        total: Number(r.total || 0),
      })) : [],
      porStatus: Array.isArray(tarefasPorStatusRows) ? tarefasPorStatusRows.map((r) => ({
        status: r.status ?? 'Sem status',
        total: Number(r.total || 0),
      })) : [],
    };

    const responseData = {
      serverTime: new Date().toISOString(),
      totais: {
        clientes: Number(clientesCount?.count || 0),
        processosJudiciais: Number(judiciaisCount?.count || 0),
        processosAdministrativos: Number(adminCount?.count || 0),
      },
      aquisicaoClientes: Array.isArray(aquisicaoRows) ? aquisicaoRows.map((r: any) => ({
        mes: r.mes || '—',
        total: Number(r.total || 0),
      })) : [],
      demografia: {
        idade: Array.isArray(idadeRows) ? idadeRows.map((r: any) => ({
          faixa: r.faixa || '—',
          total: Number(r.total || 0),
        })) : [],
        cidades: Array.isArray(cidadeRows) ? cidadeRows.map((r) => ({
          cidade: r.cidade ?? '—',
          total: Number(r.total || 0),
        })) : [],
        profissoes: Array.isArray(profissaoRows) ? profissaoRows.map((r) => ({
          profissao: r.profissao ?? '—',
          total: Number(r.total || 0),
        })) : [],
      },
      judiciaisPorComarca: Array.isArray(comarcaRows) ? comarcaRows.map((r) => ({
        comarca: r.comarca ?? '—',
        total: Number(r.total || 0),
      })) : [],
      judiciaisPorSituacao: Array.isArray(situacaoRows) ? situacaoRows.map((r) => ({
        situacao: r.situacao ?? '—',
        total: Number(r.total || 0),
      })) : [],
      ...(podeVerFinanceiro ? { financeiro } : {}),
      tarefas: tarefasStats,
    };

    return c.json(responseData);
  });

const dashboardRoutes = dashboard
  .get('/resumo-pendencias', async (c) => {
    const user = c.get('user');

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Tarefas: respeita escopo (usuario vê só as próprias; admin/administrativo veem todas da firma)
    const baseTarefas = [
      eq(tarefas.firmId, user.firmId),
      ne(tarefas.status, 'CONCLUIDA'),
    ];
    if (user.perfil !== 'admin' && user.perfil !== 'administrativo') {
      baseTarefas.push(eq(tarefas.usuarioId, user.id));
    }

    const [
      [tarefasPendentesRow],
      [tarefasHojeRow],
      [tarefasAtrasadasRow],
      [judiciaisAtivosRow],
      [adminAtivosRow],
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tarefas)
        .where(and(...baseTarefas)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tarefas)
        .where(and(...baseTarefas, gte(tarefas.dataLimite, startOfDay), lte(tarefas.dataLimite, endOfDay))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tarefas)
        .where(and(...baseTarefas, lt(tarefas.dataLimite, startOfDay))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(processosJudiciais)
        .where(and(eq(processosJudiciais.firmId, user.firmId), isNull(processosJudiciais.dtArquivado))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(processosAdministrativos)
        .where(
          and(
            eq(processosAdministrativos.firmId, user.firmId),
            or(isNull(processosAdministrativos.decisao), eq(processosAdministrativos.decisao, '')),
          ),
        ),
    ]);

    return c.json({
      tarefasPendentes: Number(tarefasPendentesRow?.count ?? 0),
      tarefasHoje: Number(tarefasHojeRow?.count ?? 0),
      tarefasAtrasadas: Number(tarefasAtrasadasRow?.count ?? 0),
      processosJudiciaisAtivos: Number(judiciaisAtivosRow?.count ?? 0),
      processosAdminAtivos: Number(adminAtivosRow?.count ?? 0),
    });
  })
  /**
   * "Resumo do dia" da tela inicial: tarefas do próprio usuário mais as
   * novidades do escritório. O modelo recebe só agregados e o texto é conferido
   * número a número (services/ia/narrar.ts); sem IA, volta o texto calculado.
   */
  .get('/resumo-ia', requirePerfil('admin', 'administrativo', 'secretaria', 'usuario'), async (c) => {
    const user = c.get('user');
    try {
      const { dados, itens } = await carregarDia(user.firmId, user.id, hojeBrasil());
      const ia = await narrar({
        firmId: user.firmId,
        tarefa: 'dashboard:resumo-dia',
        instrucao: INSTRUCAO_DIA,
        pergunta: PERGUNTA_DIA,
        payload: payloadDia(dados),
        reserva: reservaDia(dados),
        apiKey: env.GOOGLE_API_KEY,
        modelo: env.GOOGLE_AI_MODEL,
      });
      return c.json({
        data: dados.hoje,
        desde: dados.desde,
        resumo: ia.narracao.resumo,
        pontos: ia.narracao.pontos,
        origem: ia.origem,
        destaques: destaquesDia(dados),
        itens,
        avisos: avisosDoDia(dados),
      });
    } catch (err) {
      console.error('[dashboard] erro ao montar o resumo do dia:', err instanceof Error ? err.message : err);
      return c.json({ error: 'Não foi possível montar o resumo do dia.' }, 500);
    }
  })
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
