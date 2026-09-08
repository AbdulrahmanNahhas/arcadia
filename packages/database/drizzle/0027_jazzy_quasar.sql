CREATE TYPE "public"."title_format" AS ENUM('animated', 'live-action');--> statement-breakpoint
ALTER TABLE "account_preferences" ADD COLUMN "visible_title_kinds" text[] DEFAULT ARRAY['animated-movie','animated-series','live-action-movie','live-action-series']::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "format" "title_format" DEFAULT 'animated' NOT NULL;--> statement-breakpoint
ALTER TABLE "account_preferences" ADD CONSTRAINT "account_preferences_visible_title_kinds_check" CHECK (array_length("account_preferences"."visible_title_kinds", 1) >= 1
        and "account_preferences"."visible_title_kinds" <@ ARRAY['animated-movie','animated-series','live-action-movie','live-action-series']::text[]);
