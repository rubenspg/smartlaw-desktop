import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// O módulo do banco é mockado para exercitar o caminho de falha, que um teste
// de integração não alcança sem derrubar o Postgres de verdade.
const execute = vi.fn();
vi.mock('./index', () => ({ db: { execute: (...a: unknown[]) => execute(...a) } }));

const { verificarBanco } = await import('./health');

beforeEach(() => {
  execute.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('verificarBanco', () => {
  it('é verdadeiro quando a consulta responde', async () => {
    execute.mockResolvedValue([{ '?column?': 1 }]);
    await expect(verificarBanco()).resolves.toBe(true);
  });

  it('é falso quando a consulta rejeita', async () => {
    execute.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(verificarBanco()).resolves.toBe(false);
  });

  // Um banco que aceita a conexão mas não responde é pior que um fora do ar:
  // sem timeout, o /health penduraria e o deploy ficaria esperando.
  it('é falso quando a consulta não responde a tempo', async () => {
    execute.mockImplementation(() => new Promise(() => {}));
    await expect(verificarBanco(50)).resolves.toBe(false);
  });

  it('não vaza a mensagem do erro no retorno', async () => {
    execute.mockRejectedValue(new Error('senha do banco: hunter2'));
    await expect(verificarBanco()).resolves.toBe(false);
  });
});
