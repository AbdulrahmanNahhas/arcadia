CREATE TYPE "public"."collection_visibility" AS ENUM('private', 'family');
--> statement-breakpoint
CREATE TYPE "public"."workflow_status" AS ENUM('draft', 'in_review', 'approved', 'published', 'archived');
--> statement-breakpoint
CREATE TYPE "public"."recommendation_status" AS ENUM('pending', 'accepted', 'deferred', 'dismissed');
--> statement-breakpoint
CREATE TYPE "public"."archive_request_status" AS ENUM('open', 'in_progress', 'resolved', 'rejected');
--> statement-breakpoint
CREATE TYPE "public"."background_job_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');
--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "workflow_status" "workflow_status" DEFAULT 'published' NOT NULL;
--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "quality_score" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "curator_notes" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "provenance" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "verified_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "verified_by_account_id" uuid;
--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "focal_x" integer DEFAULT 50 NOT NULL;
--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "focal_y" integer DEFAULT 50 NOT NULL;
--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "variant_of_asset_id" uuid;
--> statement-breakpoint
ALTER TABLE "media_assets" DROP CONSTRAINT "media_assets_values_check";
--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_values_check" CHECK ("byte_size" > 0 and "width" > 0 and "height" > 0 and "focal_x" between 0 and 100 and "focal_y" between 0 and 100);
--> statement-breakpoint
ALTER TABLE "account_preferences" ADD COLUMN "spoiler_mode" text DEFAULT 'cover' NOT NULL;
--> statement-breakpoint
ALTER TABLE "account_preferences" ADD COLUMN "default_saved_view_id" uuid;
--> statement-breakpoint
ALTER TABLE "account_preferences" ADD COLUMN "home_layout" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "account_preferences" ADD COLUMN "dashboard_layout" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
CREATE TABLE "account_view_history" (
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "title_id" uuid NOT NULL REFERENCES "titles"("id") ON DELETE cascade,
  "viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "visit_count" integer DEFAULT 1 NOT NULL,
  PRIMARY KEY ("account_id", "title_id"),
  CONSTRAINT "account_view_history_count_check" CHECK ("visit_count" > 0)
);
--> statement-breakpoint
CREATE INDEX "account_view_history_recent_idx" ON "account_view_history" ("account_id", "viewed_at");
--> statement-breakpoint
CREATE TABLE "saved_views" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "query" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "notify_new" boolean DEFAULT false NOT NULL,
  "last_matched_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "saved_views_account_name_uq" ON "saved_views" ("account_id", lower(btrim("name")));
--> statement-breakpoint
CREATE UNIQUE INDEX "saved_views_account_default_uq" ON "saved_views" ("account_id") WHERE "is_default";
--> statement-breakpoint
CREATE TABLE "collections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "visibility" "collection_visibility" DEFAULT 'private' NOT NULL,
  "is_smart" boolean DEFAULT false NOT NULL,
  "ranked" boolean DEFAULT false NOT NULL,
  "rules" jsonb,
  "cover_path" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "collections_owner_idx" ON "collections" ("owner_account_id", "updated_at");
--> statement-breakpoint
CREATE TABLE "collection_contributors" (
  "collection_id" uuid NOT NULL REFERENCES "collections"("id") ON DELETE cascade,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "added_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("collection_id", "account_id")
);
--> statement-breakpoint
CREATE TABLE "collection_items" (
  "collection_id" uuid NOT NULL REFERENCES "collections"("id") ON DELETE cascade,
  "title_id" uuid NOT NULL REFERENCES "titles"("id") ON DELETE cascade,
  "position" integer DEFAULT 0 NOT NULL,
  "note" text DEFAULT '' NOT NULL,
  "added_by_account_id" uuid REFERENCES "accounts"("id") ON DELETE set null,
  "added_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("collection_id", "title_id"),
  CONSTRAINT "collection_items_position_check" CHECK ("position" >= 0)
);
--> statement-breakpoint
CREATE INDEX "collection_items_order_idx" ON "collection_items" ("collection_id", "position");
--> statement-breakpoint
CREATE TABLE "title_follows" (
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "title_id" uuid NOT NULL REFERENCES "titles"("id") ON DELETE cascade,
  "reminder_days" integer DEFAULT 7 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("account_id", "title_id"),
  CONSTRAINT "title_follows_days_check" CHECK ("reminder_days" between 0 and 365)
);
--> statement-breakpoint
CREATE TABLE "family_recommendations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sender_account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "recipient_account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "title_id" uuid NOT NULL REFERENCES "titles"("id") ON DELETE cascade,
  "reason" text NOT NULL,
  "status" "recommendation_status" DEFAULT 'pending' NOT NULL,
  "responded_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "family_recommendations_recipient_idx" ON "family_recommendations" ("recipient_account_id", "status");
--> statement-breakpoint
CREATE TABLE "family_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_by_account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "scheduled_for" timestamp with time zone,
  "status" text DEFAULT 'planning' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "family_events_status_check" CHECK ("status" in ('planning','scheduled','completed','cancelled'))
);
--> statement-breakpoint
CREATE INDEX "family_events_schedule_idx" ON "family_events" ("status", "scheduled_for");
--> statement-breakpoint
CREATE TABLE "family_event_candidates" (
  "event_id" uuid NOT NULL REFERENCES "family_events"("id") ON DELETE cascade,
  "title_id" uuid NOT NULL REFERENCES "titles"("id") ON DELETE cascade,
  "nominated_by_account_id" uuid REFERENCES "accounts"("id") ON DELETE set null,
  PRIMARY KEY ("event_id", "title_id")
);
--> statement-breakpoint
CREATE TABLE "family_event_votes" (
  "event_id" uuid NOT NULL,
  "title_id" uuid NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("event_id", "title_id", "account_id"),
  CONSTRAINT "family_event_votes_candidate_fk" FOREIGN KEY ("event_id", "title_id") REFERENCES "family_event_candidates"("event_id", "title_id") ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "archive_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "requested_by_account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "assigned_to_account_id" uuid REFERENCES "accounts"("id") ON DELETE set null,
  "kind" text NOT NULL,
  "status" "archive_request_status" DEFAULT 'open' NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "target_type" text,
  "target_id" text,
  "resolution" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "archive_requests_queue_idx" ON "archive_requests" ("status", "created_at");
--> statement-breakpoint
CREATE TABLE "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_account_id" uuid REFERENCES "accounts"("id") ON DELETE set null,
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text,
  "summary" text DEFAULT '' NOT NULL,
  "changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" ("target_type", "target_id", "created_at");
--> statement-breakpoint
CREATE TABLE "editorial_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_account_id" uuid REFERENCES "accounts"("id") ON DELETE set null,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "revision" integer NOT NULL,
  "action" text NOT NULL,
  "summary" text DEFAULT '' NOT NULL,
  "snapshot" jsonb NOT NULL,
  "changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_revisions_entity_revision_uq" ON "editorial_revisions" ("entity_type", "entity_id", "revision");
--> statement-breakpoint
CREATE INDEX "editorial_revisions_recent_idx" ON "editorial_revisions" ("entity_type", "entity_id", "created_at");
--> statement-breakpoint
CREATE TABLE "background_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_by_account_id" uuid REFERENCES "accounts"("id") ON DELETE set null,
  "type" text NOT NULL,
  "status" "background_job_status" DEFAULT 'queued' NOT NULL,
  "progress" integer DEFAULT 0 NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "result" jsonb,
  "error" text,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "background_jobs_progress_check" CHECK ("progress" between 0 and 100)
);
--> statement-breakpoint
CREATE INDEX "background_jobs_status_idx" ON "background_jobs" ("status", "created_at");
--> statement-breakpoint
CREATE TABLE "source_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "field_path" text NOT NULL,
  "source_note" text NOT NULL,
  "source_url" text,
  "verification_status" text DEFAULT 'unverified' NOT NULL,
  "checked_by_account_id" uuid REFERENCES "accounts"("id") ON DELETE set null,
  "checked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "source_evidence_entity_idx" ON "source_evidence" ("entity_type", "entity_id", "field_path");
