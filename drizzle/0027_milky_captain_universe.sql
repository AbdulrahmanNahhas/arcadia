CREATE TABLE `contribution_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text NOT NULL,
	`allowed_entity_type` text DEFAULT 'any' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	CONSTRAINT "contribution_roles_entity_type_check" CHECK("contribution_roles"."allowed_entity_type" in ('any', 'person', 'organization'))
);
--> statement-breakpoint
CREATE TABLE `entity_relationship_people` (
	`relationship_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`role` text DEFAULT 'participant' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`relationship_id`, `entity_id`, `role`),
	FOREIGN KEY (`relationship_id`) REFERENCES `entity_relationships`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entity_relationship_people_entity_idx` ON `entity_relationship_people` (`entity_id`);--> statement-breakpoint
CREATE TABLE `entity_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`source_entity_id` text NOT NULL,
	`target_entity_id` text NOT NULL,
	`relationship_type_id` text NOT NULL,
	`occurred_on` text,
	`date_precision` text DEFAULT 'unknown' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`prominence` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`source_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`relationship_type_id`) REFERENCES `organization_relationship_types`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "entity_relationships_distinct_endpoints_check" CHECK("entity_relationships"."source_entity_id" <> "entity_relationships"."target_entity_id"),
	CONSTRAINT "entity_relationships_date_precision_check" CHECK("entity_relationships"."date_precision" in ('day', 'month', 'year', 'unknown')),
	CONSTRAINT "entity_relationships_prominence_check" CHECK("entity_relationships"."prominence" >= 0 and "entity_relationships"."prominence" <= 3)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entity_relationships_identity_uq` ON `entity_relationships` (`source_entity_id`,`target_entity_id`,`relationship_type_id`,`occurred_on`);--> statement-breakpoint
CREATE INDEX `entity_relationships_source_idx` ON `entity_relationships` (`source_entity_id`);--> statement-breakpoint
CREATE INDEX `entity_relationships_target_idx` ON `entity_relationships` (`target_entity_id`);--> statement-breakpoint
CREATE INDEX `entity_relationships_date_idx` ON `entity_relationships` (`occurred_on`);--> statement-breakpoint
CREATE TABLE `organization_profiles` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`native_name` text,
	`organization_type` text DEFAULT 'studio' NOT NULL,
	`founded_on` text,
	`closed_on` text,
	`country_term_id` text,
	`prominence` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`country_term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "organization_profiles_prominence_check" CHECK("organization_profiles"."prominence" >= 0 and "organization_profiles"."prominence" <= 3)
);
--> statement-breakpoint
CREATE INDEX `organization_profiles_type_idx` ON `organization_profiles` (`organization_type`);--> statement-breakpoint
CREATE INDEX `organization_profiles_country_idx` ON `organization_profiles` (`country_term_id`);--> statement-breakpoint
CREATE TABLE `organization_relationship_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text,
	`inverse_name_ar` text,
	`category` text NOT NULL,
	`is_directed` integer DEFAULT true NOT NULL,
	`allows_cycles` integer DEFAULT false NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	CONSTRAINT "organization_relationship_types_category_check" CHECK("organization_relationship_types"."category" in ('corporate', 'historical', 'creative'))
);
--> statement-breakpoint
CREATE TABLE `person_profiles` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`native_name` text,
	`born_on` text,
	`died_on` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `person_profiles_dates_idx` ON `person_profiles` (`born_on`,`died_on`);--> statement-breakpoint
CREATE TABLE `planets` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text,
	`icon` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`primary_color` text NOT NULL,
	`secondary_color` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`classification_hints` text DEFAULT '{}' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `planets_slug_uq` ON `planets` (`slug`);--> statement-breakpoint
CREATE INDEX `planets_order_idx` ON `planets` (`is_active`,`display_order`);--> statement-breakpoint
CREATE TABLE `risk_dimensions` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text,
	`description` text DEFAULT '' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `risk_dimensions_slug_uq` ON `risk_dimensions` (`slug`);--> statement-breakpoint
CREATE TABLE `search_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`primary_text` text NOT NULL,
	`secondary_text` text DEFAULT '' NOT NULL,
	`keywords` text DEFAULT '' NOT NULL,
	`image_path` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "search_documents_entity_type_check" CHECK("search_documents"."entity_type" in ('work', 'person', 'studio', 'planet'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_documents_entity_uq` ON `search_documents` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `search_documents_type_idx` ON `search_documents` (`entity_type`);--> statement-breakpoint
CREATE TABLE `work_planet_assignments` (
	`work_id` text PRIMARY KEY NOT NULL,
	`planet_id` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`confidence` real,
	`review_state` text DEFAULT 'reviewed' NOT NULL,
	`featured_rank` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`planet_id`) REFERENCES `planets`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "work_planet_assignments_source_check" CHECK("work_planet_assignments"."source" in ('migration-default', 'suggested', 'manual')),
	CONSTRAINT "work_planet_assignments_review_check" CHECK("work_planet_assignments"."review_state" in ('needs-review', 'reviewed')),
	CONSTRAINT "work_planet_assignments_confidence_check" CHECK("work_planet_assignments"."confidence" is null or ("work_planet_assignments"."confidence" >= 0 and "work_planet_assignments"."confidence" <= 1))
);
--> statement-breakpoint
CREATE INDEX `work_planet_assignments_planet_idx` ON `work_planet_assignments` (`planet_id`);--> statement-breakpoint
CREATE INDEX `work_planet_assignments_review_idx` ON `work_planet_assignments` (`review_state`);--> statement-breakpoint
CREATE TABLE `work_risk_assessments` (
	`work_id` text NOT NULL,
	`dimension_id` text NOT NULL,
	`level` text NOT NULL,
	`explanation` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`work_id`, `dimension_id`),
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dimension_id`) REFERENCES `risk_dimensions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "work_risk_assessments_level_check" CHECK("work_risk_assessments"."level" in ('none', 'low', 'medium', 'high'))
);
--> statement-breakpoint
CREATE INDEX `work_risk_assessments_dimension_idx` ON `work_risk_assessments` (`dimension_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_type` text DEFAULT 'work' NOT NULL,
	`owner_id` text NOT NULL,
	`asset_type` text NOT NULL,
	`relative_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`width` integer,
	`height` integer,
	`blurhash` text,
	`checksum` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "assets_owner_type_check" CHECK("__new_assets"."owner_type" in ('work', 'entity', 'planet')),
	CONSTRAINT "assets_type_check" CHECK("__new_assets"."asset_type" in ('poster', 'banner', 'logo', 'profile'))
);
--> statement-breakpoint
INSERT INTO `__new_assets`("id", "owner_type", "owner_id", "asset_type", "relative_path", "mime_type", "width", "height", "blurhash", "checksum", "metadata", "created_at", "updated_at") SELECT "id", "owner_type", "owner_id", "asset_type", "relative_path", "mime_type", "width", "height", "blurhash", "checksum", "metadata", "created_at", "updated_at" FROM `assets`;--> statement-breakpoint
DROP TABLE `assets`;--> statement-breakpoint
ALTER TABLE `__new_assets` RENAME TO `assets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `assets_owner_type_uq` ON `assets` (`owner_type`,`owner_id`,`asset_type`);--> statement-breakpoint
CREATE INDEX `assets_owner_idx` ON `assets` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE INDEX `assets_type_idx` ON `assets` (`asset_type`);--> statement-breakpoint
ALTER TABLE `tracking_entries` ADD `voided_at` integer;--> statement-breakpoint
ALTER TABLE `tracking_entries` ADD `void_reason` text;--> statement-breakpoint

INSERT INTO `planets` (`id`, `slug`, `name_ar`, `name_en`, `icon`, `description`, `primary_color`, `secondary_color`, `display_order`, `classification_hints`) VALUES
  ('planet-action', 'action', 'كوكب الأكشن والقتال', 'Action & Combat', '⚔️', 'حكايات المواجهة والبطولة والصراع الحركي.', '#B85C57', '#4A2328', 10, '{"genres":["Action","War","Crime"],"tags":["Martial Arts","Military"]}'),
  ('planet-adventure', 'adventure-fantasy', 'كوكب المغامرات والخيال', 'Adventure & Fantasy', '🧭', 'رحلات إلى عوالم بعيدة وحكايات يحرّكها الاكتشاف والخيال.', '#7189E8', '#29355F', 20, '{"genres":["Adventure","Fantasy"],"tags":["Journey","Detailed Worldbuilding"]}'),
  ('planet-mystery', 'darkness-mystery', 'كوكب الظلام والغموض', 'Darkness & Mystery', '👁️', 'ألغاز وحكايات نفسية وعوالم تتكشف ببطء.', '#756A9A', '#262238', 30, '{"genres":["Mystery","Thriller","Horror","Psychological"],"tones":["Dark","Tense"]}'),
  ('planet-future', 'future-technology', 'كوكب المستقبل والتقنية', 'Future & Technology', '🤖', 'الخيال العلمي والتقنية والآلات وأسئلة المستقبل.', '#4F95A8', '#173B49', 40, '{"genres":["Science Fiction","Mecha"],"tags":["Robots","Artificial Intelligence"]}'),
  ('planet-history', 'history-knowledge', 'كوكب التاريخ والمعرفة', 'History & Knowledge', '📜', 'أعمال تستكشف التاريخ والمعرفة والسير والتحولات الحضارية.', '#B08A5C', '#493522', 50, '{"genres":["Historical"],"tags":["Educational","Biography"]}'),
  ('planet-emerald', 'emerald', 'كوكب زمردة', 'Emerald', '💎', 'حكايات وجدانية واجتماعية تركز على العلاقات والنمو الشخصي.', '#679B88', '#20483D', 60, '{"genres":["Drama","Romance","Slice of Life"],"tags":["Female Protagonist","Coming-of-Age"]}'),
  ('planet-comedy', 'comedy-fun', 'كوكب الكوميديا والمرح', 'Comedy & Fun', '😄', 'أعمال خفيفة ومرحة تقودها الكوميديا والرفقة.', '#C39A55', '#513D1D', 70, '{"genres":["Comedy"],"tones":["Wholesome","Energetic","Whimsical"]}'),
  ('planet-bonbon', 'bonbon', 'كوكب بون بون', 'Bon Bon', '🧸', 'حكايات لطيفة مناسبة للمشاهدة العائلية والسنوات الأولى.', '#C78391', '#54303A', 80, '{"audiences":["General"],"tones":["Wholesome"]}'),
  ('planet-sports', 'sports-challenge', 'كوكب الرياضة والتحدي', 'Sports & Challenge', '⚽', 'المنافسة والانضباط والعمل الجماعي وتجاوز الحدود.', '#6C9B70', '#27452B', 90, '{"genres":["Sports"],"tags":["Competition"]}');--> statement-breakpoint

INSERT INTO `risk_dimensions` (`id`, `slug`, `name_ar`, `name_en`, `description`, `display_order`) VALUES
  ('risk-sexuality', 'sexuality', 'المحتوى الجنسي', 'Sexuality', 'المشاهد أو الإشارات أو الموضوعات الجنسية.', 10),
  ('risk-behavioral', 'behavioral', 'المخاوف السلوكية', 'Behavioral concerns', 'العنف والسلوك المؤذي والمواد والآثار النفسية.', 20),
  ('risk-theology', 'theology', 'المحتوى العقدي', 'Theology', 'الأفكار والممارسات والمضامين العقدية أو الغيبية.', 30);--> statement-breakpoint

INSERT INTO `organization_relationship_types` (`id`, `name_ar`, `name_en`, `inverse_name_ar`, `category`, `is_directed`, `allows_cycles`, `display_order`) VALUES
  ('predecessor', 'سبقها', 'Predecessor', 'خلفتها', 'historical', true, false, 10),
  ('successor', 'خلفتها', 'Successor', 'سبقتها', 'historical', true, false, 20),
  ('founded-from', 'تأسست انطلاقاً من', 'Founded from', 'انبثقت عنها', 'historical', true, false, 30),
  ('spin-off', 'انفصلت عن', 'Spin-off', 'انبثقت عنها', 'historical', true, false, 40),
  ('subsidiary', 'شركة تابعة لـ', 'Subsidiary', 'شركة أم لـ', 'corporate', true, false, 50),
  ('parent', 'شركة أم لـ', 'Parent', 'شركة تابعة لـ', 'corporate', true, false, 60),
  ('merger', 'اندمجت مع', 'Merger', 'اندمجت مع', 'corporate', false, true, 70),
  ('renamed-to', 'أعيدت تسميتها إلى', 'Renamed to', 'كان اسمها', 'historical', true, false, 80),
  ('reorganized-as', 'أعيد تنظيمها بصفتها', 'Reorganized as', 'نتجت عن إعادة تنظيم', 'historical', true, false, 90),
  ('creative-lineage', 'امتداد إبداعي لـ', 'Creative lineage', 'أثرت في', 'creative', true, true, 100),
  ('other', 'صلة أخرى', 'Other', 'صلة أخرى', 'historical', false, true, 110);--> statement-breakpoint

INSERT INTO `contribution_roles` (`id`, `name_ar`, `name_en`, `allowed_entity_type`, `display_order`) VALUES
  ('author', 'مؤلف', 'Author', 'person', 10),
  ('original-author', 'صاحب العمل الأصلي', 'Original author', 'person', 20),
  ('creator', 'مبتكر', 'Creator', 'person', 30),
  ('director', 'مخرج', 'Director', 'person', 40),
  ('writer', 'كاتب', 'Writer', 'person', 50),
  ('screenwriter', 'كاتب سيناريو', 'Screenwriter', 'person', 60),
  ('illustrator', 'رسام', 'Illustrator', 'person', 70),
  ('artist', 'فنان', 'Artist', 'person', 80),
  ('composer', 'ملحن', 'Composer', 'person', 90),
  ('editor', 'محرر', 'Editor', 'person', 100),
  ('translator', 'مترجم', 'Translator', 'person', 110),
  ('producer', 'منتج', 'Producer', 'any', 120),
  ('animation-studio', 'استوديو رسوم متحركة', 'Animation studio', 'organization', 130),
  ('production-company', 'شركة إنتاج', 'Production company', 'organization', 140),
  ('developer', 'مطوّر', 'Developer', 'organization', 150),
  ('publisher', 'ناشر', 'Publisher', 'organization', 160);--> statement-breakpoint

INSERT INTO `person_profiles` (`entity_id`)
SELECT `id` FROM `entities` WHERE `entity_type` = 'person';--> statement-breakpoint

INSERT INTO `organization_profiles` (`entity_id`, `organization_type`, `prominence`)
SELECT
  e.`id`,
  CASE
    WHEN EXISTS (SELECT 1 FROM `work_contributions` wc WHERE wc.`entity_id` = e.`id` AND wc.`role` = 'animation-studio') THEN 'studio'
    WHEN EXISTS (SELECT 1 FROM `work_contributions` wc WHERE wc.`entity_id` = e.`id` AND wc.`role` = 'publisher') THEN 'publisher'
    WHEN EXISTS (SELECT 1 FROM `work_contributions` wc WHERE wc.`entity_id` = e.`id` AND wc.`role` = 'production-company') THEN 'production-company'
    ELSE 'organization'
  END,
  CASE
    WHEN (SELECT COUNT(DISTINCT wc.`work_id`) FROM `work_contributions` wc WHERE wc.`entity_id` = e.`id`) >= 10 THEN 3
    WHEN (SELECT COUNT(DISTINCT wc.`work_id`) FROM `work_contributions` wc WHERE wc.`entity_id` = e.`id`) >= 5 THEN 2
    WHEN (SELECT COUNT(DISTINCT wc.`work_id`) FROM `work_contributions` wc WHERE wc.`entity_id` = e.`id`) >= 1 THEN 1
    ELSE 0
  END
FROM `entities` e
WHERE e.`entity_type` = 'organization';--> statement-breakpoint

INSERT INTO `work_planet_assignments` (`work_id`, `planet_id`, `source`, `review_state`)
SELECT `id`, 'planet-adventure', 'migration-default', 'needs-review'
FROM `works`
WHERE `kind` IN ('movie', 'series', 'anime');--> statement-breakpoint

INSERT INTO `work_risk_assessments` (`work_id`, `dimension_id`, `level`)
SELECT `id`, 'risk-sexuality', json_extract(`metadata`, '$.riskProfile.sexuality')
FROM `works`
WHERE json_extract(`metadata`, '$.riskProfile.sexuality') IN ('none', 'low', 'medium', 'high');--> statement-breakpoint
INSERT INTO `work_risk_assessments` (`work_id`, `dimension_id`, `level`)
SELECT `id`, 'risk-behavioral', json_extract(`metadata`, '$.riskProfile.behavioral')
FROM `works`
WHERE json_extract(`metadata`, '$.riskProfile.behavioral') IN ('none', 'low', 'medium', 'high');--> statement-breakpoint
INSERT INTO `work_risk_assessments` (`work_id`, `dimension_id`, `level`)
SELECT `id`, 'risk-theology', json_extract(`metadata`, '$.riskProfile.theology')
FROM `works`
WHERE json_extract(`metadata`, '$.riskProfile.theology') IN ('none', 'low', 'medium', 'high');--> statement-breakpoint

INSERT INTO `search_documents` (`id`, `entity_type`, `entity_id`, `primary_text`, `secondary_text`, `keywords`, `image_path`)
SELECT
  'work:' || w.`id`,
  'work',
  w.`id`,
  w.`canonical_title`,
  COALESCE((SELECT group_concat(wt.`title`, ' ') FROM `work_titles` wt WHERE wt.`work_id` = w.`id`), ''),
  w.`kind` || ' ' || COALESCE(w.`summary`, ''),
  (SELECT a.`relative_path` FROM `assets` a WHERE a.`owner_type` = 'work' AND a.`owner_id` = w.`id` AND a.`asset_type` = 'poster' LIMIT 1)
FROM `works` w;--> statement-breakpoint

INSERT INTO `search_documents` (`id`, `entity_type`, `entity_id`, `primary_text`, `secondary_text`, `keywords`, `image_path`)
SELECT
  CASE WHEN e.`entity_type` = 'person' THEN 'person:' ELSE 'studio:' END || e.`id`,
  CASE WHEN e.`entity_type` = 'person' THEN 'person' ELSE 'studio' END,
  e.`id`,
  e.`name`,
  COALESCE((SELECT group_concat(ea.`alias`, ' ') FROM `entity_aliases` ea WHERE ea.`entity_id` = e.`id`), ''),
  COALESCE(e.`description`, ''),
  (SELECT a.`relative_path` FROM `assets` a WHERE a.`owner_type` = 'entity' AND a.`owner_id` = e.`id` AND a.`asset_type` = 'profile' LIMIT 1)
FROM `entities` e;--> statement-breakpoint

INSERT INTO `search_documents` (`id`, `entity_type`, `entity_id`, `primary_text`, `secondary_text`, `keywords`)
SELECT 'planet:' || `id`, 'planet', `id`, `name_ar`, COALESCE(`name_en`, ''), `description`
FROM `planets`;--> statement-breakpoint

CREATE VIRTUAL TABLE `search_documents_fts` USING fts5(
  `primary_text`,
  `secondary_text`,
  `keywords`,
  content='search_documents',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);--> statement-breakpoint
INSERT INTO `search_documents_fts`(`search_documents_fts`) VALUES ('rebuild');--> statement-breakpoint
CREATE TRIGGER `search_documents_ai` AFTER INSERT ON `search_documents` BEGIN
  INSERT INTO `search_documents_fts`(`rowid`, `primary_text`, `secondary_text`, `keywords`)
  VALUES (new.`rowid`, new.`primary_text`, new.`secondary_text`, new.`keywords`);
END;--> statement-breakpoint
CREATE TRIGGER `search_documents_ad` AFTER DELETE ON `search_documents` BEGIN
  INSERT INTO `search_documents_fts`(`search_documents_fts`, `rowid`, `primary_text`, `secondary_text`, `keywords`)
  VALUES ('delete', old.`rowid`, old.`primary_text`, old.`secondary_text`, old.`keywords`);
END;--> statement-breakpoint
CREATE TRIGGER `search_documents_au` AFTER UPDATE ON `search_documents` BEGIN
  INSERT INTO `search_documents_fts`(`search_documents_fts`, `rowid`, `primary_text`, `secondary_text`, `keywords`)
  VALUES ('delete', old.`rowid`, old.`primary_text`, old.`secondary_text`, old.`keywords`);
  INSERT INTO `search_documents_fts`(`rowid`, `primary_text`, `secondary_text`, `keywords`)
  VALUES (new.`rowid`, new.`primary_text`, new.`secondary_text`, new.`keywords`);
END;
