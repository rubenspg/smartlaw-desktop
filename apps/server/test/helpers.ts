import { sign } from 'hono/jwt';
import bcrypt from 'bcryptjs';
import { db } from '../src/db';
import { firms, profiles, tarefas } from '../src/db/schema';
import { sql } from 'drizzle-orm';

export const SENHA_PADRAO = 'senha-de-teste';

/**
 * Esvazia as tabelas entre testes. TRUNCATE ... CASCADE em vez de DELETE para
 * não depender da ordem das chaves estrangeiras.
 */
export async function limparBanco() {
  await db.execute(
    sql`TRUNCATE TABLE tarefas, profiles, firms RESTART IDENTITY CASCADE`,
  );
}

export async function criarFirma(nome = 'Escritório Teste') {
  const [f] = await db.insert(firms).values({ nome }).returning();
  return f;
}

export async function criarUsuario(opts: {
  firmId: string;
  email: string;
  perfil?: 'admin' | 'usuario' | 'administrativo' | 'secretaria';
  nome?: string;
  ativo?: boolean;
  senha?: string;
}) {
  const [u] = await db
    .insert(profiles)
    .values({
      nome: opts.nome ?? opts.email,
      email: opts.email,
      passwordHash: await bcrypt.hash(opts.senha ?? SENHA_PADRAO, 4), // custo baixo: é teste
      perfil: opts.perfil ?? 'usuario',
      ativo: opts.ativo ?? true,
      firmId: opts.firmId,
    })
    .returning();
  return u;
}

export async function criarTarefa(opts: {
  firmId: string;
  usuarioId: string;
  titulo?: string;
}) {
  const [t] = await db
    .insert(tarefas)
    .values({
      firmId: opts.firmId,
      usuarioId: opts.usuarioId,
      titulo: opts.titulo ?? 'Tarefa',
      prioridade: 'MEDIA',
      status: 'PENDENTE',
    })
    .returning();
  return t;
}

/** JWT no mesmo formato que /auth/login emite. */
export function tokenPara(u: {
  id: string;
  email: string;
  nome: string;
  perfil: string | null;
  firmId: string | null;
}) {
  return sign(
    {
      id: u.id,
      email: u.email,
      nome: u.nome,
      perfil: u.perfil ?? 'usuario',
      firmId: u.firmId,
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    process.env.JWT_SECRET!,
    'HS256',
  );
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
