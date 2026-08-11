CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."account_kind" AS ENUM('admin', 'family', 'individual');--> statement-breakpoint
CREATE TYPE "public"."age_rating" AS ENUM('all', '7+', '10+', '13+', '16+', '18+');--> statement-breakpoint
CREATE TYPE "public"."audience" AS ENUM('general', 'teen', 'young-adult', 'adult');--> statement-breakpoint
CREATE TYPE "public"."entity_kind" AS ENUM('person', 'organization');--> statement-breakpoint
CREATE TYPE "public"."installment_kind" AS ENUM('season', 'movie', 'special');--> statement-breakpoint
CREATE TYPE "public"."title_relation_kind" AS ENUM('sequel', 'adaptation', 'spin-off', 'side-story', 'compilation', 'alternative', 'related');--> statement-breakpoint
CREATE TYPE "public"."release_status" AS ENUM('announced', 'releasing', 'released', 'ended', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('none', 'low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."track_kind" AS ENUM('video', 'audio', 'subtitle');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "account_kind" NOT NULL,
	"display_name" text NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artwork" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"relative_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer,
	"height" integer
);
--> statement-breakpoint
CREATE TABLE "contributions" (
	"title_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "contributions_title_id_entity_id_role_id_pk" PRIMARY KEY("title_id","entity_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label_en" text NOT NULL,
	"label_ar" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "countries_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "entity_kind" NOT NULL,
	"name" text NOT NULL,
	"sort_name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"profile_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"language" text
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installment_id" uuid NOT NULL,
	"number" numeric(8, 2) NOT NULL,
	"position" integer NOT NULL,
	"title" text,
	"release_date" date,
	"runtime_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "episodes_values_check" CHECK ("episodes"."position" >= 0 and ("episodes"."runtime_minutes" is null or "episodes"."runtime_minutes" >= 0))
);
--> statement-breakpoint
CREATE TABLE "external_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"url" text
);
--> statement-breakpoint
CREATE TABLE "genres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label_en" text NOT NULL,
	"label_ar" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "genres_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "installment_scores" (
	"installment_id" uuid PRIMARY KEY NOT NULL,
	"story" numeric(3, 1),
	"characters" numeric(3, 1),
	"depth" numeric(3, 1),
	"world_building" numeric(3, 1),
	"originality" numeric(3, 1),
	"craft" numeric(3, 1),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "installment_scores_range_check" CHECK (("installment_scores"."story" is null or "installment_scores"."story" between 0 and 10) and ("installment_scores"."characters" is null or "installment_scores"."characters" between 0 and 10) and ("installment_scores"."depth" is null or "installment_scores"."depth" between 0 and 10) and ("installment_scores"."world_building" is null or "installment_scores"."world_building" between 0 and 10) and ("installment_scores"."originality" is null or "installment_scores"."originality" between 0 and 10) and ("installment_scores"."craft" is null or "installment_scores"."craft" between 0 and 10))
);
--> statement-breakpoint
CREATE TABLE "installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_id" uuid NOT NULL,
	"kind" "installment_kind" NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"release_date" date,
	"runtime_minutes" integer,
	"status" "release_status" DEFAULT 'unknown' NOT NULL,
	"poster_path" text,
	"audience_override" "audience",
	"age_override" "age_rating",
	"sexuality_risk_override" "risk_level",
	"behavioral_risk_override" "risk_level",
	"theology_risk_override" "risk_level",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "installments_values_check" CHECK ("installments"."position" >= 0 and ("installments"."runtime_minutes" is null or "installments"."runtime_minutes" >= 0))
);
--> statement-breakpoint
CREATE TABLE "jellyfin_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"media_file_id" uuid,
	"external_item_id" text NOT NULL,
	"etag" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jellyfin_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"external_server_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installment_id" uuid,
	"episode_id" uuid,
	"path" text NOT NULL,
	"duration_seconds" integer,
	"probe_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_file_single_owner_check" CHECK (num_nonnulls("media_files"."installment_id", "media_files"."episode_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "media_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_file_id" uuid NOT NULL,
	"kind" "track_kind" NOT NULL,
	"stream_index" integer NOT NULL,
	"language" text,
	"codec" text,
	"title" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_forced" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"relation_type" text NOT NULL,
	"occurred_on" date,
	"description" text DEFAULT '' NOT NULL,
	CONSTRAINT "organization_relation_distinct_check" CHECK ("organization_relations"."source_id" <> "organization_relations"."target_id")
);
--> statement-breakpoint
CREATE TABLE "planets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text,
	"icon" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"primary_color" text NOT NULL,
	"secondary_color" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planets_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "profile_admin_restrictions" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"audience" "audience" DEFAULT 'general' NOT NULL,
	"age" "age_rating" DEFAULT 'all' NOT NULL,
	"sexuality_risk" "risk_level" DEFAULT 'none' NOT NULL,
	"behavioral_risk" "risk_level" DEFAULT 'none' NOT NULL,
	"theology_risk" "risk_level" DEFAULT 'none' NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_content_policies" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"audience" "audience" DEFAULT 'general' NOT NULL,
	"age" "age_rating" DEFAULT 'all' NOT NULL,
	"sexuality_risk" "risk_level" DEFAULT 'none' NOT NULL,
	"behavioral_risk" "risk_level" DEFAULT 'none' NOT NULL,
	"theology_risk" "risk_level" DEFAULT 'none' NOT NULL,
	"inclusion_filter" jsonb
);
--> statement-breakpoint
CREATE TABLE "profile_playback_states" (
	"profile_id" uuid NOT NULL,
	"installment_id" uuid NOT NULL,
	"episode_id" uuid,
	"position_seconds" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_playback_states_profile_id_installment_id_pk" PRIMARY KEY("profile_id","installment_id"),
	CONSTRAINT "playback_position_check" CHECK ("profile_playback_states"."position_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "profile_preferences" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"locale" text DEFAULT 'ar' NOT NULL,
	"theme" text DEFAULT 'dark' NOT NULL,
	"preferred_audio" text[] DEFAULT ARRAY['ar']::text[] NOT NULL,
	"allowed_audio" text[] DEFAULT ARRAY['ar','en']::text[] NOT NULL,
	"subtitle_mode" text DEFAULT 'allowed' NOT NULL,
	"can_switch_tracks" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_title_blocks" (
	"profile_id" uuid NOT NULL,
	"title_id" uuid NOT NULL,
	CONSTRAINT "profile_title_blocks_profile_id_title_id_pk" PRIMARY KEY("profile_id","title_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label_en" text NOT NULL,
	"label_ar" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "roles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label_en" text NOT NULL,
	"label_ar" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "title_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_id" uuid NOT NULL,
	"title" text NOT NULL,
	"language" text,
	"script" text,
	"is_preferred" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "title_countries" (
	"title_id" uuid NOT NULL,
	"value_id" uuid NOT NULL,
	CONSTRAINT "title_countries_title_id_value_id_pk" PRIMARY KEY("title_id","value_id")
);
--> statement-breakpoint
CREATE TABLE "title_genres" (
	"title_id" uuid NOT NULL,
	"value_id" uuid NOT NULL,
	CONSTRAINT "title_genres_title_id_value_id_pk" PRIMARY KEY("title_id","value_id")
);
--> statement-breakpoint
CREATE TABLE "title_planets" (
	"title_id" uuid NOT NULL,
	"planet_id" uuid NOT NULL,
	"featured_rank" integer,
	CONSTRAINT "title_planets_title_id_planet_id_pk" PRIMARY KEY("title_id","planet_id")
);
--> statement-breakpoint
CREATE TABLE "title_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_title_id" uuid NOT NULL,
	"target_title_id" uuid NOT NULL,
	"kind" "title_relation_kind" NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	CONSTRAINT "title_relations_distinct_check" CHECK ("title_relations"."source_title_id" <> "title_relations"."target_title_id")
);
--> statement-breakpoint
CREATE TABLE "title_tags" (
	"title_id" uuid NOT NULL,
	"value_id" uuid NOT NULL,
	CONSTRAINT "title_tags_title_id_value_id_pk" PRIMARY KEY("title_id","value_id")
);
--> statement-breakpoint
CREATE TABLE "title_tones" (
	"title_id" uuid NOT NULL,
	"value_id" uuid NOT NULL,
	CONSTRAINT "title_tones_title_id_value_id_pk" PRIMARY KEY("title_id","value_id")
);
--> statement-breakpoint
CREATE TABLE "titles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_title" text NOT NULL,
	"sort_title" text NOT NULL,
	"title_ar" text,
	"summary" text DEFAULT '' NOT NULL,
	"release_year" integer,
	"poster_path" text,
	"banner_path" text,
	"logo_path" text,
	"audience" "audience" DEFAULT 'general' NOT NULL,
	"age" "age_rating" DEFAULT 'all' NOT NULL,
	"sexuality_risk" "risk_level" DEFAULT 'none' NOT NULL,
	"behavioral_risk" "risk_level" DEFAULT 'none' NOT NULL,
	"theology_risk" "risk_level" DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label_en" text NOT NULL,
	"label_ar" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "tones_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "viewer_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"avatar" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_aliases" ADD CONSTRAINT "entity_aliases_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_scores" ADD CONSTRAINT "installment_scores_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jellyfin_items" ADD CONSTRAINT "jellyfin_items_server_id_jellyfin_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."jellyfin_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jellyfin_items" ADD CONSTRAINT "jellyfin_items_media_file_id_media_files_id_fk" FOREIGN KEY ("media_file_id") REFERENCES "public"."media_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_tracks" ADD CONSTRAINT "media_tracks_media_file_id_media_files_id_fk" FOREIGN KEY ("media_file_id") REFERENCES "public"."media_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_relations" ADD CONSTRAINT "organization_relations_source_id_entities_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_relations" ADD CONSTRAINT "organization_relations_target_id_entities_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_admin_restrictions" ADD CONSTRAINT "profile_admin_restrictions_profile_id_viewer_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."viewer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_content_policies" ADD CONSTRAINT "profile_content_policies_profile_id_viewer_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."viewer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_playback_states" ADD CONSTRAINT "profile_playback_states_profile_id_viewer_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."viewer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_playback_states" ADD CONSTRAINT "profile_playback_states_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_playback_states" ADD CONSTRAINT "profile_playback_states_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_preferences" ADD CONSTRAINT "profile_preferences_profile_id_viewer_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."viewer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_title_blocks" ADD CONSTRAINT "profile_title_blocks_profile_id_viewer_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."viewer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_title_blocks" ADD CONSTRAINT "profile_title_blocks_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_aliases" ADD CONSTRAINT "title_aliases_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_countries" ADD CONSTRAINT "title_countries_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_countries" ADD CONSTRAINT "title_countries_value_id_countries_id_fk" FOREIGN KEY ("value_id") REFERENCES "public"."countries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_genres" ADD CONSTRAINT "title_genres_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_genres" ADD CONSTRAINT "title_genres_value_id_genres_id_fk" FOREIGN KEY ("value_id") REFERENCES "public"."genres"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_planets" ADD CONSTRAINT "title_planets_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_planets" ADD CONSTRAINT "title_planets_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_relations" ADD CONSTRAINT "title_relations_source_title_id_titles_id_fk" FOREIGN KEY ("source_title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_relations" ADD CONSTRAINT "title_relations_target_title_id_titles_id_fk" FOREIGN KEY ("target_title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_tags" ADD CONSTRAINT "title_tags_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_tags" ADD CONSTRAINT "title_tags_value_id_tags_id_fk" FOREIGN KEY ("value_id") REFERENCES "public"."tags"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_tones" ADD CONSTRAINT "title_tones_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_tones" ADD CONSTRAINT "title_tones_value_id_tones_id_fk" FOREIGN KEY ("value_id") REFERENCES "public"."tones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewer_profiles" ADD CONSTRAINT "viewer_profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entities_kind_sort_uq" ON "entities" USING btree ("kind","sort_name");--> statement-breakpoint
CREATE UNIQUE INDEX "episodes_installment_position_uq" ON "episodes" USING btree ("installment_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "external_identity_provider_uq" ON "external_identities" USING btree ("provider","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "installments_title_position_uq" ON "installments" USING btree ("title_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "jellyfin_item_external_uq" ON "jellyfin_items" USING btree ("server_id","external_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_tracks_stream_uq" ON "media_tracks" USING btree ("media_file_id","stream_index");--> statement-breakpoint
CREATE UNIQUE INDEX "title_alias_identity_uq" ON "title_aliases" USING btree ("title_id","title","language");--> statement-breakpoint
CREATE INDEX "title_alias_search_trgm_idx" ON "title_aliases" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "title_relations_pair_kind_uq" ON "title_relations" USING btree ("source_title_id","target_title_id","kind");--> statement-breakpoint
CREATE INDEX "titles_sort_idx" ON "titles" USING btree ("sort_title");--> statement-breakpoint
CREATE INDEX "titles_release_year_idx" ON "titles" USING btree ("release_year");--> statement-breakpoint
CREATE INDEX "titles_search_trgm_idx" ON "titles" USING gin ("canonical_title" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "viewer_profiles_account_uq" ON "viewer_profiles" USING btree ("account_id");
