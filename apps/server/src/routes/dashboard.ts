import { Hono } from 'hono';
import { db } from '../db';
import { clientes, processosJudiciais, processosAdministrativos, andamentos, tarefas, honorarios } from '../db/schema';
import { and, desc, eq, isNotNull, isNull, ne, lt, gte, lte, sql, or } from 'drizzle-orm';
import { authMiddleware, Variables } from '../middleware/auth';

const dashboard = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  .get('/', async (c) => {
    const user = c.get('user');

    if (user.perfil === 'usuario') {
      return c.json({ error: 'Acesso negado' }, 403);
    }

    const firmFilter = { firmId: user.firmId };
    const { year: yearParam } = c.req.query();
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

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
      db.execute<{ mes: string; recebido: number; pendente: number; atrasado: number }>(sql`
        SELECT
          to_char(date_trunc('month', data_venc), 'YYYY-MM') AS mes,
          COALESCE(SUM(CASE WHEN status = 'PAGO' THEN valor_pago::numeric ELSE 0 END)::double precision, 0) AS recebido,
          COALESCE(SUM(CASE WHEN status = 'PENDENTE' AND data_venc >= CURRENT_DATE THEN valor::numeric ELSE 0 END)::double precision, 0) AS pendente,
          COALESCE(SUM(CASE WHEN status = 'PENDENTE' AND data_venc < CURRENT_DATE THEN valor::numeric ELSE 0 END)::double precision, 0) AS atrasado
        FROM honorarios
        WHERE firm_id = ${firmFilter.firmId}
          AND EXTRACT(YEAR FROM data_venc) = ${year}
        GROUP BY 1
        ORDER BY 1 ASC
      `),

      // Financeiro: totais do ano selecionado
      db.execute<{ total_recebido: number; total_pendente: number; total_atrasado: number }>(sql`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'PAGO' THEN valor_pago::numeric ELSE 0 END)::double precision, 0) AS total_recebido,
          COALESCE(SUM(CASE WHEN status = 'PENDENTE' AND data_venc >= CURRENT_DATE THEN valor::numeric ELSE 0 END)::double precision, 0) AS total_pendente,
          COALESCE(SUM(CASE WHEN status = 'PENDENTE' AND data_venc < CURRENT_DATE THEN valor::numeric ELSE 0 END)::double precision, 0) AS total_atrasado
        FROM honorarios
        WHERE firm_id = ${firmFilter.firmId}
          AND EXTRACT(YEAR FROM data_venc) = ${year}
      `),

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
            lt(tarefas.dataLimite, new Date()),
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
      financeiro,
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
  .get('/resumo-ia', async (c) => {
    const user = c.get('user');

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

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
      db.select({ count: sql<number>`count(*)::int` }).from(tarefas).where(and(...baseTarefas)),
      db.select({ count: sql<number>`count(*)::int` }).from(tarefas).where(and(...baseTarefas, gte(tarefas.dataLimite, startOfDay), lte(tarefas.dataLimite, endOfDay))),
      db.select({ count: sql<number>`count(*)::int` }).from(tarefas).where(and(...baseTarefas, lt(tarefas.dataLimite, startOfDay))),
      db.select({ count: sql<number>`count(*)::int` }).from(processosJudiciais).where(and(eq(processosJudiciais.firmId, user.firmId), isNull(processosJudiciais.dtArquivado))),
      db.select({ count: sql<number>`count(*)::int` }).from(processosAdministrativos).where(
        and(
          eq(processosAdministrativos.firmId, user.firmId),
          or(isNull(processosAdministrativos.decisao), eq(processosAdministrativos.decisao, '')),
        ),
      ),
    ]);

    const pendencias = {
      tarefasPendentes: Number(tarefasPendentesRow?.count ?? 0),
      tarefasHoje: Number(tarefasHojeRow?.count ?? 0),
      tarefasAtrasadas: Number(tarefasAtrasadasRow?.count ?? 0),
      processosJudiciaisAtivos: Number(judiciaisAtivosRow?.count ?? 0),
      processosAdminAtivos: Number(adminAtivosRow?.count ?? 0),
    };

    const hojeFmt = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    const userPrompt = `Resuma a agenda do advogado para hoje (${hojeFmt}) com base nestes dados:
- Tarefas pendentes no total: ${pendencias.tarefasPendentes}
- Tarefas com prazo hoje: ${pendencias.tarefasHoje}
- Tarefas atrasadas: ${pendencias.tarefasAtrasadas}
- Processos judiciais ativos: ${pendencias.processosJudiciaisAtivos}
- Processos administrativos ativos: ${pendencias.processosAdminAtivos}

Se não houver pendências urgentes (sem tarefas hoje nem atrasadas), faça uma saudação positiva.`;

    const LMSTUDIO_URL = process.env.LMSTUDIO_URL ?? 'http://localhost:1234';
    const LMSTUDIO_MODEL = process.env.LMSTUDIO_MODEL ?? 'google/gemma-4-e4b';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`${LMSTUDIO_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: LMSTUDIO_MODEL,
          messages: [
            { role: 'system', content: 'Você é um assistente jurídico. Responda em português do Brasil, em até 2 frases curtas e diretas, em texto corrido (sem markdown, listas ou cabeçalhos).' },
            { role: 'user', content: userPrompt },
          ],
          stream: false,
          temperature: 0.4,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        if (res.status === 404 || /model.*not.*(found|loaded)/i.test(errText)) {
          return c.json({ texto: `Modelo '${LMSTUDIO_MODEL}' não está carregado no LM Studio.`, status: 'unavailable', pendencias });
        }
        return c.json({ texto: `LM Studio respondeu ${res.status}.`, status: 'error', pendencias });
      }

      const data: any = await res.json();
      const texto = String(data?.choices?.[0]?.message?.content ?? '').trim();
      return c.json({ texto, status: 'ready', pendencias });
    } catch (err: any) {
      clearTimeout(timeout);
      const msg = err?.name === 'AbortError'
        ? 'Tempo esgotado ao gerar resumo.'
        : `IA local indisponível. Verifique se o LM Studio está rodando (porta 1234) com o modelo ${LMSTUDIO_MODEL} carregado.`;
      return c.json({ texto: msg, status: 'unavailable' as const, pendencias });
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
