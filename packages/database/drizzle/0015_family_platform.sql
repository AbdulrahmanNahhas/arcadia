CREATE TYPE "public"."account_status" AS ENUM('invited', 'active', 'suspended');
--> statement-breakpoint
CREATE TYPE "public"."library_status" AS ENUM('planned', 'watching', 'completed', 'paused', 'dropped');
--> statement-breakpoint
CREATE TYPE "public"."moderation_status" AS ENUM('published', 'hidden');
--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('reply', 'reaction', 'review', 'catalog', 'system');
--> statement-breakpoint
CREATE TABLE "auth_users" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "username" text,
  "display_username" text,
  "role" text DEFAULT 'member' NOT NULL,
  "banned" boolean DEFAULT false NOT NULL,
  "ban_reason" text,
  "ban_expires" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "auth_users_email_uq" ON "auth_users" ("email");
--> statement-breakpoint
CREATE UNIQUE INDEX "auth_users_username_uq" ON "auth_users" ("username");
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "token" text NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "auth_users"("id") ON DELETE cascade,
  "impersonated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_token_uq" ON "auth_sessions" ("token");
--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" ("user_id");
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "auth_users"("id") ON DELETE cascade,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp with time zone,
  "refresh_token_expires_at" timestamp with time zone,
  "scope" text,
  "password" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auth_accounts_user_idx" ON "auth_accounts" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "auth_accounts_provider_identity_uq" ON "auth_accounts" ("provider_id", "account_id");
--> statement-breakpoint
CREATE TABLE "auth_verifications" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications" ("identifier");
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "auth_user_id" text REFERENCES "auth_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "status" "account_status" DEFAULT 'invited' NOT NULL;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "slug" text;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "avatar_key" text DEFAULT 'orbit-1' NOT NULL;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "bio" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "is_discoverable" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "last_seen_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "accounts" SET "status" = 'active';
--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_auth_user_uq" ON "accounts" ("auth_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_slug_uq" ON "accounts" ("slug");
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_avatar_key_check" CHECK ("avatar_key" in ('orbit-1','orbit-2','orbit-3','orbit-4','orbit-5'));
--> statement-breakpoint
CREATE TABLE "account_capabilities" (
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "capability" text NOT NULL,
  "granted_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("account_id", "capability"),
  CONSTRAINT "account_capabilities_value_check" CHECK ("capability" in ('catalog.view','catalog.edit','people.edit','studios.edit','awards.edit','accounts.manage','policies.manage','social.moderate','media.manage','analytics.view'))
);
--> statement-breakpoint
CREATE TABLE "account_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token_hash" text NOT NULL,
  "display_name" text NOT NULL,
  "username" text NOT NULL,
  "kind" "account_kind" NOT NULL,
  "role" text DEFAULT 'member' NOT NULL,
  "avatar_key" text DEFAULT 'orbit-1' NOT NULL,
  "capabilities" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "created_by_account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "accepted_by_account_id" uuid REFERENCES "accounts"("id") ON DELETE set null,
  "expires_at" timestamp with time zone NOT NULL,
  "accepted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "account_invites_role_check" CHECK ("role" in ('owner','editor','member'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "account_invites_token_hash_uq" ON "account_invites" ("token_hash");
--> statement-breakpoint
ALTER TABLE "account_preferences" ADD COLUMN "autoplay" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "account_preferences" ADD COLUMN "hide_spoilers" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "account_preferences" ADD COLUMN "notify_family_activity" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "account_preferences" ADD COLUMN "notify_replies" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
CREATE TABLE "account_tag_blocks" (
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "tag_id" uuid NOT NULL REFERENCES "tags"("id") ON DELETE cascade,
  PRIMARY KEY ("account_id", "tag_id")
);
--> statement-breakpoint
CREATE INDEX "account_tag_blocks_tag_idx" ON "account_tag_blocks" ("tag_id");
--> statement-breakpoint
CREATE TABLE "account_genre_blocks" (
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "genre_id" uuid NOT NULL REFERENCES "genres"("id") ON DELETE cascade,
  PRIMARY KEY ("account_id", "genre_id")
);
--> statement-breakpoint
CREATE INDEX "account_genre_blocks_genre_idx" ON "account_genre_blocks" ("genre_id");
--> statement-breakpoint
CREATE TABLE "account_entity_blocks" (
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "entity_id" uuid NOT NULL REFERENCES "entities"("id") ON DELETE cascade,
  PRIMARY KEY ("account_id", "entity_id")
);
--> statement-breakpoint
CREATE INDEX "account_entity_blocks_entity_idx" ON "account_entity_blocks" ("entity_id");
--> statement-breakpoint
CREATE TABLE "account_planet_blocks" (
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "planet_id" uuid NOT NULL REFERENCES "planets"("id") ON DELETE cascade,
  PRIMARY KEY ("account_id", "planet_id")
);
--> statement-breakpoint
CREATE INDEX "account_planet_blocks_planet_idx" ON "account_planet_blocks" ("planet_id");
--> statement-breakpoint
ALTER TABLE "account_playback_states" ADD COLUMN "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "account_playback_states" DROP CONSTRAINT "account_playback_states_pkey";
--> statement-breakpoint
ALTER TABLE "account_playback_states" ADD PRIMARY KEY ("id");
--> statement-breakpoint
CREATE UNIQUE INDEX "account_playback_owner_uq" ON "account_playback_states" ("account_id", "installment_id", "episode_id") NULLS NOT DISTINCT;
--> statement-breakpoint
CREATE TABLE "account_title_states" (
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "title_id" uuid NOT NULL REFERENCES "titles"("id") ON DELETE cascade,
  "status" "library_status",
  "is_favorite" boolean DEFAULT false NOT NULL,
  "personal_rating" integer,
  "notes" text DEFAULT '' NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("account_id", "title_id"),
  CONSTRAINT "account_title_states_rating_check" CHECK ("personal_rating" is null or "personal_rating" between 1 and 5)
);
--> statement-breakpoint
CREATE INDEX "account_title_states_title_idx" ON "account_title_states" ("title_id");
--> statement-breakpoint
CREATE TABLE "title_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "title_id" uuid NOT NULL REFERENCES "titles"("id") ON DELETE cascade,
  "rating" integer NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "contains_spoilers" boolean DEFAULT false NOT NULL,
  "moderation_status" "moderation_status" DEFAULT 'published' NOT NULL,
  "moderated_by_account_id" uuid REFERENCES "accounts"("id") ON DELETE set null,
  "moderated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "title_reviews_rating_check" CHECK ("rating" between 1 and 5),
  CONSTRAINT "title_reviews_body_check" CHECK (char_length("body") <= 1200)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "title_reviews_account_title_uq" ON "title_reviews" ("account_id", "title_id");
--> statement-breakpoint
CREATE INDEX "title_reviews_title_idx" ON "title_reviews" ("title_id", "moderation_status");
--> statement-breakpoint
CREATE TABLE "title_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "title_id" uuid NOT NULL REFERENCES "titles"("id") ON DELETE cascade,
  "parent_id" uuid REFERENCES "title_comments"("id") ON DELETE cascade,
  "body" text NOT NULL,
  "contains_spoilers" boolean DEFAULT false NOT NULL,
  "moderation_status" "moderation_status" DEFAULT 'published' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "title_comments_body_check" CHECK (char_length(btrim("body")) between 1 and 1200)
);
--> statement-breakpoint
CREATE INDEX "title_comments_title_idx" ON "title_comments" ("title_id", "created_at");
--> statement-breakpoint
CREATE INDEX "title_comments_parent_idx" ON "title_comments" ("parent_id");
--> statement-breakpoint
CREATE TABLE "review_reactions" (
  "review_id" uuid NOT NULL REFERENCES "title_reviews"("id") ON DELETE cascade,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "emoji" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("review_id", "account_id", "emoji"),
  CONSTRAINT "review_reactions_emoji_check" CHECK ("emoji" in ('heart','clap','laugh','wow','think'))
);
--> statement-breakpoint
CREATE TABLE "comment_reactions" (
  "comment_id" uuid NOT NULL REFERENCES "title_comments"("id") ON DELETE cascade,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "emoji" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("comment_id", "account_id", "emoji"),
  CONSTRAINT "comment_reactions_emoji_check" CHECK ("emoji" in ('heart','clap','laugh','wow','think'))
);
--> statement-breakpoint
CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "actor_account_id" uuid REFERENCES "accounts"("id") ON DELETE set null,
  "kind" "notification_kind" NOT NULL,
  "title_id" uuid REFERENCES "titles"("id") ON DELETE cascade,
  "object_id" uuid,
  "message" text NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "notifications_inbox_idx" ON "notifications" ("account_id", "read_at", "created_at");
--> statement-breakpoint
CREATE TABLE "award_organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "name_ar" text NOT NULL,
  "name_en" text,
  "description" text DEFAULT '' NOT NULL,
  "website_url" text,
  "logo_path" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "award_organizations_values_check" CHECK (btrim("slug") <> '' and btrim("name_ar") <> '')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "award_organizations_slug_uq" ON "award_organizations" ("slug");
--> statement-breakpoint
CREATE TABLE "award_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "award_organizations"("id") ON DELETE cascade,
  "slug" text NOT NULL,
  "name_ar" text NOT NULL,
  "name_en" text,
  "description" text DEFAULT '' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "award_categories_values_check" CHECK (btrim("slug") <> '' and btrim("name_ar") <> '')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "award_categories_organization_slug_uq" ON "award_categories" ("organization_id", "slug");
--> statement-breakpoint
CREATE INDEX "award_categories_organization_idx" ON "award_categories" ("organization_id", "is_active");
--> statement-breakpoint
CREATE TABLE "award_ceremonies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "award_organizations"("id") ON DELETE cascade,
  "year" integer NOT NULL,
  "edition" integer,
  "label" text DEFAULT '' NOT NULL,
  "held_on" date,
  "source_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "award_ceremonies_year_check" CHECK ("year" between 1900 and 2100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "award_ceremonies_organization_year_uq" ON "award_ceremonies" ("organization_id", "year");
--> statement-breakpoint
ALTER TABLE "award_recognitions" ADD COLUMN "organization_id" uuid REFERENCES "award_organizations"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "award_recognitions" ADD COLUMN "category_id" uuid REFERENCES "award_categories"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "award_recognitions" ADD COLUMN "ceremony_id" uuid REFERENCES "award_ceremonies"("id") ON DELETE set null;
--> statement-breakpoint
INSERT INTO "award_organizations" ("slug", "name_ar", "name_en")
SELECT "organization_slug", min("organization_name"), min("organization_name")
FROM "award_recognitions" GROUP BY "organization_slug" ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "award_categories" ("organization_id", "slug", "name_ar", "name_en")
SELECT o."id", regexp_replace(lower(btrim(r."category")), '[^[:alnum:]]+', '-', 'g'), min(r."category"), min(r."category")
FROM "award_recognitions" r JOIN "award_organizations" o ON o."slug" = r."organization_slug"
GROUP BY o."id", regexp_replace(lower(btrim(r."category")), '[^[:alnum:]]+', '-', 'g') ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "award_ceremonies" ("organization_id", "year", "label")
SELECT DISTINCT o."id", r."year", r."year"::text
FROM "award_recognitions" r JOIN "award_organizations" o ON o."slug" = r."organization_slug"
WHERE r."year" IS NOT NULL ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "award_recognitions" r SET "organization_id" = o."id"
FROM "award_organizations" o WHERE o."slug" = r."organization_slug";
--> statement-breakpoint
UPDATE "award_recognitions" r SET "category_id" = c."id"
FROM "award_categories" c
WHERE c."organization_id" = r."organization_id"
  AND c."slug" = regexp_replace(lower(btrim(r."category")), '[^[:alnum:]]+', '-', 'g');
--> statement-breakpoint
UPDATE "award_recognitions" r SET "ceremony_id" = ce."id"
FROM "award_ceremonies" ce
WHERE ce."organization_id" = r."organization_id" AND ce."year" = r."year";
