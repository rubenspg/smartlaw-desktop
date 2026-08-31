import { pgTable, text, timestamp, uuid, boolean, bigint, date, decimal, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Toda tabela de negócio é filtrada por firm_id em praticamente todas as
// consultas. O Postgres indexa PRIMARY KEY e UNIQUE, mas não REFERENCES —
// sem os índices abaixo cada consulta multi-tenant vira sequential scan.

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
  logo: text('logo'),
  datajudApiKey: text('datajud_api_key'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const profiles = pgTable('profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  nome: text('nome').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  perfil: text('perfil').$type<'admin' | 'usuario' | 'administrativo' | 'secretaria'>().default('usuario'),
  ativo: boolean('ativo').default(true),
  firmId: uuid('firm_id').references(() => firms.id).notNull(),
  // Colunas criadas pela migration 0004 para um fluxo de "esqueci minha senha"
  // que nunca foi concluído. Nenhum código as lê hoje. Estão declaradas aqui
  // apenas para o schema refletir o banco real — removê-las exige uma migration
  // destrutiva própria, não um efeito colateral de outra mudança. Ver #31.
  resetToken: text('reset_token'),
  resetTokenExpires: timestamp('reset_token_expires', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('profiles_firm_id_idx').on(t.firmId),
]);

export const clientes = pgTable('clientes', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  firmId: uuid('firm_id').references(() => firms.id).notNull(),
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
}, (t) => [
  index('clientes_firm_id_idx').on(t.firmId),
  // Listagem padrão: filtra por firma e ordena por nome.
  index('clientes_firm_id_nome_idx').on(t.firmId, t.nome),
]);

export const processosJudiciais = pgTable('processos_judiciais', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  firmId: uuid('firm_id').references(() => firms.id).notNull(),
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
}, (t) => [
  index('processos_judiciais_firm_id_idx').on(t.firmId),
  index('processos_judiciais_firm_id_cliente_id_idx').on(t.firmId, t.clienteId),
  index('processos_judiciais_cliente_id_idx').on(t.clienteId),
]);

export const processosAdministrativos = pgTable('processos_administrativos', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  firmId: uuid('firm_id').references(() => firms.id).notNull(),
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
}, (t) => [
  index('processos_administrativos_firm_id_idx').on(t.firmId),
  index('processos_administrativos_firm_id_cliente_id_idx').on(t.firmId, t.clienteId),
  index('processos_administrativos_cliente_id_idx').on(t.clienteId),
]);

export const andamentos = pgTable('andamentos', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  firmId: uuid('firm_id').references(() => firms.id).notNull(),
  processoJudicialId: bigint('processo_judicial_id', { mode: 'number' }).references(() => processosJudiciais.id, { onDelete: 'cascade' }),
  processoAdminId: bigint('processo_admin_id', { mode: 'number' }).references(() => processosAdministrativos.id, { onDelete: 'cascade' }),
  usuarioId: uuid('usuario_id').references(() => profiles.id, { onDelete: 'set null' }),
  data: timestamp('data', { withTimezone: true }).notNull(),
  inclusao: timestamp('inclusao', { withTimezone: true }).notNull(),
  historico: text('historico'),
  tipo: text('tipo'),
  documento: text('documento'),
  externalId: text('external_id').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('andamentos_firm_id_idx').on(t.firmId),
  index('andamentos_processo_judicial_id_idx').on(t.processoJudicialId),
  index('andamentos_processo_admin_id_idx').on(t.processoAdminId),
  // Feed "andamentos recentes" do dashboard.
  index('andamentos_firm_id_inclusao_idx').on(t.firmId, t.inclusao),
]);

export const partes = pgTable('partes', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  processoJudicialId: bigint('processo_judicial_id', { mode: 'number' }).references(() => processosJudiciais.id, { onDelete: 'cascade' }),
  clienteId: bigint('cliente_id', { mode: 'number' }).references(() => clientes.id),
  posicaoId: text('posicao_id').references(() => posicoesParte.codigo),
  nome: text('nome').notNull(),
  firmId: uuid('firm_id').references(() => firms.id).notNull(),
}, (t) => [
  index('partes_firm_id_idx').on(t.firmId),
  index('partes_processo_judicial_id_idx').on(t.processoJudicialId),
]);

export const honorarios = pgTable('honorarios', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  firmId: uuid('firm_id').references(() => firms.id).notNull(),
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
}, (t) => [
  index('honorarios_firm_id_idx').on(t.firmId),
  index('honorarios_cliente_id_idx').on(t.clienteId),
  // Listagens do financeiro filtram por firma e competência de vencimento.
  index('honorarios_firm_id_data_venc_idx').on(t.firmId, t.dataVenc),
]);

export const tarefas = pgTable('tarefas', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  firmId: uuid('firm_id').references(() => firms.id).notNull(),
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
}, (t) => [
  index('tarefas_firm_id_idx').on(t.firmId),
  index('tarefas_firm_id_status_idx').on(t.firmId, t.status),
  index('tarefas_usuario_id_idx').on(t.usuarioId),
]);

export const clientesNotas = pgTable('clientes_notas', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  clienteId: bigint('cliente_id', { mode: 'number' }).references(() => clientes.id, { onDelete: 'cascade' }),
  usuarioId: uuid('usuario_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  texto: text('texto').notNull(),
  firmId: uuid('firm_id').references(() => firms.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('clientes_notas_firm_id_idx').on(t.firmId),
  index('clientes_notas_cliente_id_idx').on(t.clienteId),
]);

export const auditLogs = pgTable('audit_logs', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  tableName: text('table_name').notNull(),
  recordId: text('record_id').notNull(),
  action: text('action').notNull(),
  oldData: jsonb('old_data'),
  newData: jsonb('new_data'),
  userId: uuid('user_id').references(() => profiles.id),
  firmId: uuid('firm_id').references(() => firms.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  // A tela de auditoria lista por firma em ordem cronológica decrescente.
  index('audit_logs_firm_id_created_at_idx').on(t.firmId, t.createdAt),
]);

// Relations
export const processosJudiciaisRelations = relations(processosJudiciais, ({ one, many }) => ({
  cliente: one(clientes, {
    fields: [processosJudiciais.clienteId],
    references: [clientes.id],
  }),
  andamentos: many(andamentos),
  partes: many(partes),
}));

export const partesRelations = relations(partes, ({ one }) => ({
  processo: one(processosJudiciais, {
    fields: [partes.processoJudicialId],
    references: [processosJudiciais.id],
  }),
  posicao: one(posicoesParte, {
    fields: [partes.posicaoId],
    references: [posicoesParte.codigo],
  }),
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
  tarefas: many(tarefas),
}));

export const honorariosRelations = relations(honorarios, ({ one }) => ({
  cliente: one(clientes, {
    fields: [honorarios.clienteId],
    references: [clientes.id],
  }),
  processoJudicial: one(processosJudiciais, {
    fields: [honorarios.processoJudicialId],
    references: [processosJudiciais.id],
  }),
  processoAdmin: one(processosAdministrativos, {
    fields: [honorarios.processoAdminId],
    references: [processosAdministrativos.id],
  }),
}));

export const profilesRelations = relations(profiles, ({ many }) => ({
  tarefas: many(tarefas),
}));

export const tarefasRelations = relations(tarefas, ({ one }) => ({
  usuario: one(profiles, {
    fields: [tarefas.usuarioId],
    references: [profiles.id],
  }),
  cliente: one(clientes, {
    fields: [tarefas.clienteId],
    references: [clientes.id],
  }),
}));
