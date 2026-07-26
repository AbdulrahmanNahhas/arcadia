PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TEMP TABLE `__terms_work_terms_backup` AS
SELECT `work_id`, `term_id`, `weight`, `source`
FROM `work_terms`;--> statement-breakpoint
CREATE TABLE `__new_terms` (
	`id` text PRIMARY KEY NOT NULL,
	`vocabulary` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`parent_id` text,
	`color` text,
	`label_ar` text,
	`description` text DEFAULT '' NOT NULL,
	`description_ar` text DEFAULT '' NOT NULL,
	CONSTRAINT "terms_vocabulary_check" CHECK("__new_terms"."vocabulary" in ('genre', 'tone', 'tag', 'audience', 'country', 'platform')),
	CONSTRAINT "terms_controlled_values_check" CHECK((
        "__new_terms"."vocabulary" <> 'genre'
        or "__new_terms"."name" in (
          'Action', 'Adventure', 'Comedy', 'Crime', 'Drama', 'Fantasy',
          'Historical', 'Horror', 'Mecha', 'Music', 'Mystery', 'Psychological',
          'Romance', 'Science Fiction', 'Slice of Life', 'Sports',
          'Supernatural', 'Thriller', 'War'
        )
      ) and (
        "__new_terms"."vocabulary" <> 'tone'
        or "__new_terms"."name" in (
          'Wholesome', 'Emotional', 'Bittersweet', 'Reflective', 'Tense',
          'Energetic', 'Dark', 'Whimsical', 'Epic', 'Atmospheric'
        )
      ) and (
        "__new_terms"."vocabulary" <> 'audience'
        or "__new_terms"."name" in ('Adult', 'Young Adult', 'Teen', 'General')
      ))
);
--> statement-breakpoint
INSERT INTO `__new_terms`("id", "vocabulary", "name", "slug", "parent_id", "color", "label_ar", "description", "description_ar")
SELECT
	"id",
	"vocabulary",
	CASE
		WHEN "vocabulary" = 'tone' AND "name" = 'Hype / Energetic' THEN 'Energetic'
		WHEN "vocabulary" = 'tone' AND "name" = 'Surreal / Whimsical' THEN 'Whimsical'
		ELSE "name"
	END,
	CASE
		WHEN "vocabulary" = 'tone' AND "name" = 'Hype / Energetic' THEN 'energetic'
		WHEN "vocabulary" = 'tone' AND "name" = 'Surreal / Whimsical' THEN 'whimsical'
		ELSE "slug"
	END,
	"parent_id",
	"color",
	CASE
		WHEN "vocabulary" = 'tone' AND "name" = 'Hype / Energetic' THEN 'حماسي'
		WHEN "vocabulary" = 'tone' AND "name" = 'Surreal / Whimsical' THEN 'خيالي مرح'
		ELSE "label_ar"
	END,
	"description",
	"description_ar"
FROM `terms`;--> statement-breakpoint
DROP TABLE `terms`;--> statement-breakpoint
ALTER TABLE `__new_terms` RENAME TO `terms`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `terms_vocabulary_slug_uq` ON `terms` (`vocabulary`,`slug`);--> statement-breakpoint
CREATE INDEX `terms_parent_idx` ON `terms` (`parent_id`);--> statement-breakpoint
INSERT OR IGNORE INTO `work_terms` (`work_id`, `term_id`, `weight`, `source`)
SELECT `work_id`, `term_id`, `weight`, `source`
FROM `__terms_work_terms_backup`;--> statement-breakpoint
DROP TABLE `__terms_work_terms_backup`;
