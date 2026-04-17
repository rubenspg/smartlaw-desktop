import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import routes from './routes';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.route('/', routes);

app.get('/health', (c) => c.json({ status: 'ok' }));

console.log('Server is running on http://localhost:3001');
serve({ fetch: app.fetch, port: 3001 });
