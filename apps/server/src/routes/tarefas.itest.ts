import { describe, it, expect, beforeEach } from 'vitest';
import { criarApp } from '../app';
import {
  limparBanco,
  criarFirma,
  criarUsuario,
  criarTarefa,
  tokenPara,
  auth,
} from '../../test/helpers';

const app = criarApp();

let firma: Awaited<ReturnType<typeof criarFirma>>;
let outraFirma: Awaited<ReturnType<typeof criarFirma>>;
let admin: Awaited<ReturnType<typeof criarUsuario>>;
let comum: Awaited<ReturnType<typeof criarUsuario>>;
let colega: Awaited<ReturnType<typeof criarUsuario>>;
let estranho: Awaited<ReturnType<typeof criarUsuario>>;

beforeEach(async () => {
  await limparBanco();
  firma = await criarFirma('Firma A');
  outraFirma = await criarFirma('Firma B');
  admin = await criarUsuario({ firmId: firma.id, email: 'admin@a.com', perfil: 'admin' });
  comum = await criarUsuario({ firmId: firma.id, email: 'comum@a.com', perfil: 'usuario' });
  colega = await criarUsuario({ firmId: firma.id, email: 'colega@a.com', perfil: 'usuario' });
  estranho = await criarUsuario({ firmId: outraFirma.id, email: 'x@b.com', perfil: 'admin' });
});

const put = async (id: number, u: typeof comum, body: Record<string, unknown>) =>
  app.request(`/tarefas/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...auth(await tokenPara(u)) },
    body: JSON.stringify(body),
  });

const del = async (id: number, u: typeof comum) =>
  app.request(`/tarefas/${id}`, { method: 'DELETE', headers: auth(await tokenPara(u)) });

const corpoValido = (usuarioId: string) => ({
  usuarioId,
  titulo: 'Atualizada',
  prioridade: 'ALTA',
  status: 'PENDENTE',
});

describe('PUT /tarefas/:id', () => {
  it('usuário comum edita a própria tarefa', async () => {
    const t = await criarTarefa({ firmId: firma.id, usuarioId: comum.id });
    expect((await put(t.id, comum, corpoValido(comum.id))).status).toBe(200);
  });

  // A propriedade central: não-admin não alcança a tarefa de outro.
  it('usuário comum NÃO edita a tarefa de um colega', async () => {
    const t = await criarTarefa({ firmId: firma.id, usuarioId: colega.id });
    expect((await put(t.id, comum, corpoValido(colega.id))).status).toBe(404);
  });

  it('admin edita a tarefa de qualquer um da firma', async () => {
    const t = await criarTarefa({ firmId: firma.id, usuarioId: colega.id });
    expect((await put(t.id, admin, corpoValido(colega.id))).status).toBe(200);
  });

  it('administrativo também edita a de outros', async () => {
    const adm = await criarUsuario({
      firmId: firma.id,
      email: 'adm@a.com',
      perfil: 'administrativo',
    });
    const t = await criarTarefa({ firmId: firma.id, usuarioId: colega.id });
    expect((await put(t.id, adm, corpoValido(colega.id))).status).toBe(200);
  });

  // Isolamento entre escritórios: nem admin atravessa a fronteira da firma.
  it('admin de outra firma NÃO alcança a tarefa', async () => {
    const t = await criarTarefa({ firmId: firma.id, usuarioId: comum.id });
    expect((await put(t.id, estranho, corpoValido(comum.id))).status).toBe(404);
  });

  it('sem token é 401', async () => {
    const t = await criarTarefa({ firmId: firma.id, usuarioId: comum.id });
    const res = await app.request(`/tarefas/${t.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpoValido(comum.id)),
    });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /tarefas/:id', () => {
  it('usuário comum apaga a própria tarefa', async () => {
    const t = await criarTarefa({ firmId: firma.id, usuarioId: comum.id });
    expect((await del(t.id, comum)).status).toBe(200);
  });

  it('usuário comum NÃO apaga a de um colega', async () => {
    const t = await criarTarefa({ firmId: firma.id, usuarioId: colega.id });
    expect((await del(t.id, comum)).status).toBe(404);
  });

  it('a tarefa do colega continua existindo após a tentativa', async () => {
    const t = await criarTarefa({ firmId: firma.id, usuarioId: colega.id });
    await del(t.id, comum);
    const res = await app.request(`/tarefas/${t.id}`, { headers: auth(await tokenPara(colega)) });
    expect(res.status).toBe(200);
  });

  it('admin apaga a de qualquer um da firma', async () => {
    const t = await criarTarefa({ firmId: firma.id, usuarioId: colega.id });
    expect((await del(t.id, admin)).status).toBe(200);
  });

  it('admin de outra firma NÃO apaga', async () => {
    const t = await criarTarefa({ firmId: firma.id, usuarioId: comum.id });
    expect((await del(t.id, estranho)).status).toBe(404);
  });
});

describe('GET /tarefas', () => {
  it('não vaza tarefas de outra firma', async () => {
    await criarTarefa({ firmId: firma.id, usuarioId: comum.id, titulo: 'Da firma A' });
    await criarTarefa({ firmId: outraFirma.id, usuarioId: estranho.id, titulo: 'Da firma B' });

    const res = await app.request('/tarefas', { headers: auth(await tokenPara(comum)) });
    const lista = (await res.json()) as { titulo: string }[];

    expect(lista.map((t) => t.titulo)).toContain('Da firma A');
    expect(lista.map((t) => t.titulo)).not.toContain('Da firma B');
  });

  it('lista tarefas atribuídas a toda a equipe (usuarioId nulo) para qualquer usuário da firma', async () => {
    await criarTarefa({ firmId: firma.id, usuarioId: null, titulo: 'Reunião Geral da Equipe' });

    const res = await app.request('/tarefas', { headers: auth(await tokenPara(comum)) });
    const lista = (await res.json()) as { titulo: string }[];

    expect(lista.map((t) => t.titulo)).toContain('Reunião Geral da Equipe');
  });

  it('filtra tarefas da equipe com ?usuarioId=team', async () => {
    await criarTarefa({ firmId: firma.id, usuarioId: null, titulo: 'Prazo da Equipe' });
    await criarTarefa({ firmId: firma.id, usuarioId: comum.id, titulo: 'Individual Comum' });

    const res = await app.request('/tarefas?usuarioId=team', {
      headers: auth(await tokenPara(comum)),
    });
    const lista = (await res.json()) as { titulo: string }[];

    expect(lista.map((t) => t.titulo)).toContain('Prazo da Equipe');
    expect(lista.map((t) => t.titulo)).not.toContain('Individual Comum');
  });

  it('ao filtrar por usuário individual, inclui as tarefas dele E da equipe', async () => {
    await criarTarefa({ firmId: firma.id, usuarioId: null, titulo: 'Geral Equipe' });
    await criarTarefa({ firmId: firma.id, usuarioId: comum.id, titulo: 'Do Comum' });
    await criarTarefa({ firmId: firma.id, usuarioId: colega.id, titulo: 'Do Colega' });

    const res = await app.request(`/tarefas?usuarioId=${comum.id}`, {
      headers: auth(await tokenPara(comum)),
    });
    const lista = (await res.json()) as { titulo: string }[];

    expect(lista.map((t) => t.titulo)).toContain('Geral Equipe');
    expect(lista.map((t) => t.titulo)).toContain('Do Comum');
    expect(lista.map((t) => t.titulo)).not.toContain('Do Colega');
  });
});

describe('tarefas de toda a equipe (usuarioId nulo)', () => {
  it('permite criar tarefa para toda a equipe com usuarioId nulo', async () => {
    const res = await app.request('/tarefas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth(await tokenPara(comum)) },
      body: JSON.stringify({
        usuarioId: null,
        titulo: 'Alinhamento Semanal',
        prioridade: 'ALTA',
        status: 'PENDENTE',
      }),
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as { id: number; usuarioId: string | null };
    expect(json.usuarioId).toBeNull();
  });

  it('usuário comum pode editar tarefa atribuída à equipe', async () => {
    const t = await criarTarefa({ firmId: firma.id, usuarioId: null, titulo: 'Original' });
    const res = await put(t.id, comum, {
      usuarioId: null,
      titulo: 'Atualizada pela equipe',
      prioridade: 'ALTA',
      status: 'PENDENTE',
    });
    expect(res.status).toBe(200);
  });

  it('usuário comum pode excluir tarefa atribuída à equipe', async () => {
    const t = await criarTarefa({ firmId: firma.id, usuarioId: null, titulo: 'Para deletar' });
    expect((await del(t.id, comum)).status).toBe(200);
  });

  it('usuário comum pode assumir tarefa atribuída à equipe mudando usuarioId para si mesmo', async () => {
    const t = await criarTarefa({ firmId: firma.id, usuarioId: null, titulo: 'Assumir' });
    const res = await put(t.id, comum, {
      usuarioId: comum.id,
      titulo: 'Assumida por mim',
      prioridade: 'MEDIA',
      status: 'PENDENTE',
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { usuarioId: string };
    expect(json.usuarioId).toBe(comum.id);
  });
});

describe('categorias e links de videoconferência', () => {
  it('cria tarefa com categoria AUDIENCIA e link de videoconferência', async () => {
    const res = await app.request('/tarefas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth(await tokenPara(comum)) },
      body: JSON.stringify({
        usuarioId: comum.id,
        titulo: 'Audiência de Instrução',
        categoria: 'AUDIENCIA',
        link: 'https://meet.google.com/abc-defg-hij',
        prioridade: 'ALTA',
        status: 'PENDENTE',
      }),
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      id: number;
      categoria: string;
      link: string;
    };
    expect(json.categoria).toBe('AUDIENCIA');
    expect(json.link).toBe('https://meet.google.com/abc-defg-hij');

    // Recupera e confere no GET
    const getRes = await app.request(`/tarefas/${json.id}`, {
      headers: auth(await tokenPara(comum)),
    });
    expect(getRes.status).toBe(200);
    const getJson = (await getRes.json()) as {
      categoria: string;
      link: string;
    };
    expect(getJson.categoria).toBe('AUDIENCIA');
    expect(getJson.link).toBe('https://meet.google.com/abc-defg-hij');
  });

  it('assume GERAL como categoria padrão quando omitida', async () => {
    const res = await app.request('/tarefas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth(await tokenPara(comum)) },
      body: JSON.stringify({
        usuarioId: comum.id,
        titulo: 'Tarefa Comum',
        prioridade: 'BAIXA',
        status: 'PENDENTE',
      }),
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as { categoria: string };
    expect(json.categoria).toBe('GERAL');
  });
});
