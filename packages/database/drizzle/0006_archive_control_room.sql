ALTER TYPE "account_kind" RENAME VALUE 'individual' TO 'personal';
--> statement-breakpoint
CREATE TYPE "media_asset_role" AS ENUM ('poster', 'banner', 'logo', 'profile');
--> statement-breakpoint
ALTER TABLE "genres" ADD COLUMN "description_en" text NOT NULL DEFAULT '';
ALTER TABLE "genres" ADD COLUMN "description_ar" text NOT NULL DEFAULT '';
ALTER TABLE "genres" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true;
ALTER TABLE "tones" ADD COLUMN "description_en" text NOT NULL DEFAULT '';
ALTER TABLE "tones" ADD COLUMN "description_ar" text NOT NULL DEFAULT '';
ALTER TABLE "tones" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true;
ALTER TABLE "tags" ADD COLUMN "description_en" text NOT NULL DEFAULT '';
ALTER TABLE "tags" ADD COLUMN "description_ar" text NOT NULL DEFAULT '';
ALTER TABLE "tags" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true;
ALTER TABLE "countries" ADD COLUMN "description_en" text NOT NULL DEFAULT '';
ALTER TABLE "countries" ADD COLUMN "description_ar" text NOT NULL DEFAULT '';
ALTER TABLE "countries" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true;
ALTER TABLE "roles" ADD COLUMN "description_en" text NOT NULL DEFAULT '';
ALTER TABLE "roles" ADD COLUMN "description_ar" text NOT NULL DEFAULT '';
ALTER TABLE "roles" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "genres" ADD CONSTRAINT "genres_position_check" CHECK ("position" >= 0);
ALTER TABLE "tones" ADD CONSTRAINT "tones_position_check" CHECK ("position" >= 0);
ALTER TABLE "tags" ADD CONSTRAINT "tags_position_check" CHECK ("position" >= 0);
ALTER TABLE "countries" ADD CONSTRAINT "countries_position_check" CHECK ("position" >= 0);
ALTER TABLE "roles" ADD CONSTRAINT "roles_position_check" CHECK ("position" >= 0);
--> statement-breakpoint
CREATE TABLE "vocabulary_labels" (
  "vocabulary" text NOT NULL, "value" text NOT NULL, "label_en" text NOT NULL,
  "label_ar" text NOT NULL, "description_en" text NOT NULL DEFAULT '',
  "description_ar" text NOT NULL DEFAULT '', "position" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  PRIMARY KEY ("vocabulary", "value"),
  CONSTRAINT "vocabulary_labels_vocabulary_check" CHECK ("vocabulary" in ('audiences','ages','risk-levels','release-statuses')),
  CONSTRAINT "vocabulary_labels_position_check" CHECK ("position" >= 0)
);
INSERT INTO vocabulary_labels (vocabulary, value, label_en, label_ar, position) VALUES
  ('audiences','general','General','عام',0), ('audiences','teen','Teen','يافعون',1), ('audiences','young-adult','Young Adult','شباب',2), ('audiences','adult','Adult','بالغون',3),
  ('ages','all','All','للجميع',0), ('ages','7+','7+','٧+',1), ('ages','10+','10+','١٠+',2), ('ages','13+','13+','١٣+',3), ('ages','16+','16+','١٦+',4), ('ages','18+','18+','١٨+',5),
  ('risk-levels','none','None','لا يوجد',0), ('risk-levels','low','Low','منخفض',1), ('risk-levels','medium','Medium','متوسط',2), ('risk-levels','high','High','مرتفع',3),
  ('release-statuses','announced','Announced','معلن',0), ('release-statuses','airing','Airing','يعرض الآن',1), ('release-statuses','completed','Completed','مكتمل',2), ('release-statuses','unknown','Unknown','غير معروف',3)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_asset_backfill" (
  "path" text PRIMARY KEY, "sha256" text NOT NULL, "mime_type" text NOT NULL,
  "byte_size" integer NOT NULL, "width" integer NOT NULL, "height" integer NOT NULL,
  "original_filename" text NOT NULL
);
INSERT INTO "media_asset_backfill" ("path", "sha256", "mime_type", "byte_size", "width", "height", "original_filename")
SELECT path, md5(path) || md5(path),
  CASE lower(substring(path from '\.[^.]+$')) WHEN '.png' THEN 'image/png' WHEN '.webp' THEN 'image/webp' WHEN '.gif' THEN 'image/gif' ELSE 'image/jpeg' END,
  greatest(octet_length(path), 1), 1, 1, regexp_replace(path, '^.*/', '')
FROM (
  SELECT poster_path AS path FROM titles WHERE poster_path IS NOT NULL
  UNION SELECT banner_path FROM titles WHERE banner_path IS NOT NULL
  UNION SELECT logo_path FROM titles WHERE logo_path IS NOT NULL
  UNION SELECT poster_path FROM installments WHERE poster_path IS NOT NULL
  UNION SELECT profile_path FROM entities WHERE profile_path IS NOT NULL
  UNION SELECT relative_path FROM artwork WHERE relative_path IS NOT NULL
) legacy WHERE path LIKE '/media/%' ON CONFLICT ("path") DO NOTHING;
--> statement-breakpoint
CREATE TABLE "media_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "path" text NOT NULL,
  "sha256" text NOT NULL,
  "mime_type" text NOT NULL,
  "byte_size" integer NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "original_filename" text NOT NULL,
  "deletion_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "media_assets_sha256_check" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "media_assets_mime_check" CHECK ("mime_type" in ('image/jpeg','image/png','image/webp','image/gif')),
  CONSTRAINT "media_assets_values_check" CHECK ("byte_size" > 0 and "width" > 0 and "height" > 0),
  CONSTRAINT "media_assets_path_check" CHECK ("path" like '/media/%' and "path" !~ '(^|/)\.\.(/|$)')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_sha256_uq" ON "media_assets" ("sha256");
CREATE UNIQUE INDEX "media_assets_path_uq" ON "media_assets" ("path");
--> statement-breakpoint
CREATE TABLE "media_asset_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_id" uuid NOT NULL REFERENCES "media_assets"("id") ON DELETE cascade,
  "role" "media_asset_role" NOT NULL,
  "title_id" uuid REFERENCES "titles"("id") ON DELETE cascade,
  "installment_id" uuid REFERENCES "installments"("id") ON DELETE cascade,
  "episode_id" uuid REFERENCES "episodes"("id") ON DELETE cascade,
  "entity_id" uuid REFERENCES "entities"("id") ON DELETE cascade,
  "is_primary" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "media_assignment_one_owner_check" CHECK (num_nonnulls("title_id", "installment_id", "episode_id", "entity_id") = 1)
);
--> statement-breakpoint
CREATE INDEX "media_assignments_asset_idx" ON "media_asset_assignments" ("asset_id");
CREATE INDEX "media_assignments_title_idx" ON "media_asset_assignments" ("title_id");
CREATE INDEX "media_assignments_installment_idx" ON "media_asset_assignments" ("installment_id");
CREATE INDEX "media_assignments_episode_idx" ON "media_asset_assignments" ("episode_id");
CREATE INDEX "media_assignments_entity_idx" ON "media_asset_assignments" ("entity_id");
CREATE UNIQUE INDEX "media_assignment_identity_uq" ON "media_asset_assignments" ("asset_id", "role", coalesce("title_id", '00000000-0000-0000-0000-000000000000'), coalesce("installment_id", '00000000-0000-0000-0000-000000000000'), coalesce("episode_id", '00000000-0000-0000-0000-000000000000'), coalesce("entity_id", '00000000-0000-0000-0000-000000000000'));
CREATE UNIQUE INDEX "media_assignment_title_primary_uq" ON "media_asset_assignments" ("title_id", "role") WHERE "title_id" IS NOT NULL AND "is_primary";
CREATE UNIQUE INDEX "media_assignment_installment_primary_uq" ON "media_asset_assignments" ("installment_id", "role") WHERE "installment_id" IS NOT NULL AND "is_primary";
CREATE UNIQUE INDEX "media_assignment_episode_primary_uq" ON "media_asset_assignments" ("episode_id", "role") WHERE "episode_id" IS NOT NULL AND "is_primary";
CREATE UNIQUE INDEX "media_assignment_entity_primary_uq" ON "media_asset_assignments" ("entity_id", "role") WHERE "entity_id" IS NOT NULL AND "is_primary";
--> statement-breakpoint
INSERT INTO "media_assets" ("path", "sha256", "mime_type", "byte_size", "width", "height", "original_filename")
SELECT DISTINCT ON (sha256) path, sha256, mime_type, byte_size, width, height, original_filename
FROM media_asset_backfill ORDER BY sha256, path
ON CONFLICT ("path") DO NOTHING;
--> statement-breakpoint
INSERT INTO "media_asset_assignments" ("asset_id", "role", "title_id", "is_primary")
SELECT a.id, role::media_asset_role, owner_id, true FROM (
  SELECT id AS owner_id, poster_path AS path, 'poster' AS role FROM titles WHERE poster_path IS NOT NULL
  UNION ALL SELECT id, banner_path, 'banner' FROM titles WHERE banner_path IS NOT NULL
  UNION ALL SELECT id, logo_path, 'logo' FROM titles WHERE logo_path IS NOT NULL
) source JOIN media_asset_backfill staged USING (path) JOIN media_assets a ON a.sha256=staged.sha256 ON CONFLICT DO NOTHING;
INSERT INTO "media_asset_assignments" ("asset_id", "role", "installment_id", "is_primary")
SELECT a.id, 'poster', source.id, true FROM installments source JOIN media_asset_backfill staged ON staged.path=source.poster_path JOIN media_assets a ON a.sha256=staged.sha256 WHERE source.poster_path IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO "media_asset_assignments" ("asset_id", "role", "entity_id", "is_primary")
SELECT a.id, 'profile', source.id, true FROM entities source JOIN media_asset_backfill staged ON staged.path=source.profile_path JOIN media_assets a ON a.sha256=staged.sha256 WHERE source.profile_path IS NOT NULL ON CONFLICT DO NOTHING;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (
      SELECT id, poster_path AS path, 'poster' AS role FROM titles WHERE poster_path IS NOT NULL AND poster_path LIKE '/media/%'
      UNION ALL SELECT id, banner_path, 'banner' FROM titles WHERE banner_path IS NOT NULL AND banner_path LIKE '/media/%'
      UNION ALL SELECT id, logo_path, 'logo' FROM titles WHERE logo_path IS NOT NULL AND logo_path LIKE '/media/%'
    ) old LEFT JOIN media_asset_assignments maa ON maa.title_id=old.id AND maa.role::text=old.role WHERE maa.id IS NULL
  ) THEN RAISE EXCEPTION 'media backfill parity check failed'; END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "titles" DROP COLUMN "poster_path";
ALTER TABLE "titles" DROP COLUMN "banner_path";
ALTER TABLE "titles" DROP COLUMN "logo_path";
ALTER TABLE "installments" DROP COLUMN "poster_path";
ALTER TABLE "entities" DROP COLUMN "profile_path";
DROP TABLE "artwork";
DROP TABLE "media_asset_backfill";
--> statement-breakpoint
DELETE FROM "external_identities" WHERE "owner_type" <> 'title';
ALTER TABLE "external_identities" RENAME COLUMN "owner_id" TO "title_id";
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "titles"("id") ON DELETE cascade;
DROP INDEX "external_identity_provider_uq";
CREATE UNIQUE INDEX "external_identity_provider_uq" ON "external_identities" (lower(btrim("provider")), "external_id");
CREATE INDEX "external_identities_title_idx" ON "external_identities" ("title_id");
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identity_provider_check" CHECK (btrim("provider") <> '');
ALTER TABLE "external_identities" DROP COLUMN "owner_type";
--> statement-breakpoint
CREATE TABLE "account_preferences" (LIKE "profile_preferences" INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE "account_preferences" RENAME COLUMN "profile_id" TO "account_id";
ALTER TABLE "account_preferences" ADD PRIMARY KEY ("account_id");
ALTER TABLE "account_preferences" ADD CONSTRAINT "account_preferences_account_fk" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade;
INSERT INTO "account_preferences" SELECT vp.account_id, p.locale, p.theme, p.preferred_audio, p.allowed_audio, p.subtitle_mode, p.can_switch_tracks FROM profile_preferences p JOIN viewer_profiles vp ON vp.id=p.profile_id ON CONFLICT DO NOTHING;
CREATE TABLE "account_content_policies" (LIKE "profile_content_policies" INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE "account_content_policies" RENAME COLUMN "profile_id" TO "account_id";
ALTER TABLE "account_content_policies" ADD PRIMARY KEY ("account_id");
ALTER TABLE "account_content_policies" ADD CONSTRAINT "account_content_policies_account_fk" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade;
INSERT INTO "account_content_policies" SELECT vp.account_id, p.audience, p.age, p.sexuality_risk, p.behavioral_risk, p.theology_risk, p.inclusion_filter FROM profile_content_policies p JOIN viewer_profiles vp ON vp.id=p.profile_id ON CONFLICT DO NOTHING;
CREATE TABLE "account_admin_restrictions" (LIKE "profile_admin_restrictions" INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE "account_admin_restrictions" RENAME COLUMN "profile_id" TO "account_id";
ALTER TABLE "account_admin_restrictions" ADD PRIMARY KEY ("account_id");
ALTER TABLE "account_admin_restrictions" ADD CONSTRAINT "account_admin_restrictions_account_fk" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade;
INSERT INTO "account_admin_restrictions" SELECT vp.account_id, p.audience, p.age, p.sexuality_risk, p.behavioral_risk, p.theology_risk, p.notes FROM profile_admin_restrictions p JOIN viewer_profiles vp ON vp.id=p.profile_id ON CONFLICT DO NOTHING;
CREATE TABLE "account_title_blocks" ("account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade, "title_id" uuid NOT NULL REFERENCES "titles"("id") ON DELETE cascade, PRIMARY KEY ("account_id", "title_id"));
INSERT INTO "account_title_blocks" SELECT vp.account_id, p.title_id FROM profile_title_blocks p JOIN viewer_profiles vp ON vp.id=p.profile_id ON CONFLICT DO NOTHING;
CREATE TABLE "account_playback_states" ("account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade, "installment_id" uuid NOT NULL REFERENCES "installments"("id") ON DELETE cascade, "episode_id" uuid, "position_seconds" integer DEFAULT 0 NOT NULL, "completed" boolean DEFAULT false NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL, PRIMARY KEY ("account_id", "installment_id"), CONSTRAINT "playback_position_check" CHECK ("position_seconds" >= 0));
INSERT INTO "account_playback_states" SELECT vp.account_id, p.installment_id, p.episode_id, p.position_seconds, p.completed, p.updated_at FROM profile_playback_states p JOIN viewer_profiles vp ON vp.id=p.profile_id ON CONFLICT DO NOTHING;
--> statement-breakpoint
DROP TABLE "profile_preferences";
DROP TABLE "profile_content_policies";
DROP TABLE "profile_admin_restrictions";
DROP TABLE "profile_title_blocks";
DROP TABLE "profile_playback_states";
DROP TABLE "viewer_profiles";
--> statement-breakpoint
CREATE UNIQUE INDEX "episodes_id_installment_uq" ON "episodes" ("id", "installment_id");
CREATE UNIQUE INDEX "episodes_installment_number_uq" ON "episodes" ("installment_id", "number");
ALTER TABLE "account_playback_states" ADD CONSTRAINT "account_playback_episode_installment_fk" FOREIGN KEY ("episode_id", "installment_id") REFERENCES "episodes"("id", "installment_id") ON DELETE cascade;
CREATE INDEX "account_playback_installment_idx" ON "account_playback_states" ("installment_id");
CREATE INDEX "account_playback_episode_idx" ON "account_playback_states" ("episode_id");
CREATE INDEX "account_title_blocks_title_idx" ON "account_title_blocks" ("title_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "entity_alias_normalized_uq" ON "entity_aliases" ("entity_id", lower(btrim("alias")));
CREATE UNIQUE INDEX "title_planets_featured_rank_uq" ON "title_planets" ("planet_id", "featured_rank") WHERE "featured_rank" IS NOT NULL;
ALTER TABLE "title_planets" ADD CONSTRAINT "title_planets_featured_rank_check" CHECK ("featured_rank" IS NULL OR "featured_rank" >= 0);
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_position_check" CHECK ("position" >= 0);
ALTER TABLE "media_files" ADD CONSTRAINT "media_file_duration_check" CHECK ("duration_seconds" IS NULL OR "duration_seconds" >= 0);
ALTER TABLE "media_tracks" ADD CONSTRAINT "media_tracks_stream_index_check" CHECK ("stream_index" >= 0);
CREATE INDEX "contributions_entity_idx" ON "contributions" ("entity_id");
CREATE INDEX "contributions_role_idx" ON "contributions" ("role_id");
CREATE INDEX "title_genres_value_idx" ON "title_genres" ("value_id");
CREATE INDEX "title_tones_value_idx" ON "title_tones" ("value_id");
CREATE INDEX "title_tags_value_idx" ON "title_tags" ("value_id");
CREATE INDEX "title_countries_value_idx" ON "title_countries" ("value_id");
CREATE INDEX "title_planets_planet_idx" ON "title_planets" ("planet_id");
CREATE INDEX "title_relations_target_idx" ON "title_relations" ("target_title_id");
CREATE INDEX "organization_relations_target_idx" ON "organization_relations" ("target_id");
CREATE INDEX "media_files_installment_idx" ON "media_files" ("installment_id");
CREATE INDEX "media_files_episode_idx" ON "media_files" ("episode_id");
