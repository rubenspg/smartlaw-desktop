import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  bigint,
  date,
  decimal,
  jsonb,
  index,
  integer,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
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
  // Advogados cujas intimações o DJEN deve trazer e que não são usuários do
  // app (os que são têm profiles.oab_numero). Seed da firma na migration 0008.
  oabsMonitoradas: jsonb('oabs_monitoradas').$type<OabMonitorada[]>().default([]).notNull(),
  // Feriados locais (estadual/municipal) além dos nacionais, que ficam no
  // código (services/djen/prazos.ts). Cada um adia o termo final — só cadastre
  // os que o tribunal da firma realmente observa.
  feriados: jsonb('feriados').$type<Feriado[]>().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export interface OabMonitorada {
  numero: string;
  uf: string;
  nome?: string;
}

/** `data` é `MM-DD` (todo ano) ou `YYYY-MM-DD` (só naquele ano). */
export interface Feriado {
  data: string;
  nome: string;
}

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    nome: text('nome').notNull(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    perfil: text('perfil')
      .$type<'admin' | 'usuario' | 'administrativo' | 'secretaria'>()
      .default('usuario'),
    ativo: boolean('ativo').default(true),
    firmId: uuid('firm_id')
      .references(() => firms.id)
      .notNull(),
    // Segredo do feed iCalendar da agenda. Fica na URL da assinatura, então é
    // um token dedicado e revogável — nunca o JWT. Nulo até o usuário gerar.
    agendaToken: text('agenda_token').unique(),
    // Inscrição na OAB: quem tem OAB recebe as tarefas das intimações em que é
    // destinatário. Número sem UF e sem zeros à esquerda ("62492"), UF em maiúsculas.
    oabNumero: text('oab_numero'),
    oabUf: text('oab_uf'),
    // reset_token / reset_token_expires (migration 0004, nunca usadas) foram
    // removidas com DROP COLUMN IF EXISTS na 0007 — não redeclarar. Ver #31.
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('profiles_firm_id_idx').on(t.firmId)],
);

export const clientes = pgTable(
  'clientes',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    firmId: uuid('firm_id')
      .references(() => firms.id)
      .notNull(),
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
  },
  (t) => [
    index('clientes_firm_id_idx').on(t.firmId),
    // Listagem padrão: filtra por firma e ordena por nome.
    index('clientes_firm_id_nome_idx').on(t.firmId, t.nome),
  ],
);

export const processosJudiciais = pgTable(
  'processos_judiciais',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    firmId: uuid('firm_id')
      .references(() => firms.id)
      .notNull(),
    clienteId: bigint('cliente_id', { mode: 'number' }).references(() => clientes.id, {
      onDelete: 'cascade',
    }),
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
  },
  (t) => [
    index('processos_judiciais_firm_id_idx').on(t.firmId),
    index('processos_judiciais_firm_id_cliente_id_idx').on(t.firmId, t.clienteId),
    index('processos_judiciais_cliente_id_idx').on(t.clienteId),
  ],
);

export const processosAdministrativos = pgTable(
  'processos_administrativos',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    firmId: uuid('firm_id')
      .references(() => firms.id)
      .notNull(),
    clienteId: bigint('cliente_id', { mode: 'number' }).references(() => clientes.id, {
      onDelete: 'cascade',
    }),
    numero: text('numero').notNull(),
    dataCadastro: timestamp('data_cadastro', { withTimezone: true }),
    abertura: timestamp('abertura', { withTimezone: true }),
    inicioBeneficio: timestamp('inicio_beneficio', { withTimezone: true }),
    decisao: text('decisao'),
    pasta: text('pasta'),
    especieId: text('especie_id').references(() => especiesProcesso.codigo),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('processos_administrativos_firm_id_idx').on(t.firmId),
    index('processos_administrativos_firm_id_cliente_id_idx').on(t.firmId, t.clienteId),
    index('processos_administrativos_cliente_id_idx').on(t.clienteId),
  ],
);

/**
 * Uma linha por documento do Datajud: o CNJ guarda um documento por instância
 * (G1, G2, JE, TR…), então um processo com apelação tem duas linhas aqui.
 * `datajud_doc_id` é o `_id` do Elasticsearch (ex.: TRF4_G2_5019210082021…).
 */
export const processoInstancias = pgTable(
  'processo_instancias',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    firmId: uuid('firm_id')
      .references(() => firms.id)
      .notNull(),
    processoJudicialId: bigint('processo_judicial_id', { mode: 'number' })
      .references(() => processosJudiciais.id, { onDelete: 'cascade' })
      .notNull(),
    datajudDocId: text('datajud_doc_id').notNull(),
    tribunal: text('tribunal').notNull(),
    grau: text('grau').notNull(),
    // 1 = origem (G1/JE), 2 = recurso (G2/TR), 3 = superior. Para ordenar sem tabela de grau.
    grauOrdem: integer('grau_ordem').notNull(),
    numeroProcesso: text('numero_processo').notNull(),
    classeCodigo: integer('classe_codigo'),
    classeNome: text('classe_nome'),
    orgaoJulgadorCodigo: integer('orgao_julgador_codigo'),
    orgaoJulgadorNome: text('orgao_julgador_nome'),
    codigoMunicipioIbge: integer('codigo_municipio_ibge'),
    sistema: text('sistema'),
    formato: text('formato'),
    nivelSigilo: integer('nivel_sigilo'),
    assuntos: jsonb('assuntos'),
    dataAjuizamento: timestamp('data_ajuizamento', { withTimezone: true }),
    dataHoraUltimaAtualizacao: timestamp('data_hora_ultima_atualizacao', { withTimezone: true }),
    totalMovimentos: integer('total_movimentos').default(0).notNull(),
    raw: jsonb('raw'),
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex('processo_instancias_firm_doc_uidx').on(t.firmId, t.datajudDocId),
    index('processo_instancias_firm_id_idx').on(t.firmId),
    index('processo_instancias_processo_judicial_id_idx').on(t.processoJudicialId),
  ],
);

export const andamentos = pgTable(
  'andamentos',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    firmId: uuid('firm_id')
      .references(() => firms.id)
      .notNull(),
    processoJudicialId: bigint('processo_judicial_id', { mode: 'number' }).references(
      () => processosJudiciais.id,
      { onDelete: 'cascade' },
    ),
    processoAdminId: bigint('processo_admin_id', { mode: 'number' }).references(
      () => processosAdministrativos.id,
      { onDelete: 'cascade' },
    ),
    usuarioId: uuid('usuario_id').references(() => profiles.id, { onDelete: 'set null' }),
    // Instância do Datajud que originou o andamento (tipo DATAJUD); null nos manuais.
    instanciaId: bigint('instancia_id', { mode: 'number' }).references(
      () => processoInstancias.id,
      { onDelete: 'set null' },
    ),
    data: timestamp('data', { withTimezone: true }).notNull(),
    inclusao: timestamp('inclusao', { withTimezone: true }).notNull(),
    historico: text('historico'),
    // MANUAL (usuário), DATAJUD (movimento do tribunal), SISTEMA (aviso gerado pela aplicação).
    tipo: text('tipo'),
    documento: text('documento'),
    externalId: text('external_id').unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('andamentos_firm_id_idx').on(t.firmId),
    index('andamentos_processo_judicial_id_idx').on(t.processoJudicialId),
    index('andamentos_processo_admin_id_idx').on(t.processoAdminId),
    // Feed "andamentos recentes" do dashboard.
    index('andamentos_firm_id_inclusao_idx').on(t.firmId, t.inclusao),
  ],
);

/**
 * Comunicações do DJEN (comunicaapi.pje.jus.br) endereçadas aos advogados da
 * firma. Uma linha por comunicação; `external_id` = `djen:<id>` da API. O
 * vínculo com o processo é por número CNJ; quando o processo não existe, o
 * sync o cria em TRIAGEM (services/djen/sincronizar.ts).
 */
export const intimacoes = pgTable(
  'intimacoes',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    firmId: uuid('firm_id')
      .references(() => firms.id)
      .notNull(),
    externalId: text('external_id').notNull(),
    hash: text('hash'),
    numeroProcesso: text('numero_processo').notNull(), // 20 dígitos
    processoJudicialId: bigint('processo_judicial_id', { mode: 'number' }).references(
      () => processosJudiciais.id,
      { onDelete: 'set null' },
    ),
    siglaTribunal: text('sigla_tribunal').notNull(),
    tipoComunicacao: text('tipo_comunicacao').notNull(),
    tipoDocumento: text('tipo_documento'),
    nomeOrgao: text('nome_orgao'),
    idOrgao: integer('id_orgao'),
    nomeClasse: text('nome_classe'),
    codigoClasse: text('codigo_classe'),
    textoHtml: text('texto_html'),
    textoPlano: text('texto_plano'),
    link: text('link'),
    meio: text('meio'),
    dataDisponibilizacao: date('data_disponibilizacao').notNull(),
    destinatarios: jsonb('destinatarios').$type<IntimacaoDestinatario[]>().default([]).notNull(),
    // Todos os advogados destinatários, OAB normalizada; e o subconjunto que é da firma.
    advogados: jsonb('advogados').$type<IntimacaoAdvogado[]>().default([]).notNull(),
    oabsAlvo: jsonb('oabs_alvo').$type<string[]>().default([]).notNull(),
    ativo: boolean('ativo').default(true).notNull(),
    motivoCancelamento: text('motivo_cancelamento'),
    dataCancelamento: date('data_cancelamento'),
    // Prazo calculado na chegada (services/djen/prazos.ts); nulo nas informativas.
    prazoDias: integer('prazo_dias'),
    prazoPublicacao: date('prazo_publicacao'),
    prazoFim: date('prazo_fim'),
    tarefaId: bigint('tarefa_id', { mode: 'number' }).references(() => tarefas.id, {
      onDelete: 'set null',
    }),
    lidaEm: timestamp('lida_em', { withTimezone: true }),
    lidaPor: uuid('lida_por').references(() => profiles.id, { onDelete: 'set null' }),
    raw: jsonb('raw'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('intimacoes_firm_id_external_id_idx').on(t.firmId, t.externalId),
    index('intimacoes_firm_id_data_idx').on(t.firmId, t.dataDisponibilizacao),
    index('intimacoes_firm_id_processo_idx').on(t.firmId, t.processoJudicialId),
    index('intimacoes_firm_id_numero_idx').on(t.firmId, t.numeroProcesso),
  ],
);

export interface IntimacaoDestinatario {
  nome: string;
  polo: string | null;
}

export interface IntimacaoAdvogado {
  nome: string;
  numero: string;
  uf: string;
}

/**
 * Uma linha por execução dos jobs de sincronização (DJEN hoje; Datajud em
 * lote na fase 2). `GEOBLOQUEADO` é o 403 do DJEN fora do Brasil — na
 * produção significa que o túnel do roteador caiu (skill hp-proxmox).
 */
export const syncRuns = pgTable(
  'sync_runs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    firmId: uuid('firm_id')
      .references(() => firms.id)
      .notNull(),
    tipo: text('tipo').$type<'DJEN' | 'DATAJUD'>().notNull(),
    status: text('status').$type<'EXECUTANDO' | 'SUCESSO' | 'GEOBLOQUEADO' | 'ERRO'>().notNull(),
    iniciadoEm: timestamp('iniciado_em', { withTimezone: true }).notNull(),
    finalizadoEm: timestamp('finalizado_em', { withTimezone: true }),
    janelaInicio: date('janela_inicio'),
    janelaFim: date('janela_fim'),
    itensLidos: integer('itens_lidos').default(0).notNull(),
    itensNovos: integer('itens_novos').default(0).notNull(),
    processosCriados: integer('processos_criados').default(0).notNull(),
    tarefasCriadas: integer('tarefas_criadas').default(0).notNull(),
    mensagem: text('mensagem'),
    detalhes: jsonb('detalhes'),
  },
  (t) => [index('sync_runs_firm_id_iniciado_em_idx').on(t.firmId, t.iniciadoEm)],
);

export const partes = pgTable(
  'partes',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    processoJudicialId: bigint('processo_judicial_id', { mode: 'number' }).references(
      () => processosJudiciais.id,
      { onDelete: 'cascade' },
    ),
    clienteId: bigint('cliente_id', { mode: 'number' }).references(() => clientes.id),
    posicaoId: text('posicao_id').references(() => posicoesParte.codigo),
    nome: text('nome').notNull(),
    firmId: uuid('firm_id')
      .references(() => firms.id)
      .notNull(),
  },
  (t) => [
    index('partes_firm_id_idx').on(t.firmId),
    index('partes_processo_judicial_id_idx').on(t.processoJudicialId),
  ],
);

export const honorarios = pgTable(
  'honorarios',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    firmId: uuid('firm_id')
      .references(() => firms.id)
      .notNull(),
    clienteId: bigint('cliente_id', { mode: 'number' }).references(() => clientes.id, {
      onDelete: 'cascade',
    }),
    processoJudicialId: bigint('processo_judicial_id', { mode: 'number' }).references(
      () => processosJudiciais.id,
    ),
    processoAdminId: bigint('processo_admin_id', { mode: 'number' }).references(
      () => processosAdministrativos.id,
    ),
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
  },
  (t) => [
    index('honorarios_firm_id_idx').on(t.firmId),
    index('honorarios_cliente_id_idx').on(t.clienteId),
    // Listagens do financeiro filtram por firma e competência de vencimento.
    index('honorarios_firm_id_data_venc_idx').on(t.firmId, t.dataVenc),
  ],
);

export const tarefas = pgTable(
  'tarefas',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    firmId: uuid('firm_id')
      .references(() => firms.id)
      .notNull(),
    usuarioId: uuid('usuario_id').references(() => profiles.id, { onDelete: 'cascade' }),
    clienteId: bigint('cliente_id', { mode: 'number' }).references(() => clientes.id),
    processoJudicialId: bigint('processo_judicial_id', { mode: 'number' }).references(
      () => processosJudiciais.id,
    ),
    processoAdminId: bigint('processo_admin_id', { mode: 'number' }).references(
      () => processosAdministrativos.id,
    ),
    titulo: text('titulo').notNull(),
    descricao: text('descricao'),
    dataLimite: timestamp('data_limite', { withTimezone: true }),
    prioridade: text('prioridade').default('MEDIA'),
    status: text('status').default('PENDENTE'),
    categoria: text('categoria').default('GERAL'),
    link: text('link'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('tarefas_firm_id_idx').on(t.firmId),
    index('tarefas_firm_id_status_idx').on(t.firmId, t.status),
    index('tarefas_usuario_id_idx').on(t.usuarioId),
  ],
);

export const clientesNotas = pgTable(
  'clientes_notas',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    clienteId: bigint('cliente_id', { mode: 'number' }).references(() => clientes.id, {
      onDelete: 'cascade',
    }),
    usuarioId: uuid('usuario_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    texto: text('texto').notNull(),
    firmId: uuid('firm_id')
      .references(() => firms.id)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('clientes_notas_firm_id_idx').on(t.firmId),
    index('clientes_notas_cliente_id_idx').on(t.clienteId),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    tableName: text('table_name').notNull(),
    recordId: text('record_id').notNull(),
    action: text('action').notNull(),
    oldData: jsonb('old_data'),
    newData: jsonb('new_data'),
    userId: uuid('user_id').references(() => profiles.id),
    firmId: uuid('firm_id')
      .references(() => firms.id)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    // A tela de auditoria lista por firma em ordem cronológica decrescente.
    index('audit_logs_firm_id_created_at_idx').on(t.firmId, t.createdAt),
  ],
);

// Relations
export const processosJudiciaisRelations = relations(processosJudiciais, ({ one, many }) => ({
  cliente: one(clientes, {
    fields: [processosJudiciais.clienteId],
    references: [clientes.id],
  }),
  andamentos: many(andamentos),
  partes: many(partes),
  instancias: many(processoInstancias),
  intimacoes: many(intimacoes),
}));

export const intimacoesRelations = relations(intimacoes, ({ one }) => ({
  processo: one(processosJudiciais, {
    fields: [intimacoes.processoJudicialId],
    references: [processosJudiciais.id],
  }),
  tarefa: one(tarefas, {
    fields: [intimacoes.tarefaId],
    references: [tarefas.id],
  }),
}));

export const processoInstanciasRelations = relations(processoInstancias, ({ one, many }) => ({
  processo: one(processosJudiciais, {
    fields: [processoInstancias.processoJudicialId],
    references: [processosJudiciais.id],
  }),
  andamentos: many(andamentos),
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

export const processosAdministrativosRelations = relations(
  processosAdministrativos,
  ({ one, many }) => ({
    cliente: one(clientes, {
      fields: [processosAdministrativos.clienteId],
      references: [clientes.id],
    }),
    andamentos: many(andamentos),
  }),
);

export const andamentosRelations = relations(andamentos, ({ one }) => ({
  processoJudicial: one(processosJudiciais, {
    fields: [andamentos.processoJudicialId],
    references: [processosJudiciais.id],
  }),
  instancia: one(processoInstancias, {
    fields: [andamentos.instanciaId],
    references: [processoInstancias.id],
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
  processoJudicial: one(processosJudiciais, {
    fields: [tarefas.processoJudicialId],
    references: [processosJudiciais.id],
  }),
}));
