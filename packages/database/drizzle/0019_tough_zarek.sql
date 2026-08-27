ALTER TABLE "account_playback_states" RENAME COLUMN "completed" TO "is_played";--> statement-breakpoint
ALTER TABLE "account_playback_states" DROP CONSTRAINT "playback_position_check";--> statement-breakpoint
DROP INDEX "account_playback_owner_uq";--> statement-breakpoint
ALTER TABLE "account_playback_states" ADD COLUMN "duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "account_playback_states" ADD COLUMN "played_manually" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "account_playback_states" ADD COLUMN "played_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account_playback_states" ADD CONSTRAINT "account_playback_owner_uq" UNIQUE NULLS NOT DISTINCT("account_id","installment_id","episode_id");--> statement-breakpoint
ALTER TABLE "account_playback_states" ADD CONSTRAINT "playback_position_check" CHECK ("account_playback_states"."position_seconds" >= 0 and ("account_playback_states"."duration_seconds" is null or "account_playback_states"."duration_seconds" >= 0));