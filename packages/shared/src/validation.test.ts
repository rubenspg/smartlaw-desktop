import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  clienteSchema,
  usuarioSchema,
  usuarioUpdateSchema,
  tarefaSchema,
  processoJudicialSchema,
} from './validation';

describe('loginSchema', () => {
  it('aceita credenciais válidas', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'seissss' }).success).toBe(true);
  });

  it('recusa e-mail malformado', () => {
    expect(loginSchema.safeParse({ email: 'nao-e-email', password: 'seissss' }).success).toBe(false);
  });

  // A senha do login e a do cadastro precisam concordar no mínimo, senão dá
  // para criar uma conta com senha que o próprio login recusa.
  it('recusa senha com menos de 6 caracteres', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'cinco' }).success).toBe(false);
  });

  it('aceita exatamente 6 caracteres', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'abcdef' }).success).toBe(true);
  });

  it('o campo é "password", não "senha"', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', senha: 'abcdef' }).success).toBe(false);
  });
});

describe('usuarioSchema', () => {
  it('exige senha de 6+ caracteres na criação', () => {
    const base = { nome: 'Ana', email: 'ana@x.com' };
    expect(usuarioSchema.safeParse({ ...base, senha: 'cinco' }).success).toBe(false);
    expect(usuarioSchema.safeParse({ ...base, senha: 'abcdef' }).success).toBe(true);
  });

  it('usa perfil "usuario" por padrão', () => {
    const r = usuarioSchema.parse({ nome: 'Ana', email: 'ana@x.com', senha: 'abcdef' });
    expect(r.perfil).toBe('usuario');
  });

  it('recusa perfil fora da lista', () => {
    const r = usuarioSchema.safeParse({
      nome: 'Ana', email: 'ana@x.com', senha: 'abcdef', perfil: 'superadmin',
    });
    expect(r.success).toBe(false);
  });

  it('aceita os quatro perfis existentes', () => {
    for (const perfil of ['admin', 'usuario', 'administrativo', 'secretaria']) {
      const r = usuarioSchema.safeParse({ nome: 'A', email: 'a@x.com', senha: 'abcdef', perfil });
      expect(r.success, perfil).toBe(true);
    }
  });
});

describe('usuarioUpdateSchema', () => {
  // A edição não deve exigir senha — quem só muda o nome não redefine a senha.
  it('aceita atualização sem senha', () => {
    expect(usuarioUpdateSchema.safeParse({ nome: 'Novo Nome' }).success).toBe(true);
  });

  // Mas se vier senha, o mínimo continua valendo.
  it('ainda exige 6+ caracteres quando a senha é enviada', () => {
    expect(usuarioUpdateSchema.safeParse({ senha: 'cinco' }).success).toBe(false);
    expect(usuarioUpdateSchema.safeParse({ senha: 'abcdef' }).success).toBe(true);
  });
});

describe('clienteSchema', () => {
  it('exige tipo F ou J', () => {
    expect(clienteSchema.safeParse({ tipo: 'X', nome: 'Ana' }).success).toBe(false);
    expect(clienteSchema.safeParse({ tipo: 'F', nome: 'Ana' }).success).toBe(true);
  });

  it('exige nome não vazio', () => {
    expect(clienteSchema.safeParse({ tipo: 'F', nome: '' }).success).toBe(false);
  });

  // Formulário manda string vazia quando o campo não foi preenchido; recusar
  // isso quebraria o cadastro de quem não tem e-mail.
  it('aceita e-mail vazio, mas não um e-mail inválido', () => {
    expect(clienteSchema.safeParse({ tipo: 'F', nome: 'Ana', email: '' }).success).toBe(true);
    expect(clienteSchema.safeParse({ tipo: 'F', nome: 'Ana', email: 'quebrado' }).success).toBe(false);
  });
});

describe('tarefaSchema', () => {
  const base = { usuarioId: '00000000-0000-0000-0000-000000000000', titulo: 'X', prioridade: 'MEDIA', status: 'PENDENTE' };

  it('exige usuarioId em formato UUID', () => {
    expect(tarefaSchema.safeParse({ ...base, usuarioId: 'nao-uuid' }).success).toBe(false);
    expect(tarefaSchema.safeParse(base).success).toBe(true);
  });

  it('exige título', () => {
    expect(tarefaSchema.safeParse({ ...base, titulo: '' }).success).toBe(false);
  });

  // EM_ANDAMENTO aparece em rótulos da UI mas nunca foi um status válido aqui.
  it('aceita apenas PENDENTE, CONCLUIDA e CANCELADA', () => {
    for (const status of ['PENDENTE', 'CONCLUIDA', 'CANCELADA']) {
      expect(tarefaSchema.safeParse({ ...base, status }).success, status).toBe(true);
    }
    expect(tarefaSchema.safeParse({ ...base, status: 'EM_ANDAMENTO' }).success).toBe(false);
  });

  it('aceita as três prioridades e recusa outras', () => {
    for (const prioridade of ['BAIXA', 'MEDIA', 'ALTA']) {
      expect(tarefaSchema.safeParse({ ...base, prioridade }).success, prioridade).toBe(true);
    }
    expect(tarefaSchema.safeParse({ ...base, prioridade: 'URGENTE' }).success).toBe(false);
  });
});

describe('processoJudicialSchema', () => {
  it('exige cliente e número', () => {
    expect(processoJudicialSchema.safeParse({ clienteId: 0, numero: '123' }).success).toBe(false);
    expect(processoJudicialSchema.safeParse({ clienteId: 1, numero: '' }).success).toBe(false);
    expect(processoJudicialSchema.safeParse({ clienteId: 1, numero: '123' }).success).toBe(true);
  });

  // Os lookups são opcionais: a #46 mostrou que eles podem chegar vazios.
  it('aceita tipo de ação, rito e localização ausentes', () => {
    const r = processoJudicialSchema.safeParse({
      clienteId: 1, numero: '123', ritoId: null, tipoAcaoId: null, localizacaoId: null,
    });
    expect(r.success).toBe(true);
  });
});
