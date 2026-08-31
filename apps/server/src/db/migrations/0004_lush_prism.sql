-- Reconstruída a partir de meta/0004_snapshot.json (ver #31).
-- O arquivo original foi perdido, mas sua entrada no _journal.json e o snapshot
-- permaneceram, o que fazia `drizzle-kit migrate` abortar em banco novo com
-- "No file ./src/db/migrations/0004_lush_prism.sql found".
--
-- O diff 0003 -> 0004 contém exatamente estas duas colunas e nada mais.
-- IF NOT EXISTS porque bancos existentes já podem tê-las aplicado.
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "reset_token" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "reset_token_expires" timestamp with time zone;
