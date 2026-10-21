import { describe, it, expect, beforeEach } from 'vitest';
import { criarApp } from '../app';
import { limparBanco, criarFirma, criarUsuario, tokenPara, auth } from '../../test/helpers';

const app = criarApp();

let usuario: Awaited<ReturnType<typeof criarUsuario>>;

beforeEach(async () => {
  await limparBanco();
  const firma = await criarFirma();
  usuario = await criarUsuario({ firmId: firma.id, email: 'u@a.com' });
});

const enviar = async (method: 'POST' | 'PUT', path: string, body: Record<string, unknown>) =>
  app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...auth(await tokenPara(usuario)) },
    body: JSON.stringify(body),
  });

// O formulário envia nascimento: '' quando o campo de data fica em branco, e
// isso chegava ao Postgres como data inválida (500 com o erro cru no toast).
describe('clientes com data de nascimento em branco', () => {
  it('POST cria o cliente com nascimento nulo', async () => {
    const res = await enviar('POST', '/clientes', { tipo: 'F', nome: 'Ana', nascimento: '' });
    expect(res.status).toBe(201);
    expect((await res.json()).nascimento).toBeNull();
  });

  it('PUT limpa o nascimento de um cliente existente', async () => {
    const criado = await enviar('POST', '/clientes', {
      tipo: 'F',
      nome: 'Ana',
      nascimento: '1990-05-01',
    });
    const { id } = await criado.json();

    const res = await enviar('PUT', `/clientes/${id}`, { tipo: 'F', nome: 'Ana', nascimento: '' });
    expect(res.status).toBe(200);
    expect((await res.json()).nascimento).toBeNull();
  });
});
