DROP INDEX "installments_tvdb_id_uq";--> statement-breakpoint
DROP INDEX "titles_tvdb_id_uq";--> statement-breakpoint
ALTER TABLE "installments" DROP COLUMN "tvdb_id";--> statement-breakpoint
ALTER TABLE "titles" DROP COLUMN "tvdb_id";