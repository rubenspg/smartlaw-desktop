import { describe, it, expect, beforeEach } from 'vitest';
import { criarApp } from '../app';
import { limparBanco, criarFirma, criarUsuario, SENHA_PADRAO } from '../../test/helpers';
import { _resetRateLimitState, MAX_FALHAS } from '../middleware/rate-limit';

const app = criarApp();

let firma: Awaited<ReturnType<typeof criarFirma>>;

const login = (email: string, password: string, ip = '203.0.113.1') =>
  app.request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify({ email, password }),
  });

beforeEach(async () => {
  await limparBanco();
  _resetRateLimitState();
  firma = await criarFirma();
  await criarUsuario({ firmId: firma.id, email: 'ativo@a.com' });
  await criarUsuario({ firmId: firma.id, email: 'inativo@a.com', ativo: false });
});

describe('POST /auth/login', () => {
  it('aceita credenciais corretas', async () => {
    const res = await login('ativo@a.com', SENHA_PADRAO);
    expect(res.status).toBe(200);
    const corpo = (await res.json()) as { token: string; user: { email: string } };
    expect(corpo.token).toBeTruthy();
    expect(corpo.user.email).toBe('ativo@a.com');
  });

  it('não devolve o hash da senha', async () => {
    const corpo = await (await login('ativo@a.com', SENHA_PADRAO)).text();
    expect(corpo).not.toContain('passwordHash');
    expect(corpo).not.toContain('$2b$');
  });

  /**
   * Enumeração de e-mails: se "não existe" respondesse diferente de "senha
   * errada", dava para descobrir quem tem conta no escritório testando
   * endereços. As três respostas precisam ser indistinguíveis.
   */
  it('responde igual para inexistente, inativo e senha errada', async () => {
    const inexistente = await login('ninguem@a.com', SENHA_PADRAO, '203.0.113.2');
    const inativo = await login('inativo@a.com', SENHA_PADRAO, '203.0.113.3');
    const senhaErrada = await login('ativo@a.com', 'senha-errada-aqui', '203.0.113.4');

    expect(inexistente.status).toBe(401);
    expect(inativo.status).toBe(401);
    expect(senhaErrada.status).toBe(401);

    const corpos = await Promise.all([inexistente.json(), inativo.json(), senhaErrada.json()]);
    expect(corpos[0]).toEqual(corpos[1]);
    expect(corpos[1]).toEqual(corpos[2]);
  });

  it('recusa corpo malformado com 400, não 500', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'isto não é json',
    });
    expect(res.status).toBe(400);
  });

  it('recusa payload que não bate com o schema', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nao-e-email', password: 'x' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('limite de tentativas, ponta a ponta', () => {
  it('bloqueia após o limite e informa Retry-After', async () => {
    const ip = '198.51.100.99';
    for (let i = 0; i < MAX_FALHAS; i++) {
      expect((await login('ativo@a.com', 'errada-mesmo', ip)).status).toBe(401);
    }

    const bloqueado = await login('ativo@a.com', 'errada-mesmo', ip);
    expect(bloqueado.status).toBe(429);
    expect(Number(bloqueado.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  // Barrar mesmo a senha certa é o comportamento pretendido: caso contrário o
  // atacante saberia que acertou, justamente na tentativa bloqueada.
  it('barra até a senha correta enquanto bloqueado', async () => {
    const ip = '198.51.100.98';
    for (let i = 0; i < MAX_FALHAS; i++) await login('ativo@a.com', 'errada-mesmo', ip);
    expect((await login('ativo@a.com', SENHA_PADRAO, ip)).status).toBe(429);
  });

  it('não afeta outro IP', async () => {
    const ip = '198.51.100.97';
    for (let i = 0; i < MAX_FALHAS; i++) await login('ativo@a.com', 'errada-mesmo', ip);
    expect((await login('ativo@a.com', SENHA_PADRAO, '198.51.100.96')).status).toBe(200);
  });

  it('acerto zera o contador', async () => {
    const ip = '198.51.100.95';
    for (let i = 0; i < MAX_FALHAS - 1; i++) await login('ativo@a.com', 'errada-mesmo', ip);
    expect((await login('ativo@a.com', SENHA_PADRAO, ip)).status).toBe(200);
    for (let i = 0; i < MAX_FALHAS - 1; i++) {
      expect((await login('ativo@a.com', 'errada-mesmo', ip)).status).toBe(401);
    }
  });
});
