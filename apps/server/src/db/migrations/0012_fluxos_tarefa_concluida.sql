-- Gatilho TAREFA_CONCLUIDA: a execução guarda a tarefa que a disparou, para o
-- histórico mostrar qual foi e para o fluxo não rodar de novo quando a mesma
-- tarefa é reaberta e concluída outra vez.
ALTER TABLE "workflow_execucoes" ADD COLUMN IF NOT EXISTS "tarefa_id" bigint REFERENCES "public"."tarefas"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_execucoes_workflow_id_tarefa_id_idx" ON "workflow_execucoes" USING btree ("workflow_id","tarefa_id");
