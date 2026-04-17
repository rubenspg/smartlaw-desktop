CREATE TYPE "public"."perfil" AS ENUM('admin', 'usuario');--> statement-breakpoint
CREATE TYPE "public"."prioridade" AS ENUM('BAIXA', 'MEDIA', 'ALTA');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('PENDENTE', 'PAGO', 'CANCELADO');--> statement-breakpoint
CREATE TABLE "andamentos" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "andamentos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"firm_id" uuid,
	"processo_judicial_id" bigint,
	"processo_admin_id" bigint,
	"usuario_id" uuid,
	"data" timestamp with time zone NOT NULL,
	"inclusao" timestamp with time zone NOT NULL,
	"historico" text,
	"tipo" text,
	"documento" text,
	"external_id" text,
	"legacy_processo_ref" bigint,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "andamentos_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"table_name" text NOT NULL,
	"record_id" text NOT NULL,
	"action" text NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"user_id" uuid,
	"firm_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "clientes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"firm_id" uuid,
	"tipo" text NOT NULL,
	"nome" text NOT NULL,
	"fantasia" text,
	"cpf_cnpj" text,
	"rg" text,
	"nascimento" date,
	"sexo" text,
	"est_civil" text,
	"profissao" text,
	"endereco" text,
	"end_numero" text,
	"complemento" text,
	"bairro" text,
	"municipio" text,
	"municipio_codigo" text,
	"cep" text,
	"estado" text,
	"pais" text,
	"telefone1" text,
	"telefone2" text,
	"celular" text,
	"email" text,
	"nome_pai" text,
	"nome_mae" text,
	"nome_conjuge" text,
	"observacoes" text,
	"situacao" text DEFAULT 'A',
	"bloqueado" boolean DEFAULT false,
	"data_cadastro" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clientes_notas" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "clientes_notas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"cliente_id" bigint,
	"usuario_id" uuid NOT NULL,
	"texto" text NOT NULL,
	"firm_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "especies_processo" (
	"codigo" text PRIMARY KEY NOT NULL,
	"descricao" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "firms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "firms_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "honorarios" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "honorarios_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"firm_id" uuid,
	"cliente_id" bigint,
	"processo_judicial_id" bigint,
	"processo_admin_id" bigint,
	"descricao" text NOT NULL,
	"valor" numeric(10, 2) NOT NULL,
	"valor_pago" numeric(10, 2) DEFAULT '0',
	"data_venc" date NOT NULL,
	"data_pagto" date,
	"status" text DEFAULT 'PENDENTE',
	"tipo" text DEFAULT 'HONORARIO',
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "localizacoes_processo" (
	"codigo" text PRIMARY KEY NOT NULL,
	"descricao" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "municipios" (
	"codigo" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"cep_inicial" text,
	"cep_final" text,
	"estado" text,
	"pais" text,
	"cod_ibge" text,
	"comarca" text
);
--> statement-breakpoint
CREATE TABLE "partes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "partes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"processo_judicial_id" bigint,
	"cliente_id" bigint,
	"posicao_id" text,
	"nome" text NOT NULL,
	"firm_id" uuid
);
--> statement-breakpoint
CREATE TABLE "posicoes_parte" (
	"codigo" text PRIMARY KEY NOT NULL,
	"descricao" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processos_administrativos" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "processos_administrativos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"firm_id" uuid,
	"cliente_id" bigint,
	"numero" text NOT NULL,
	"data_cadastro" timestamp with time zone,
	"abertura" timestamp with time zone,
	"inicio_beneficio" timestamp with time zone,
	"decisao" text,
	"pasta" text,
	"especie_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "processos_judiciais" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "processos_judiciais_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"firm_id" uuid,
	"cliente_id" bigint,
	"numero" text NOT NULL,
	"data_cadastro" timestamp with time zone,
	"distribuicao" timestamp with time zone,
	"juizo" text,
	"justica" text,
	"comarca" text,
	"orgao_julgador" text,
	"recurso" text,
	"situacao" text,
	"dt_arquivado" timestamp with time zone,
	"pasta" text,
	"rito_id" text,
	"tipo_acao_id" text,
	"localizacao_id" text,
	"last_sync" timestamp with time zone,
	"sync_status" text,
	"datajud_raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"perfil" text DEFAULT 'usuario',
	"ativo" boolean DEFAULT true,
	"firm_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "ritos_processuais" (
	"codigo" text PRIMARY KEY NOT NULL,
	"descricao" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarefas" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tarefas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"firm_id" uuid,
	"usuario_id" uuid NOT NULL,
	"cliente_id" bigint,
	"processo_judicial_id" bigint,
	"processo_admin_id" bigint,
	"titulo" text NOT NULL,
	"descricao" text,
	"data_limite" timestamp with time zone,
	"prioridade" text DEFAULT 'MEDIA',
	"status" text DEFAULT 'PENDENTE',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tipos_acao" (
	"codigo" text PRIMARY KEY NOT NULL,
	"descricao" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "andamentos" ADD CONSTRAINT "andamentos_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "andamentos" ADD CONSTRAINT "andamentos_processo_judicial_id_processos_judiciais_id_fk" FOREIGN KEY ("processo_judicial_id") REFERENCES "public"."processos_judiciais"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "andamentos" ADD CONSTRAINT "andamentos_processo_admin_id_processos_administrativos_id_fk" FOREIGN KEY ("processo_admin_id") REFERENCES "public"."processos_administrativos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "andamentos" ADD CONSTRAINT "andamentos_usuario_id_profiles_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_municipio_codigo_municipios_codigo_fk" FOREIGN KEY ("municipio_codigo") REFERENCES "public"."municipios"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes_notas" ADD CONSTRAINT "clientes_notas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes_notas" ADD CONSTRAINT "clientes_notas_usuario_id_profiles_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes_notas" ADD CONSTRAINT "clientes_notas_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_processo_judicial_id_processos_judiciais_id_fk" FOREIGN KEY ("processo_judicial_id") REFERENCES "public"."processos_judiciais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_processo_admin_id_processos_administrativos_id_fk" FOREIGN KEY ("processo_admin_id") REFERENCES "public"."processos_administrativos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partes" ADD CONSTRAINT "partes_processo_judicial_id_processos_judiciais_id_fk" FOREIGN KEY ("processo_judicial_id") REFERENCES "public"."processos_judiciais"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partes" ADD CONSTRAINT "partes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partes" ADD CONSTRAINT "partes_posicao_id_posicoes_parte_codigo_fk" FOREIGN KEY ("posicao_id") REFERENCES "public"."posicoes_parte"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partes" ADD CONSTRAINT "partes_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processos_administrativos" ADD CONSTRAINT "processos_administrativos_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processos_administrativos" ADD CONSTRAINT "processos_administrativos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processos_administrativos" ADD CONSTRAINT "processos_administrativos_especie_id_especies_processo_codigo_fk" FOREIGN KEY ("especie_id") REFERENCES "public"."especies_processo"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processos_judiciais" ADD CONSTRAINT "processos_judiciais_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processos_judiciais" ADD CONSTRAINT "processos_judiciais_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processos_judiciais" ADD CONSTRAINT "processos_judiciais_rito_id_ritos_processuais_codigo_fk" FOREIGN KEY ("rito_id") REFERENCES "public"."ritos_processuais"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processos_judiciais" ADD CONSTRAINT "processos_judiciais_tipo_acao_id_tipos_acao_codigo_fk" FOREIGN KEY ("tipo_acao_id") REFERENCES "public"."tipos_acao"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processos_judiciais" ADD CONSTRAINT "processos_judiciais_localizacao_id_localizacoes_processo_codigo_fk" FOREIGN KEY ("localizacao_id") REFERENCES "public"."localizacoes_processo"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_usuario_id_profiles_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_processo_judicial_id_processos_judiciais_id_fk" FOREIGN KEY ("processo_judicial_id") REFERENCES "public"."processos_judiciais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_processo_admin_id_processos_administrativos_id_fk" FOREIGN KEY ("processo_admin_id") REFERENCES "public"."processos_administrativos"("id") ON DELETE no action ON UPDATE no action;