ALTER TABLE "account_title_states" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "account_title_states" DROP COLUMN "started_at";--> statement-breakpoint
ALTER TABLE "account_title_states" DROP COLUMN "completed_at";--> statement-breakpoint
DROP TYPE "public"."library_status";