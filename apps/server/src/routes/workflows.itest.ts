import { describe, it, expect, beforeEach } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { criarApp } from '../app';
import { db } from '../db';
import { clientes, profiles, tarefas, workflowExecucoes } from '../db/schema';
import { limparBanco, criarFirma, criarUsuario, tokenPara, auth } from '../../test/helpers';

const app = criarApp();

let firma: Awaited<ReturnType<typeof criarFirma>>;
let outraFirma: Awaited<ReturnType<typeof criarFirma>>;
let admin: Awaited<ReturnType<typeof criarUsuario>>;
let secretaria: Awaited<ReturnType<typeof criarUsuario>>;
let advogado: Awaited<ReturnType<typeof criarUsuario>>;
let adminB: Awaited<ReturnType<typeof criarUsuario>>;

beforeEach(async () => {
  await limparBanco();
  firma = await criarFirma('Firma A');
  outraFirma = await criarFirma('Firma B');
  admin = await criarUsuario({ firmId: firma.id, email: 'admin@a.com', perfil: 'admin', nome: 'Rubens' });
  secretaria = await criarUsuario({ firmId: firma.id, email: 'sec@a.com', perfil: 'secretaria', nome: 'Ana' });
  advogado = await criarUsuario({ firmId: firma.id, email: 'adv@a.com', perfil: 'usuario', nome: 'Beto' });
  adminB = await criarUsuario({ firmId: outraFirma.id, email: 'admin@b.com', perfil: 'admin' });
});

const req = async (
  method: string,
  path: string,
  u: typeof admin,
  body?: Record<string, unknown>,
) =>
  app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...auth(await tokenPara(u)) },
    body: body ? JSON.stringify(body) : undefined,
  });

const coletaDocumentos = (usuarioId: string, extra: Record<string, unknown> = {}) => ({
  nome: 'Novo cliente → coleta de documentos',
  gatilho: 'CLIENTE_CRIADO',
  acoes: [
    { tipo: 'ALTERAR_SITUACAO_CLIENTE', situacao: 'EM_REVISAO' },
    {
      tipo: 'CRIAR_TAREFA',
      titulo: 'Coletar documentos de {{cliente.nome}}',
      descricao: 'Cadastrado por {{usuario.nome}}',
      usuarioId,
      prazoDias: 3,
      prioridade: 'ALTA',
      categoria: 'DILIGENCIA',
    },
  ],
  ...extra,
});

const novoCliente = async (u: typeof admin, extra: Record<string, unknown> = {}) => {
  const res = await req('POST', '/clientes', u, { tipo: 'F', nome: 'Maria Souza', ...extra });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: number; situacao: string };
};

describe('permissões', () => {
  it('só admin gerencia fluxos', async () => {
    expect((await req('GET', '/workflows', advogado)).status).toBe(403);
    expect((await req('GET', '/workflows', secretaria)).status).toBe(403);
    expect((await req('POST', '/workflows', advogado, coletaDocumentos(secretaria.id))).status).toBe(403);
    expect((await req('GET', '/workflows', admin)).status).toBe(200);
  });

  it('recusa responsável de outra firma', async () => {
    const res = await req('POST', '/workflows', admin, coletaDocumentos(adminB.id));
    expect(res.status).toBe(400);
  });

  it('recusa situação que a firma não tem', async () => {
    const corpo = coletaDocumentos(secretaria.id);
    corpo.acoes[0] = { tipo: 'ALTERAR_SITUACAO_CLIENTE', situacao: 'NAO_EXISTE' };
    expect((await req('POST', '/workflows', admin, corpo)).status).toBe(400);
  });

  it('admin de outra firma não vê nem edita o fluxo', async () => {
    const criado = (await (await req('POST', '/workflows', admin, coletaDocumentos(secretaria.id))).json()) as { id: number };
    expect((await req('GET', `/workflows/${criado.id}`, adminB)).status).toBe(404);
    expect((await req('DELETE', `/workflows/${criado.id}`, adminB)).status).toBe(404);
    expect(((await (await req('GET', '/workflows', adminB)).json()) as unknown[]).length).toBe(0);
  });
});

describe('CLIENTE_CRIADO', () => {
  it('muda a situação e cria a tarefa para a pessoa escolhida', async () => {
    expect((await req('POST', '/workflows', admin, coletaDocumentos(secretaria.id))).status).toBe(201);

    const cliente = await novoCliente(advogado);
    expect(cliente.situacao).toBe('EM_REVISAO'); // a resposta já reflete o fluxo

    const [t] = await db.select().from(tarefas).where(eq(tarefas.clienteId, cliente.id));
    expect(t.usuarioId).toBe(secretaria.id);
    expect(t.titulo).toBe('Coletar documentos de Maria Souza');
    expect(t.descricao).toBe('Cadastrado por Beto');
    expect(t.prioridade).toBe('ALTA');
    expect(t.categoria).toBe('DILIGENCIA');
    expect(t.dataLimite).not.toBeNull();
    expect(t.workflowExecucaoId).not.toBeNull();

    const execs = await db.select().from(workflowExecucoes);
    expect(execs).toHaveLength(1);
    expect(execs[0].status).toBe('SUCESSO');
    expect(execs[0].resultado).toEqual([
      'Situação: Ativo → Em revisão',
      'Tarefa "Coletar documentos de Maria Souza" para Ana',
    ]);
  });

  it('fluxo inativo não roda', async () => {
    await req('POST', '/workflows', admin, coletaDocumentos(secretaria.id, { ativo: false }));
    const cliente = await novoCliente(admin);
    expect(cliente.situacao).toBe('A');
    expect(await db.select().from(tarefas)).toHaveLength(0);
  });

  it('fluxo de outra firma não roda', async () => {
    await req('POST', '/workflows', adminB, {
      ...coletaDocumentos(adminB.id),
    });
    const cliente = await novoCliente(admin);
    expect(cliente.situacao).toBe('A');
    expect(await db.select().from(tarefas)).toHaveLength(0);
  });

  it('respeita a condição de tipo de cliente', async () => {
    await req('POST', '/workflows', admin, coletaDocumentos(secretaria.id, { condicoes: { tipoCliente: 'J' } }));
    const pf = await novoCliente(admin);
    expect(pf.situacao).toBe('A');
    const pj = await novoCliente(admin, { tipo: 'J', nome: 'ACME Ltda' });
    expect(pj.situacao).toBe('EM_REVISAO');
  });

  it('responsável desativado: a tarefa vai para o admin mais antigo', async () => {
    await req('POST', '/workflows', admin, coletaDocumentos(secretaria.id));
    await db.update(profiles).set({ ativo: false }).where(eq(profiles.id, secretaria.id));

    const cliente = await novoCliente(advogado);
    const [t] = await db.select().from(tarefas).where(eq(tarefas.clienteId, cliente.id));
    expect(t.usuarioId).toBe(admin.id);
  });

  it('fluxo quebrado não impede o cadastro e fica como ERRO no histórico', async () => {
    const criado = (await (await req('POST', '/workflows', admin, coletaDocumentos(secretaria.id))).json()) as { id: number };
    // Situação apagada por fora depois de o fluxo ser salvo.
    await db.execute(sql`DELETE FROM cliente_situacoes WHERE codigo = 'EM_REVISAO'`);

    const cliente = await novoCliente(admin);
    expect(cliente.situacao).toBe('A');
    expect(await db.select().from(tarefas)).toHaveLength(0); // a transação do fluxo foi desfeita

    const res = await req('GET', `/workflows/execucoes?workflowId=${criado.id}`, admin);
    const execs = (await res.json()) as { status: string; erro: string; clienteNome: string }[];
    expect(execs[0].status).toBe('ERRO');
    expect(execs[0].erro).toMatch(/não existe mais/);
    expect(execs[0].clienteNome).toBe('Maria Souza');
  });
});

describe('CLIENTE_SITUACAO_ALTERADA', () => {
  it('dispara quando a situação muda na edição', async () => {
    await req('POST', '/workflows', admin, {
      nome: 'Documentação completa → advogado',
      gatilho: 'CLIENTE_SITUACAO_ALTERADA',
      condicoes: { situacaoAnterior: 'EM_REVISAO', situacaoNova: 'A' },
      acoes: [{ tipo: 'CRIAR_TAREFA', titulo: 'Analisar o caso de {{cliente.nome}}', usuarioId: advogado.id }],
    });
    const cliente = await novoCliente(admin, { situacao: 'EM_REVISAO' });
    expect(await db.select().from(tarefas)).toHaveLength(0);

    const res = await req('PUT', `/clientes/${cliente.id}`, secretaria, { tipo: 'F', nome: 'Maria Souza', situacao: 'A' });
    expect(res.status).toBe(200);
    const [t] = await db.select().from(tarefas);
    expect(t.usuarioId).toBe(advogado.id);
    expect(t.titulo).toBe('Analisar o caso de Maria Souza');
  });

  it('encadeia a partir de um fluxo de cadastro', async () => {
    await req('POST', '/workflows', admin, coletaDocumentos(secretaria.id));
    await req('POST', '/workflows', admin, {
      nome: 'Em revisão → avisa advogado',
      gatilho: 'CLIENTE_SITUACAO_ALTERADA',
      condicoes: { situacaoNova: 'EM_REVISAO' },
      acoes: [{ tipo: 'CRIAR_TAREFA', titulo: 'Revisar {{cliente.nome}}', usuarioId: advogado.id }],
    });
    await novoCliente(admin);
    const lista = await db.select().from(tarefas);
    expect(lista.map((t) => t.usuarioId).sort()).toEqual([secretaria.id, advogado.id].sort());
  });

  it('laço entre fluxos termina', async () => {
    await req('POST', '/workflows', admin, {
      nome: 'Vai',
      gatilho: 'CLIENTE_SITUACAO_ALTERADA',
      condicoes: { situacaoNova: 'EM_REVISAO' },
      acoes: [{ tipo: 'ALTERAR_SITUACAO_CLIENTE', situacao: 'A' }],
    });
    await req('POST', '/workflows', admin, {
      nome: 'Volta',
      gatilho: 'CLIENTE_SITUACAO_ALTERADA',
      condicoes: { situacaoNova: 'A' },
      acoes: [{ tipo: 'ALTERAR_SITUACAO_CLIENTE', situacao: 'EM_REVISAO' }],
    });
    const cliente = await novoCliente(admin);
    const res = await req('PUT', `/clientes/${cliente.id}`, admin, { tipo: 'F', nome: 'Maria Souza', situacao: 'EM_REVISAO' });
    expect(res.status).toBe(200);

    const execs = await db.select().from(workflowExecucoes);
    expect(execs.filter((e) => e.status === 'SUCESSO')).toHaveLength(2);
    expect(execs.some((e) => e.status === 'IGNORADO')).toBe(true);
  });
});

describe('situações de cliente', () => {
  it('filtro "ativos" traz Em revisão e esconde Inativo', async () => {
    await novoCliente(admin, { nome: 'Ativa' });
    await novoCliente(admin, { nome: 'Revisão', situacao: 'EM_REVISAO' });
    await novoCliente(admin, { nome: 'Inativa', situacao: 'I' });

    const res = await req('GET', '/clientes?situacao=ativos', admin);
    const { data } = (await res.json()) as { data: { nome: string }[] };
    expect(data.map((c) => c.nome).sort()).toEqual(['Ativa', 'Revisão']);
  });

  it('recusa situação inexistente no cadastro', async () => {
    const res = await req('POST', '/clientes', admin, { tipo: 'F', nome: 'X', situacao: 'NAO_EXISTE' });
    expect(res.status).toBe(400);
  });

  it('admin cria situação; outros perfis só leem', async () => {
    expect((await req('POST', '/cliente-situacoes', secretaria, { nome: 'Aguardando documentos' })).status).toBe(403);
    const res = await req('POST', '/cliente-situacoes', admin, { nome: 'Aguardando documentos', cor: 'warning' });
    expect(res.status).toBe(201);
    expect(((await res.json()) as { codigo: string }).codigo).toBe('AGUARDANDO_DOCUMENTOS');
    const lista = (await (await req('GET', '/cliente-situacoes', secretaria)).json()) as { codigo: string }[];
    expect(lista.map((s) => s.codigo)).toContain('AGUARDANDO_DOCUMENTOS');
  });

  it('não exclui situação em uso por cliente, por fluxo ou de sistema', async () => {
    const lista = (await (await req('GET', '/cliente-situacoes', admin)).json()) as { id: number; codigo: string }[];
    const id = (codigo: string) => lista.find((s) => s.codigo === codigo)!.id;

    expect((await req('DELETE', `/cliente-situacoes/${id('A')}`, admin)).status).toBe(400);

    await req('POST', '/workflows', admin, coletaDocumentos(secretaria.id));
    expect((await req('DELETE', `/cliente-situacoes/${id('EM_REVISAO')}`, admin)).status).toBe(400);
  });

  it('cada firma tem as suas', async () => {
    await req('POST', '/cliente-situacoes', admin, { nome: 'Só da A' });
    const daB = (await (await req('GET', '/cliente-situacoes', adminB)).json()) as { codigo: string }[];
    expect(daB.map((s) => s.codigo)).not.toContain('SO_DA_A');
  });
});

describe('excluir cliente', () => {
  it('leva junto as tarefas criadas pelo fluxo', async () => {
    await req('POST', '/workflows', admin, coletaDocumentos(secretaria.id));
    const cliente = await novoCliente(admin);
    expect(await db.select().from(tarefas)).toHaveLength(1);

    expect((await req('DELETE', `/clientes/${cliente.id}`, admin)).status).toBe(200);
    expect(await db.select().from(tarefas)).toHaveLength(0);
    const [restante] = await db
      .select()
      .from(clientes)
      .where(and(eq(clientes.id, cliente.id), eq(clientes.firmId, firma.id)));
    expect(restante).toBeUndefined();
  });
});
