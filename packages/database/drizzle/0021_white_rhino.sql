ALTER TABLE "account_playback_states" ADD COLUMN "subtitle_offset_ms" integer;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "summary" text DEFAULT '' NOT NULL;