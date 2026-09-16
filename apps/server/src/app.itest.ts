import { describe, it, expect, beforeAll } from 'vitest';
import { criarApp } from './app';

const app = criarApp();

describe('GET /health', () => {
  beforeAll(() => {
    // garante que o módulo do banco carregou com a URL de teste
    expect(process.env.DATABASE_URL).toContain('smartlaw_test');
  });

  it('responde 200 quando o banco responde', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', database: 'ok' });
  });

  // A regressão que isto tranca: /health devolvia 200 fixo, então o passo de
  // verificação do deploy provava apenas que o Node estava escutando.
  it('consulta o banco de verdade, não devolve 200 fixo', async () => {
    const res = await app.request('/health');
    const corpo = (await res.json()) as Record<string, unknown>;
    expect(corpo).toHaveProperty('database');
  });
});
