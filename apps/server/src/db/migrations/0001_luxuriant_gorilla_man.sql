DO $$
DECLARE
  default_firm_id uuid;
BEGIN
  SELECT id INTO default_firm_id FROM firms LIMIT 1;
  IF default_firm_id IS NOT NULL THEN
    UPDATE profiles SET firm_id = default_firm_id WHERE firm_id IS NULL;
    UPDATE clientes SET firm_id = default_firm_id WHERE firm_id IS NULL;
    UPDATE processos_judiciais SET firm_id = default_firm_id WHERE firm_id IS NULL;
    UPDATE processos_administrativos SET firm_id = default_firm_id WHERE firm_id IS NULL;
    UPDATE andamentos SET firm_id = default_firm_id WHERE firm_id IS NULL;
    UPDATE partes SET firm_id = default_firm_id WHERE firm_id IS NULL;
    UPDATE honorarios SET firm_id = default_firm_id WHERE firm_id IS NULL;
    UPDATE tarefas SET firm_id = default_firm_id WHERE firm_id IS NULL;
    UPDATE clientes_notas SET firm_id = default_firm_id WHERE firm_id IS NULL;
    UPDATE audit_logs SET firm_id = default_firm_id WHERE firm_id IS NULL;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "andamentos" ALTER COLUMN "firm_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "firm_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "clientes" ALTER COLUMN "firm_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "clientes_notas" ALTER COLUMN "firm_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "honorarios" ALTER COLUMN "firm_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "partes" ALTER COLUMN "firm_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "processos_administrativos" ALTER COLUMN "firm_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "processos_judiciais" ALTER COLUMN "firm_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "firm_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tarefas" ALTER COLUMN "firm_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "andamentos" DROP COLUMN "legacy_processo_ref";--> statement-breakpoint
DROP TYPE "public"."perfil";--> statement-breakpoint
DROP TYPE "public"."prioridade";--> statement-breakpoint
DROP TYPE "public"."status";