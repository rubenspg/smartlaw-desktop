import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { compararVersoes, exigirVersaoMinima } from './versao-app';

describe('compararVersoes', () => {
  it('compara numericamente, não como texto', () => {
    expect(compararVersoes('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compararVersoes('0.2.2', '0.3.0')).toBeLessThan(0);
    expect(compararVersoes('1.0.0', '1.0.0')).toBe(0);
  });

  it('ignora prefixo v, sufixo de pré-release e partes faltando', () => {
    expect(compararVersoes('v0.3.0', '0.3.0')).toBe(0);
    expect(compararVersoes('0.3.0-beta.1', '0.3.0')).toBe(0);
    expect(compararVersoes('0.3', '0.3.0')).toBe(0);
  });
});

describe('exigirVersaoMinima', () => {
  const app = new Hono();
  app.use('*', exigirVersaoMinima('0.3.0'));
  app.get('/x', (c) => c.json({ ok: true }));

  const pedir = (versao?: string) =>
    app.request('/x', { headers: versao ? { 'X-App-Version': versao } : {} });

  it('recusa com 426 o app abaixo da mínima', async () => {
    const res = await pedir('0.2.2');
    expect(res.status).toBe(426);
    expect(await res.json()).toMatchObject({ code: 'APP_DESATUALIZADO', versaoMinima: '0.3.0' });
  });

  it('aceita a mínima e acima', async () => {
    expect((await pedir('0.3.0')).status).toBe(200);
    expect((await pedir('0.10.1')).status).toBe(200);
  });

  it('deixa passar quem não envia o cabeçalho (navegador, scripts, apps antigos)', async () => {
    expect((await pedir()).status).toBe(200);
  });

  it('deixa passar um cabeçalho ilegível em vez de travar o usuário', async () => {
    expect((await pedir('dev')).status).toBe(200);
  });
});
