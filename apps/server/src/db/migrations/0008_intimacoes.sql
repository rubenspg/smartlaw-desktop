CREATE TABLE "intimacoes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "intimacoes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"firm_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"hash" text,
	"numero_processo" text NOT NULL,
	"processo_judicial_id" bigint,
	"sigla_tribunal" text NOT NULL,
	"tipo_comunicacao" text NOT NULL,
	"tipo_documento" text,
	"nome_orgao" text,
	"id_orgao" integer,
	"nome_classe" text,
	"codigo_classe" text,
	"texto_html" text,
	"texto_plano" text,
	"link" text,
	"meio" text,
	"data_disponibilizacao" date NOT NULL,
	"destinatarios" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"advogados" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"oabs_alvo" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"motivo_cancelamento" text,
	"data_cancelamento" date,
	"prazo_dias" integer,
	"prazo_publicacao" date,
	"prazo_fim" date,
	"tarefa_id" bigint,
	"lida_em" timestamp with time zone,
	"lida_por" uuid,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sync_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"firm_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"status" text NOT NULL,
	"iniciado_em" timestamp with time zone NOT NULL,
	"finalizado_em" timestamp with time zone,
	"janela_inicio" date,
	"janela_fim" date,
	"itens_lidos" integer DEFAULT 0 NOT NULL,
	"itens_novos" integer DEFAULT 0 NOT NULL,
	"processos_criados" integer DEFAULT 0 NOT NULL,
	"tarefas_criadas" integer DEFAULT 0 NOT NULL,
	"mensagem" text,
	"detalhes" jsonb
);
--> statement-breakpoint
ALTER TABLE "firms" ADD COLUMN "oabs_monitoradas" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "firms" ADD COLUMN "feriados" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "oab_numero" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "oab_uf" text;--> statement-breakpoint
ALTER TABLE "intimacoes" ADD CONSTRAINT "intimacoes_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intimacoes" ADD CONSTRAINT "intimacoes_processo_judicial_id_processos_judiciais_id_fk" FOREIGN KEY ("processo_judicial_id") REFERENCES "public"."processos_judiciais"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intimacoes" ADD CONSTRAINT "intimacoes_tarefa_id_tarefas_id_fk" FOREIGN KEY ("tarefa_id") REFERENCES "public"."tarefas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intimacoes" ADD CONSTRAINT "intimacoes_lida_por_profiles_id_fk" FOREIGN KEY ("lida_por") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "intimacoes_firm_id_external_id_idx" ON "intimacoes" USING btree ("firm_id","external_id");--> statement-breakpoint
CREATE INDEX "intimacoes_firm_id_data_idx" ON "intimacoes" USING btree ("firm_id","data_disponibilizacao");--> statement-breakpoint
CREATE INDEX "intimacoes_firm_id_processo_idx" ON "intimacoes" USING btree ("firm_id","processo_judicial_id");--> statement-breakpoint
CREATE INDEX "intimacoes_firm_id_numero_idx" ON "intimacoes" USING btree ("firm_id","numero_processo");--> statement-breakpoint
CREATE INDEX "sync_runs_firm_id_iniciado_em_idx" ON "sync_runs" USING btree ("firm_id","iniciado_em");--> statement-breakpoint
-- Seed: advogados da firma confirmados por Rubens em 2026-09-18 (nenhum deles é
-- usuário do app hoje, por isso ficam em firms.oabs_monitoradas e não em
-- profiles.oab_numero). Feriados locais que TRF4 (JFRS) e TJRS observam além
-- dos nacionais. Só preenche firmas que ainda não configuraram nada.
UPDATE "firms" SET "oabs_monitoradas" = '[
  {"numero":"62492","uf":"RS","nome":"Rafael Plentz Gonçalves"},
  {"numero":"55817","uf":"RS","nome":"Mauricio Ferron"},
  {"numero":"127837","uf":"RS","nome":"Maria Eduarda Girelli Gonçalves"}
]'::jsonb WHERE "oabs_monitoradas" = '[]'::jsonb;--> statement-breakpoint
UPDATE "firms" SET "feriados" = '[
  {"data":"02-02","nome":"Nossa Senhora dos Navegantes (Porto Alegre)"},
  {"data":"09-20","nome":"Revolução Farroupilha (RS)"}
]'::jsonb WHERE "feriados" = '[]'::jsonb;
