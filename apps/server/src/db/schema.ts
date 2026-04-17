import { pgTable, text, timestamp, uuid, boolean, pgEnum, bigint, date, decimal, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums (Optional, can also use text with Zod validation)
export const perfilEnum = pgEnum('perfil', ['admin', 'usuario']);
export const statusEnum = pgEnum('status', ['PENDENTE', 'PAGO', 'CANCELADO']);
export const prioridadeEnum = pgEnum('prioridade', ['BAIXA', 'MEDIA', 'ALTA']);

// Lookup Tables
export const especiesProcesso = pgTable('especies_processo', {
  codigo: text('codigo').primaryKey(),
  descricao: text('descricao').notNull(),
});

export const tiposAcao = pgTable('tipos_acao', {
  codigo: text('codigo').primaryKey(),
  descricao: text('descricao').notNull(),
});

export const ritosProcessuais = pgTable('ritos_processuais', {
  codigo: text('codigo').primaryKey(),
  descricao: text('descricao').notNull(),
});

export const localizacoesProcesso = pgTable('localizacoes_processo', {
  codigo: text('codigo').primaryKey(),
  descricao: text('descricao').notNull(),
});

export const posicoesParte = pgTable('posicoes_parte', {
  codigo: text('codigo').primaryKey(),
  descricao: text('descricao').notNull(),
});

export const municipios = pgTable('municipios', {
  codigo: text('codigo').primaryKey(),
  nome: text('nome').notNull(),
  cepInicial: text('cep_inicial'),
  cepFinal: text('cep_final'),
  estado: text('estado'),
  pais: text('pais'),
  codIbge: text('cod_ibge'),
  comarca: text('comarca'),
});

// Main Entities
export const firms = pgTable('firms', {
  id: uuid('id').defaultRandom().primaryKey(),
  nome: text('nome').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const profiles = pgTable('profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  nome: text('nome').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  perfil: text('perfil').default('usuario'), // 'admin' | 'usuario'
  ativo: boolean('ativo').default(true),
  firmId: uuid('firm_id').references(() => firms.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const clientes = pgTable('clientes', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  firmId: uuid('firm_id').references(() => firms.id),
  tipo: text('tipo').notNull(), // F=Física, J=Jurídica
  nome: text('nome').notNull(),
  fantasia: text('fantasia'),
  cpfCnpj: text('cpf_cnpj'),
  rg: text('rg'),
  nascimento: date('nascimento'),
  sexo: text('sexo'),
  estCivil: text('est_civil'),
  profissao: text('profissao'),
  endereco: text('endereco'),
  endNumero: text('end_numero'),
  complemento: text('complemento'),
  bairro: text('bairro'),
  municipio: text('municipio'),
  municipioCodigo: text('municipio_codigo').references(() => municipios.codigo),
  cep: text('cep'),
  estado: text('estado'),
  pais: text('pais'),
  telefone1: text('telefone1'),
  telefone2: text('telefone2'),
  celular: text('celular'),
  email: text('email'),
  nomePai: text('nome_pai'),
  nomeMae: text('nome_mae'),
  nomeConjuge: text('nome_conjuge'),
  observacoes: text('observacoes'),
  situacao: text('situacao').default('A'),
  bloqueado: boolean('bloqueado').default(false),
  dataCadastro: timestamp('data_cadastro', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const processosJudiciais = pgTable('processos_judiciais', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  firmId: uuid('firm_id').references(() => firms.id),
  clienteId: bigint('cliente_id', { mode: 'number' }).references(() => clientes.id, { onDelete: 'cascade' }),
  numero: text('numero').notNull(),
  dataCadastro: timestamp('data_cadastro', { withTimezone: true }),
  distribuicao: timestamp('distribuicao', { withTimezone: true }),
  juizo: text('juizo'),
  justica: text('justica'),
  comarca: text('comarca'),
  orgaoJulgador: text('orgao_julgador'),
  recurso: text('recurso'),
  situacao: text('situacao'),
  dtArquivado: timestamp('dt_arquivado', { withTimezone: true }),
  pasta: text('pasta'),
  ritoId: text('rito_id').references(() => ritosProcessuais.codigo),
  tipoAcaoId: text('tipo_acao_id').references(() => tiposAcao.codigo),
  localizacaoId: text('localizacao_id').references(() => localizacoesProcesso.codigo),
  
  // Datajud Sync
  lastSync: timestamp('last_sync', { withTimezone: true }),
  syncStatus: text('sync_status'),
  datajudRaw: jsonb('datajud_raw'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const processosAdministrativos = pgTable('processos_administrativos', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  firmId: uuid('firm_id').references(() => firms.id),
  clienteId: bigint('cliente_id', { mode: 'number' }).references(() => clientes.id, { onDelete: 'cascade' }),
  numero: text('numero').notNull(),
  dataCadastro: timestamp('data_cadastro', { withTimezone: true }),
  abertura: timestamp('abertura', { withTimezone: true }),
  inicioBeneficio: timestamp('inicio_beneficio', { withTimezone: true }),
  decisao: text('decisao'),
  pasta: text('pasta'),
  especieId: text('especie_id').references(() => especiesProcesso.codigo),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const andamentos = pgTable('andamentos', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  firmId: uuid('firm_id').references(() => firms.id),
  processoJudicialId: bigint('processo_judicial_id', { mode: 'number' }).references(() => processosJudiciais.id, { onDelete: 'cascade' }),
  processoAdminId: bigint('processo_admin_id', { mode: 'number' }).references(() => processosAdministrativos.id, { onDelete: 'cascade' }),
  usuarioId: uuid('usuario_id').references(() => profiles.id, { onDelete: 'set null' }),
  data: timestamp('data', { withTimezone: true }).notNull(),
  inclusao: timestamp('inclusao', { withTimezone: true }).notNull(),
  historico: text('historico'),
  tipo: text('tipo'),
  documento: text('documento'),
  externalId: text('external_id').unique(),
  legacyProcessoRef: bigint('legacy_processo_ref', { mode: 'number' }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const partes = pgTable('partes', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  processoJudicialId: bigint('processo_judicial_id', { mode: 'number' }).references(() => processosJudiciais.id, { onDelete: 'cascade' }),
  clienteId: bigint('cliente_id', { mode: 'number' }).references(() => clientes.id),
  posicaoId: text('posicao_id').references(() => posicoesParte.codigo),
  nome: text('nome').notNull(),
  firmId: uuid('firm_id').references(() => firms.id),
});

export const honorarios = pgTable('honorarios', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  firmId: uuid('firm_id').references(() => firms.id),
  clienteId: bigint('cliente_id', { mode: 'number' }).references(() => clientes.id, { onDelete: 'cascade' }),
  processoJudicialId: bigint('processo_judicial_id', { mode: 'number' }).references(() => processosJudiciais.id),
  processoAdminId: bigint('processo_admin_id', { mode: 'number' }).references(() => processosAdministrativos.id),
  descricao: text('descricao').notNull(),
  valor: decimal('valor', { precision: 10, scale: 2 }).notNull(),
  valorPago: decimal('valor_pago', { precision: 10, scale: 2 }).default('0'),
  dataVenc: date('data_venc').notNull(),
  dataPagto: date('data_pagto'),
  status: text('status').default('PENDENTE'),
  tipo: text('tipo').default('HONORARIO'),
  observacoes: text('observacoes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const tarefas = pgTable('tarefas', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  firmId: uuid('firm_id').references(() => firms.id),
  usuarioId: uuid('usuario_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  clienteId: bigint('cliente_id', { mode: 'number' }).references(() => clientes.id),
  processoJudicialId: bigint('processo_judicial_id', { mode: 'number' }).references(() => processosJudiciais.id),
  processoAdminId: bigint('processo_admin_id', { mode: 'number' }).references(() => processosAdministrativos.id),
  titulo: text('titulo').notNull(),
  descricao: text('descricao'),
  dataLimite: timestamp('data_limite', { withTimezone: true }),
  prioridade: text('prioridade').default('MEDIA'),
  status: text('status').default('PENDENTE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const clientesNotas = pgTable('clientes_notas', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  clienteId: bigint('cliente_id', { mode: 'number' }).references(() => clientes.id, { onDelete: 'cascade' }),
  usuarioId: uuid('usuario_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  texto: text('texto').notNull(),
  firmId: uuid('firm_id').references(() => firms.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  tableName: text('table_name').notNull(),
  recordId: text('record_id').notNull(),
  action: text('action').notNull(), // 'INSERT', 'UPDATE', 'DELETE'
  oldData: jsonb('old_data'),
  newData: jsonb('new_data'),
  userId: uuid('user_id').references(() => profiles.id),
  firmId: uuid('firm_id').references(() => firms.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Relations
export const processosJudiciaisRelations = relations(processosJudiciais, ({ one, many }) => ({
  cliente: one(clientes, {
    fields: [processosJudiciais.clienteId],
    references: [clientes.id],
  }),
  andamentos: many(andamentos),
}));

export const processosAdministrativosRelations = relations(processosAdministrativos, ({ one, many }) => ({
  cliente: one(clientes, {
    fields: [processosAdministrativos.clienteId],
    references: [clientes.id],
  }),
  andamentos: many(andamentos),
}));

export const andamentosRelations = relations(andamentos, ({ one }) => ({
  processoJudicial: one(processosJudiciais, {
    fields: [andamentos.processoJudicialId],
    references: [processosJudiciais.id],
  }),
  processoAdmin: one(processosAdministrativos, {
    fields: [andamentos.processoAdminId],
    references: [processosAdministrativos.id],
  }),
}));

export const clientesRelations = relations(clientes, ({ many }) => ({
  processosJudiciais: many(processosJudiciais),
  processosAdministrativos: many(processosAdministrativos),
  notas: many(clientesNotas),
}));
