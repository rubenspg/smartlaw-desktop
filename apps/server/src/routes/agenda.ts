import { Hono } from 'hono';
import { db } from '../db';
import { tarefas, profiles, clientes } from '../db/schema';
import { and, eq, gte, isNotNull } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { authMiddleware, Variables } from '../middleware/auth';
import { renderCalendar, type AgendaEvent } from '../services/ical';

/** Quanto de passado entra no feed. Sem limite, anos de prazos viram um arquivo enorme. */
const JANELA_DIAS = 365;

function gerarToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Monta a URL pública de assinatura. Deriva do próprio request para funcionar
 * atrás do túnel sem precisar de configuração, mas PUBLIC_API_URL tem
 * precedência para quando o host visto pelo servidor não é o host público.
 */
function urlDoFeed(requestUrl: string, token: string): string {
  const base = process.env.PUBLIC_API_URL?.replace(/\/+$/, '') ?? new URL(requestUrl).origin;
  return `${base}/agenda/calendar/${token}/agenda.ics`;
}

const agendaRoutes = new Hono<{ Variables: Variables }>()
  /**
   * Feed iCalendar. Deliberadamente SEM authMiddleware: Apple Calendar e Google
   * Calendar apenas buscam a URL, não têm como mandar o Bearer. O segredo é o
   * token do caminho — por isso ele é dedicado, aleatório e revogável, e nunca
   * o JWT.
   */
  .get('/calendar/:token/agenda.ics', async (c) => {
    const token = c.req.param('token');

    // Token curto não chega a consultar o banco.
    if (!token || token.length < 20) {
      return c.text('Not found', 404);
    }

    const dono = await db.query.profiles.findFirst({
      where: and(eq(profiles.agendaToken, token), eq(profiles.ativo, true)),
      columns: { id: true, nome: true },
    });

    // Mesma resposta para token inexistente e usuário inativo: diferenciar
    // permitiria sondar quais tokens existem.
    if (!dono) {
      return c.text('Not found', 404);
    }

    const desde = new Date(Date.now() - JANELA_DIAS * 24 * 60 * 60 * 1000);

    const linhas = await db
      .select({
        id: tarefas.id,
        titulo: tarefas.titulo,
        descricao: tarefas.descricao,
        dataLimite: tarefas.dataLimite,
        prioridade: tarefas.prioridade,
        status: tarefas.status,
        clienteNome: clientes.nome,
      })
      .from(tarefas)
      .leftJoin(clientes, eq(tarefas.clienteId, clientes.id))
      .where(
        and(
          eq(tarefas.usuarioId, dono.id),
          isNotNull(tarefas.dataLimite),
          gte(tarefas.dataLimite, desde),
        ),
      );

    const eventos: AgendaEvent[] = linhas
      .filter((l): l is typeof l & { dataLimite: Date } => l.dataLimite !== null)
      .map((l) => ({
        id: l.id,
        titulo: l.titulo,
        descricao: l.descricao,
        dataLimite: l.dataLimite,
        prioridade: l.prioridade,
        status: l.status,
        clienteNome: l.clienteNome,
      }));

    const ics = renderCalendar(eventos, { nome: `SmartLaw — ${dono.nome}` });

    return new Response(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="agenda.ics"',
        // O feed é pessoal: nada de cache compartilhado no caminho.
        'Cache-Control': 'private, max-age=300',
      },
    });
  })

  /** URL de assinatura do usuário logado, criando o token no primeiro acesso. */
  .get('/feed', authMiddleware, async (c) => {
    const user = c.get('user');

    const atual = await db.query.profiles.findFirst({
      where: eq(profiles.id, user.id),
      columns: { agendaToken: true },
    });

    let token = atual?.agendaToken ?? null;
    if (!token) {
      token = gerarToken();
      await db.update(profiles).set({ agendaToken: token }).where(eq(profiles.id, user.id));
    }

    return c.json({ url: urlDoFeed(c.req.url, token) });
  })

  /** Revoga a URL anterior e emite outra. */
  .post('/feed/rotate', authMiddleware, async (c) => {
    const user = c.get('user');
    const token = gerarToken();

    await db.update(profiles).set({ agendaToken: token }).where(eq(profiles.id, user.id));

    return c.json({ url: urlDoFeed(c.req.url, token) });
  });

export default agendaRoutes;
