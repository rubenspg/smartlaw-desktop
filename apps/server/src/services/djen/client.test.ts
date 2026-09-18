import { describe, it, expect, vi } from 'vitest';
import { DjenClient, DjenError } from './client';
import type { DjenItem } from './types';

const item = (id: number): DjenItem => ({
  id,
  hash: `h${id}`,
  data_disponibilizacao: '2026-09-18',
  siglaTribunal: 'TRF4',
  tipoComunicacao: 'Intimação',
  numero_processo: '50192100820214047100',
});

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

function urlDe(input: RequestInfo | URL): URL {
  return new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
}

describe('paginação', () => {
  it('anda página a página até uma vir curta, ignorando count', async () => {
    const paginas: Record<string, DjenItem[]> = { '1': [item(1), item(2)], '2': [item(3), item(4)], '3': [item(5)] };
    const chamadas: URL[] = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = urlDe(input);
      chamadas.push(url);
      return json({ status: 'success', count: 9999, items: paginas[url.searchParams.get('pagina')!] ?? [] });
    }) as unknown as typeof fetch;

    const client = new DjenClient({ fetchFn, minIntervalMs: 0, itensPorPagina: 2 });
    const tudo = await client.coletarPorOab({ numero: '62492', uf: 'rs' }, { inicio: '2026-09-01', fim: '2026-09-18' });

    expect(tudo.map((i) => i.id)).toEqual([1, 2, 3, 4, 5]);
    expect(chamadas).toHaveLength(3);
    expect(chamadas[0].origin).toBe('https://comunicaapi.pje.jus.br');
    expect(chamadas[0].pathname).toBe('/api/v1/comunicacao');
    expect(chamadas[0].searchParams.get('numeroOab')).toBe('62492');
    expect(chamadas[0].searchParams.get('ufOab')).toBe('RS');
    expect(chamadas[0].searchParams.get('dataDisponibilizacaoInicio')).toBe('2026-09-01');
    expect(chamadas[0].searchParams.get('itensPorPagina')).toBe('2');
    expect(chamadas[2].searchParams.get('pagina')).toBe('3');
  });

  it('página vazia encerra sem erro', async () => {
    const fetchFn = (async () => json({ status: 'success', count: 0, items: [] })) as unknown as typeof fetch;
    const client = new DjenClient({ fetchFn, minIntervalMs: 0 });
    expect(await client.coletarPorOab({ numero: '1', uf: 'RS' })).toEqual([]);
  });
});

describe('erros', () => {
  it('403 vira geobloqueado na hora, sem retentar', async () => {
    const fetchFn = vi.fn(async () => new Response('Forbidden', { status: 403 })) as unknown as typeof fetch;
    const client = new DjenClient({ fetchFn, minIntervalMs: 0 });
    await expect(client.coletarPorOab({ numero: '62492', uf: 'RS' })).rejects.toMatchObject({
      name: 'DjenError',
      tipo: 'geobloqueado',
      status: 403,
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(await client.verificarAcesso()).toBe('geobloqueado');
  });

  it('retenta 5xx e devolve quando a API volta', async () => {
    let n = 0;
    const fetchFn = vi.fn(async () => (++n === 1 ? new Response('', { status: 502 }) : json({ status: 'success', items: [item(1)] }))) as unknown as typeof fetch;
    const client = new DjenClient({ fetchFn, minIntervalMs: 0, maxTentativas: 2 });
    expect((await client.coletarPorOab({ numero: '1', uf: 'RS' })).map((i) => i.id)).toEqual([1]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('erro de rede esgota as tentativas e sobe como rede', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('ECONNRESET');
    }) as unknown as typeof fetch;
    const client = new DjenClient({ fetchFn, minIntervalMs: 0, maxTentativas: 1 });
    await expect(client.obter(1)).rejects.toMatchObject({ tipo: 'rede' });
    expect(await client.verificarAcesso()).toBe('indisponivel');
  });
});

describe('transporte', () => {
  it('relay exige URL', () => {
    expect(() => new DjenClient({ transporte: 'relay' })).toThrow(DjenError);
  });

  it('relay troca a origem e manda o token', async () => {
    const chamadas: Array<{ url: URL; auth: string | undefined }> = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      chamadas.push({ url: urlDe(input), auth: (init?.headers as Record<string, string>)?.Authorization });
      return json({ status: 'success', items: [item(7)] });
    }) as unknown as typeof fetch;
    const client = new DjenClient({ transporte: 'relay', relayUrl: 'https://relay.exemplo/', relayToken: 'segredo', fetchFn, minIntervalMs: 0 });
    expect((await client.obter(7))?.id).toBe(7);
    expect(chamadas[0].url.href).toBe('https://relay.exemplo/api/v1/comunicacao/7');
    expect(chamadas[0].auth).toBe('Bearer segredo');
  });

  it('direct não manda Authorization', async () => {
    const fetchFn = vi.fn(async (_i: RequestInfo | URL, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
      return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), { status: 200, headers: { 'Content-Type': 'application/pdf' } });
    }) as unknown as typeof fetch;
    const client = new DjenClient({ fetchFn, minIntervalMs: 0 });
    const pdf = await client.certidao('abc');
    expect(Array.from(pdf)).toEqual([0x25, 0x50, 0x44, 0x46]);
  });
});
