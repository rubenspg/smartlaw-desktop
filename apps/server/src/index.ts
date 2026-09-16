import { serve } from '@hono/node-server';
import { env } from './env';
import { criarApp } from './app';

const app = criarApp();

console.log(`Server is running on http://localhost:${env.PORT}`);
serve({ fetch: app.fetch, port: env.PORT });
