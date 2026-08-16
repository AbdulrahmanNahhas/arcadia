-- Credits are intentionally typed: people receive creative roles and organizations
-- receive company roles. Existing credits are preserved while legacy role names are
-- normalized to the new, underscore-delimited vocabulary.
ALTER TABLE "roles" ADD COLUMN "entity_kind" "entity_kind" NOT NULL DEFAULT 'person';
--> statement-breakpoint
INSERT INTO "roles" ("slug", "label_en", "label_ar", "position", "entity_kind") VALUES
  ('creator', 'Creator', 'منشئ', 0, 'person'),
  ('original_author', 'Original author', 'مؤلف أصلي', 1, 'person'),
  ('director', 'Director', 'مخرج', 2, 'person'),
  ('writer', 'Writer', 'كاتب', 3, 'person'),
  ('producer', 'Producer', 'منتج', 4, 'person'),
  ('executive_producer', 'Executive producer', 'منتج تنفيذي', 5, 'person'),
  ('creative_producer', 'Creative producer', 'منتج إبداعي', 6, 'person'),
  ('character_designer', 'Character designer', 'مصمم شخصيات', 7, 'person'),
  ('art_director', 'Art director', 'مدير فني', 8, 'person'),
  ('composer', 'Composer', 'ملحن', 9, 'person'),
  ('animation_studio', 'Animation studio', 'استوديو رسوم متحركة', 10, 'organization'),
  ('production_company', 'Production company', 'شركة إنتاج', 11, 'organization'),
  ('distributor', 'Distributor', 'موزع', 12, 'organization'),
  ('publisher', 'Publisher', 'ناشر', 13, 'organization')
ON CONFLICT ("slug") DO UPDATE SET
  "label_en" = EXCLUDED."label_en",
  "label_ar" = EXCLUDED."label_ar",
  "position" = EXCLUDED."position",
  "entity_kind" = EXCLUDED."entity_kind";
--> statement-breakpoint
-- Merge legacy role credits into their replacement. Conflict handling preserves a
-- primary flag and the earliest display position if both credits already exist.
DO $$
DECLARE
  mapping record;
BEGIN
  FOR mapping IN
    SELECT * FROM (VALUES
      ('author', 'original_author'),
      ('original-author', 'original_author'),
      ('screenwriter', 'writer'),
      ('illustrator', 'character_designer'),
      ('artist', 'art_director'),
      ('animation-studio', 'animation_studio'),
      ('production-company', 'production_company'),
      ('developer', 'production_company'),
      ('editor', 'writer'),
      ('translator', 'writer')
    ) AS values_map(source_slug, target_slug)
  LOOP
    INSERT INTO "contributions" ("title_id", "entity_id", "role_id", "position", "is_primary")
    SELECT c."title_id", c."entity_id", target."id", c."position", c."is_primary"
    FROM "contributions" c
    JOIN "roles" source ON source."id" = c."role_id"
    JOIN "roles" target ON target."slug" = mapping.target_slug
    WHERE source."slug" = mapping.source_slug
    ON CONFLICT ("title_id", "entity_id", "role_id") DO UPDATE
      SET "position" = LEAST("contributions"."position", EXCLUDED."position"),
          "is_primary" = "contributions"."is_primary" OR EXCLUDED."is_primary";

    DELETE FROM "contributions" c
    USING "roles" source
    WHERE c."role_id" = source."id" AND source."slug" = mapping.source_slug;

    DELETE FROM "roles" WHERE "slug" = mapping.source_slug;
  END LOOP;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "enforce_contribution_entity_kind"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "entities" e
    JOIN "roles" r ON r."id" = NEW."role_id"
    WHERE e."id" = NEW."entity_id" AND e."kind" = r."entity_kind"
  ) THEN
    RAISE EXCEPTION 'Contribution role and entity type must match';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "contributions_entity_kind_check"
BEFORE INSERT OR UPDATE OF "entity_id", "role_id" ON "contributions"
FOR EACH ROW EXECUTE FUNCTION "enforce_contribution_entity_kind"();
