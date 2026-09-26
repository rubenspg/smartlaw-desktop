import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import routes from './routes';
import { verificarBanco } from './db/health';
import { CABECALHO_VERSAO_APP, exigirVersaoMinima } from './middleware/versao-app';

/**
 * Monta a aplicação sem subir servidor, para que os testes possam dirigi-la
 * em processo com `app.request(...)` — sem porta, sem rede, sem flakiness.
 */
export function criarApp() {
  const app = new Hono();

  app.use('*', logger());
  app.use(
    '*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', CABECALHO_VERSAO_APP],
      exposeHeaders: ['Content-Length'],
      maxAge: 600,
      credentials: true,
    }),
  );

  app.use('*', exigirVersaoMinima());

  app.route('/', routes);

  /**
   * Prontidão, não apenas vida. Antes isto respondia 200 fixo, então o passo
   * de verificação do deploy provava só que o Node estava escutando: com o
   * Postgres fora, o deploy declarava sucesso e a aplicação estava quebrada.
   */
  app.get('/health', async (c) => {
    const bancoOk = await verificarBanco();

    if (!bancoOk) {
      return c.json({ status: 'error', database: 'unreachable' }, 503);
    }

    return c.json({ status: 'ok', database: 'ok' });
  });

  app.onError((err, c) => {
    console.error(`[Error] ${err.message}`, err);
    return c.json({ error: err.message || 'Internal Server Error' }, 500);
  });

  return app;
}
