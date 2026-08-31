import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { env } from './env';
import routes from './routes';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

app.route('/', routes);

app.get('/health', (c) => c.json({ status: 'ok' }));

app.onError((err, c) => {
  console.error(`[Error] ${err.message}`, err);
  return c.json({
    error: err.message || 'Internal Server Error',
  }, 500);
});

console.log(`Server is running on http://localhost:${env.PORT}`);
serve({ fetch: app.fetch, port: env.PORT });
