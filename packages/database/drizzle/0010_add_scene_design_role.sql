ALTER TABLE "roles" DROP CONSTRAINT "roles_typed_slug_check";
--> statement-breakpoint
INSERT INTO "roles" ("slug", "label_en", "label_ar", "position", "entity_kind")
VALUES ('scene_design', 'Scene design', 'تصميم المشاهد', 9, 'person')
ON CONFLICT ("slug") DO UPDATE SET
  "label_en" = EXCLUDED."label_en",
  "label_ar" = EXCLUDED."label_ar",
  "position" = EXCLUDED."position",
  "entity_kind" = EXCLUDED."entity_kind";
--> statement-breakpoint
UPDATE "roles" SET "position" = "position" + 1 WHERE "position" >= 9 AND "slug" <> 'scene_design';
--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_typed_slug_check"
CHECK ("slug" IN (
  'creator', 'original_author', 'director', 'writer', 'producer',
  'executive_producer', 'creative_producer', 'character_designer',
  'art_director', 'scene_design', 'composer', 'animation_studio',
  'production_company', 'distributor', 'publisher'
));
