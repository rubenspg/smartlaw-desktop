import { describe, expect, it } from 'vitest';
import { DatajudClient, DatajudError } from './client';

const rejeitado = () =>
  new Response(
    JSON.stringify({ error: { caused_by: { type: 'es_rejected_execution_exception' } } }),
    { status: 429 },
  );

function cliente(fetchFn: typeof fetch, extra: Partial<ConstructorParameters<typeof DatajudClient>[0]> = {}) {
  return new DatajudClient({ apiKey: 'teste', fetchFn, minIntervalMs: 0, ...extra });
}

describe('DatajudClient — CNJ sobrecarregado', () => {
  it('traduz o 429 do Elasticsearch do CNJ em erro "sobrecarregado"', async () => {
    let chamadas = 0;
    const c = cliente(async () => {
      chamadas++;
      return rejeitado();
    }, { maxTentativas: 2 });

    const err = await c.search('api_publica_tjrs', { size: 0 }).catch((e) => e);
    expect(err).toBeInstanceOf(DatajudError);
    expect(err.tipo).toBe('sobrecarregado');
    expect(err.message).toMatch(/sobrecarregado/);
    expect(chamadas).toBe(2);
  });

  it('respeita o prazo total em vez de esgotar todas as tentativas', async () => {
    let chamadas = 0;
    // Cada resposta demora 400 ms; com prazo de 1 s não cabe a 3ª tentativa.
    const c = cliente(
      async () => {
        chamadas++;
        await new Promise((r) => setTimeout(r, 400));
        return rejeitado();
      },
      { maxTentativas: 5, prazoTotalMs: 1000 },
    );

    const inicio = Date.now();
    const err = await c.search('api_publica_tjrs', { size: 0 }).catch((e) => e);
    expect(err.tipo).toBe('sobrecarregado');
    expect(Date.now() - inicio).toBeLessThan(2000);
    expect(chamadas).toBeLessThan(5);
  });

  it('aborta a requisição presa quando o prazo acaba', async () => {
    const c = cliente(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
      { maxTentativas: 3, prazoTotalMs: 300, timeoutMs: 15_000 },
    );

    const inicio = Date.now();
    const err = await c.search('api_publica_tjrs', { size: 0 }).catch((e) => e);
    expect(err.tipo).toBe('sobrecarregado');
    expect(err.message).toMatch(/não respondeu a tempo/);
    expect(Date.now() - inicio).toBeLessThan(1500);
  });
});
