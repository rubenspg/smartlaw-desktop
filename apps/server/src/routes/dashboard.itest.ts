import { describe, it, expect, beforeEach } from 'vitest';
import { criarApp } from '../app';
import { db } from '../db';
import { tarefas } from '../db/schema';
import { limparBanco, criarFirma, criarUsuario, tokenPara, auth } from '../../test/helpers';

const app = criarApp();

let firma: Awaited<ReturnType<typeof criarFirma>>;
let outraFirma: Awaited<ReturnType<typeof criarFirma>>;
let admin: Awaited<ReturnType<typeof criarUsuario>>;
let comum: Awaited<ReturnType<typeof criarUsuario>>;
let estranho: Awaited<ReturnType<typeof criarUsuario>>;

const ONTEM = new Date(Date.now() - 2 * 86_400_000);

const tarefaAtrasada = (firmId: string, usuarioId: string, titulo: string, status = 'PENDENTE') =>
  db.insert(tarefas).values({ firmId, usuarioId, titulo, prioridade: 'ALTA', status, dataLimite: ONTEM });

const resumo = async (u: typeof comum) => {
  const res = await app.request('/dashboard/resumo-ia', { headers: auth(await tokenPara(u)) });
  expect(res.status).toBe(200);
  return (await res.json()) as {
    origem: string;
    resumo: string;
    destaques: { chave: string; valor: string }[];
    itens: { titulo: string; atrasada: boolean }[];
  };
};

beforeEach(async () => {
  await limparBanco();
  firma = await criarFirma('Firma A');
  outraFirma = await criarFirma('Firma B');
  admin = await criarUsuario({ firmId: firma.id, email: 'admin@a.com', perfil: 'admin' });
  comum = await criarUsuario({ firmId: firma.id, email: 'comum@a.com', perfil: 'usuario' });
  estranho = await criarUsuario({ firmId: outraFirma.id, email: 'x@b.com', perfil: 'admin' });
});

describe('GET /dashboard/resumo-ia', () => {
  it('exige autenticação', async () => {
    expect((await app.request('/dashboard/resumo-ia')).status).toBe(401);
  });

  it('conta só as tarefas pendentes do próprio usuário', async () => {
    await tarefaAtrasada(firma.id, comum.id, 'Minha');
    await tarefaAtrasada(firma.id, comum.id, 'Minha concluída', 'CONCLUIDA');
    await tarefaAtrasada(firma.id, admin.id, 'Do admin');
    await tarefaAtrasada(outraFirma.id, estranho.id, 'De outra firma');

    const r = await resumo(comum);
    expect(r.destaques.find((d) => d.chave === 'atrasadas')?.valor).toBe('1');
    expect(r.itens).toEqual([expect.objectContaining({ titulo: 'Minha', atrasada: true })]);
    // Sem GOOGLE_API_KEY nos testes: o texto é o calculado.
    expect(r.origem).toBe('calculado');
    expect(r.resumo).toContain('1 tarefa atrasada');
  });

  // O resumo é pessoal até para admin: as tarefas dos colegas não entram.
  it('admin não vê as tarefas dos colegas nem as de outra firma', async () => {
    await tarefaAtrasada(firma.id, comum.id, 'Do colega');
    await tarefaAtrasada(outraFirma.id, estranho.id, 'De outra firma');

    const r = await resumo(admin);
    expect(r.destaques.find((d) => d.chave === 'atrasadas')?.valor).toBe('0');
    expect(r.itens).toEqual([]);
  });
});
