ALTER TABLE "profiles" ADD COLUMN "agenda_token" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_agenda_token_unique" UNIQUE("agenda_token");
