CREATE TABLE "processo_instancias" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "processo_instancias_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"firm_id" uuid NOT NULL,
	"processo_judicial_id" bigint NOT NULL,
	"datajud_doc_id" text NOT NULL,
	"tribunal" text NOT NULL,
	"grau" text NOT NULL,
	"grau_ordem" integer NOT NULL,
	"numero_processo" text NOT NULL,
	"classe_codigo" integer,
	"classe_nome" text,
	"orgao_julgador_codigo" integer,
	"orgao_julgador_nome" text,
	"codigo_municipio_ibge" integer,
	"sistema" text,
	"formato" text,
	"nivel_sigilo" integer,
	"assuntos" jsonb,
	"data_ajuizamento" timestamp with time zone,
	"data_hora_ultima_atualizacao" timestamp with time zone,
	"total_movimentos" integer DEFAULT 0 NOT NULL,
	"raw" jsonb,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "andamentos" ADD COLUMN "instancia_id" bigint;--> statement-breakpoint
ALTER TABLE "processo_instancias" ADD CONSTRAINT "processo_instancias_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processo_instancias" ADD CONSTRAINT "processo_instancias_processo_judicial_id_processos_judiciais_id_fk" FOREIGN KEY ("processo_judicial_id") REFERENCES "public"."processos_judiciais"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "processo_instancias_firm_doc_uidx" ON "processo_instancias" USING btree ("firm_id","datajud_doc_id");--> statement-breakpoint
CREATE INDEX "processo_instancias_firm_id_idx" ON "processo_instancias" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "processo_instancias_processo_judicial_id_idx" ON "processo_instancias" USING btree ("processo_judicial_id");--> statement-breakpoint
ALTER TABLE "andamentos" ADD CONSTRAINT "andamentos_instancia_id_processo_instancias_id_fk" FOREIGN KEY ("instancia_id") REFERENCES "public"."processo_instancias"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- reset_token / reset_token_expires vieram da migration 0004, cujo .sql sumiu por um
-- tempo (#31): alguns bancos têm as colunas, outros não. Nenhum código as usa.
-- IF EXISTS fecha essa divergência sem quebrar em nenhum dos dois casos.
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "reset_token";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "reset_token_expires";