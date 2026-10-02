-- Fluxos de trabalho: situações de cliente por escritório, fluxos e o
-- histórico de execuções. Ver docs/FLUXOS_DE_TRABALHO.md.

CREATE TABLE IF NOT EXISTS "cliente_situacoes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cliente_situacoes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"firm_id" uuid NOT NULL REFERENCES "public"."firms"("id"),
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"cor" text DEFAULT 'secondary' NOT NULL,
	"conta_como_ativo" boolean DEFAULT true NOT NULL,
	"sistema" boolean DEFAULT false NOT NULL,
	"ordem" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cliente_situacoes_firm_id_codigo_uidx" ON "cliente_situacoes" USING btree ("firm_id","codigo");
--> statement-breakpoint

-- As duas situações que o app sempre teve, mais "Em revisão" para o fluxo de
-- cadastro. Firmas criadas depois recebem as mesmas em services/workflows/situacoes.ts.
INSERT INTO "cliente_situacoes" ("firm_id", "codigo", "nome", "cor", "conta_como_ativo", "sistema", "ordem")
SELECT f."id", s."codigo", s."nome", s."cor", s."ativo", s."sistema", s."ordem"
FROM "firms" f
CROSS JOIN (VALUES
	('A', 'Ativo', 'success', true, true, 0),
	('EM_REVISAO', 'Em revisão', 'warning', true, false, 10),
	('I', 'Inativo', 'destructive', false, true, 99)
) AS s("codigo", "nome", "cor", "ativo", "sistema", "ordem")
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- Algum valor legado fora de A/I vira situação própria em vez de sumir da tela.
INSERT INTO "cliente_situacoes" ("firm_id", "codigo", "nome")
SELECT DISTINCT c."firm_id", c."situacao", c."situacao"
FROM "clientes" c
WHERE c."situacao" IS NOT NULL AND c."situacao" <> ''
ON CONFLICT DO NOTHING;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "workflows" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workflows_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"firm_id" uuid NOT NULL REFERENCES "public"."firms"("id"),
	"nome" text NOT NULL,
	"descricao" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"gatilho" text NOT NULL,
	"condicoes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"acoes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"criado_por" uuid REFERENCES "public"."profiles"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflows_firm_id_gatilho_idx" ON "workflows" USING btree ("firm_id","gatilho");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "workflow_execucoes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workflow_execucoes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"firm_id" uuid NOT NULL REFERENCES "public"."firms"("id"),
	"workflow_id" bigint REFERENCES "public"."workflows"("id") ON DELETE set null,
	"workflow_nome" text NOT NULL,
	"gatilho" text NOT NULL,
	"cliente_id" bigint REFERENCES "public"."clientes"("id") ON DELETE set null,
	"disparado_por" uuid REFERENCES "public"."profiles"("id") ON DELETE set null,
	"status" text NOT NULL,
	"resultado" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"erro" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_execucoes_firm_id_created_at_idx" ON "workflow_execucoes" USING btree ("firm_id","created_at");
--> statement-breakpoint

ALTER TABLE "tarefas" ADD COLUMN IF NOT EXISTS "workflow_execucao_id" bigint REFERENCES "public"."workflow_execucoes"("id") ON DELETE set null;
--> statement-breakpoint

-- Todo cliente novo pode nascer com tarefa de fluxo; sem cascade, excluir o
-- cliente passaria a falhar na chave estrangeira. Remove qualquer FK sobre
-- tarefas.cliente_id, não só a do nome gerado: as bases vindas do Supabase não
-- garantem o nome (a mesma divergência da 0004, #31).
DO $$
DECLARE r record;
BEGIN
	FOR r IN
		SELECT con.conname
		FROM pg_constraint con
		JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
		WHERE con.conrelid = 'public.tarefas'::regclass
			AND con.contype = 'f'
			AND att.attname = 'cliente_id'
	LOOP
		EXECUTE format('ALTER TABLE "tarefas" DROP CONSTRAINT %I', r.conname);
	END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;
