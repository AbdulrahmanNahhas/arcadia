PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP TRIGGER IF EXISTS `works_fts_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `works_fts_delete`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `works_fts_update`;--> statement-breakpoint
DROP TABLE IF EXISTS `works_fts`;--> statement-breakpoint
CREATE TABLE `work_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`season_id` text,
	`unit_id` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`progress` real DEFAULT 0 NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`season_id`) REFERENCES `work_seasons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unit_id`) REFERENCES `work_units`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "work_progress_target_check" CHECK(("work_progress"."season_id" is not null and "work_progress"."unit_id" is null)
        or ("work_progress"."season_id" is null and "work_progress"."unit_id" is not null)),
	CONSTRAINT "work_progress_status_check" CHECK("work_progress"."status" in ('planned', 'in-progress', 'completed', 'paused', 'dropped')),
	CONSTRAINT "work_progress_value_check" CHECK("work_progress"."progress" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_progress_season_uq` ON `work_progress` (`season_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `work_progress_unit_uq` ON `work_progress` (`unit_id`);--> statement-breakpoint
CREATE INDEX `work_progress_work_idx` ON `work_progress` (`work_id`);--> statement-breakpoint
CREATE TABLE `work_seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`title` text NOT NULL,
	`season_number` real,
	`position` integer NOT NULL,
	`runtime_minutes` integer,
	`unit_count` integer,
	`release_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "work_seasons_values_check" CHECK("work_seasons"."position" >= 0
        and ("work_seasons"."runtime_minutes" is null or "work_seasons"."runtime_minutes" >= 0)
        and ("work_seasons"."unit_count" is null or "work_seasons"."unit_count" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_seasons_position_uq` ON `work_seasons` (`work_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `work_seasons_title_uq` ON `work_seasons` (`work_id`,`title`);--> statement-breakpoint
CREATE INDEX `work_seasons_work_idx` ON `work_seasons` (`work_id`);--> statement-breakpoint
CREATE TABLE `work_units` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`season_id` text,
	`unit_type` text NOT NULL,
	`title` text,
	`unit_number` real,
	`position` integer NOT NULL,
	`runtime_minutes` integer,
	`page_count` integer,
	`release_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`season_id`) REFERENCES `work_seasons`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "work_units_type_check" CHECK("work_units"."unit_type" in ('episode', 'chapter', 'volume')),
	CONSTRAINT "work_units_values_check" CHECK("work_units"."position" >= 0
        and ("work_units"."runtime_minutes" is null or "work_units"."runtime_minutes" >= 0)
        and ("work_units"."page_count" is null or "work_units"."page_count" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_units_season_position_uq` ON `work_units` (`work_id`,`season_id`,`position`);--> statement-breakpoint
CREATE INDEX `work_units_work_idx` ON `work_units` (`work_id`);--> statement-breakpoint
CREATE INDEX `work_units_season_idx` ON `work_units` (`season_id`);--> statement-breakpoint
CREATE TABLE `__new_external_links` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	`provider` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`url` text NOT NULL,
	`external_id` text,
	CONSTRAINT "external_links_owner_type_check" CHECK("__new_external_links"."owner_type" = 'work')
);
--> statement-breakpoint
INSERT INTO `__new_external_links`("id", "owner_type", "owner_id", "provider", "label", "url", "external_id")
SELECT "id", "owner_type", "owner_id", "provider",
	coalesce(json_extract("metadata", '$.label'), "provider"), "url", "external_id"
FROM `external_links`
WHERE "owner_type" = 'work';--> statement-breakpoint
DROP TABLE `external_links`;--> statement-breakpoint
ALTER TABLE `__new_external_links` RENAME TO `external_links`;--> statement-breakpoint
CREATE UNIQUE INDEX `external_links_provider_uq` ON `external_links` (`owner_type`,`owner_id`,`provider`,`url`);--> statement-breakpoint
CREATE INDEX `external_links_owner_idx` ON `external_links` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE TABLE `__new_history_events` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`season_id` text,
	`unit_id` text,
	`event_type` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`progress_before` real,
	`progress_after` real,
	`rating_value` real,
	`duration_minutes` integer,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`season_id`) REFERENCES `work_seasons`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`unit_id`) REFERENCES `work_units`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "history_events_type_check" CHECK("__new_history_events"."event_type" in (
        'started', 'progress_updated', 'season_completed', 'work_completed',
        'dropped', 'rewatched', 'reread', 'rated'
      )),
	CONSTRAINT "history_events_values_check" CHECK(("__new_history_events"."progress_before" is null or "__new_history_events"."progress_before" >= 0)
        and ("__new_history_events"."progress_after" is null or "__new_history_events"."progress_after" >= 0)
        and ("__new_history_events"."rating_value" is null or ("__new_history_events"."rating_value" >= 0 and "__new_history_events"."rating_value" <= 10))
        and ("__new_history_events"."duration_minutes" is null or "__new_history_events"."duration_minutes" >= 0)
        and not ("__new_history_events"."season_id" is not null and "__new_history_events"."unit_id" is not null))
);
--> statement-breakpoint
INSERT INTO `__new_history_events`("id", "work_id", "season_id", "unit_id", "event_type", "occurred_at", "progress_before", "progress_after", "rating_value", "duration_minutes", "notes")
SELECT "id", "work_id", null, null, "event_type", "occurred_at",
	"progress_before", "progress_after", null, "duration_minutes", "notes"
FROM `history_events`
WHERE "event_type" in (
	'started', 'progress_updated', 'season_completed', 'work_completed',
	'dropped', 'rewatched', 'reread', 'rated'
);--> statement-breakpoint
DROP TABLE `history_events`;--> statement-breakpoint
ALTER TABLE `__new_history_events` RENAME TO `history_events`;--> statement-breakpoint
CREATE INDEX `history_events_work_date_idx` ON `history_events` (`work_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `history_events_date_idx` ON `history_events` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `history_events_season_idx` ON `history_events` (`season_id`);--> statement-breakpoint
CREATE INDEX `history_events_unit_idx` ON `history_events` (`unit_id`);--> statement-breakpoint
CREATE TABLE `__new_saved_views` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`layout` text DEFAULT 'gallery' NOT NULL,
	`filter_tree` text NOT NULL,
	`sort_field` text DEFAULT 'title' NOT NULL,
	`sort_direction` text DEFAULT 'asc' NOT NULL,
	`group_by` text,
	`visible_columns` text DEFAULT '[]' NOT NULL,
	`card_size` integer DEFAULT 3 NOT NULL,
	`search` text DEFAULT '' NOT NULL,
	`display` text DEFAULT '{}' NOT NULL,
	`is_pinned` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "saved_views_layout_check" CHECK("__new_saved_views"."layout" in ('gallery', 'table', 'timeline', 'statistics')),
	CONSTRAINT "saved_views_sort_direction_check" CHECK("__new_saved_views"."sort_direction" in ('asc', 'desc')),
	CONSTRAINT "saved_views_card_size_check" CHECK("__new_saved_views"."card_size" >= 1 and "__new_saved_views"."card_size" <= 300)
);
--> statement-breakpoint
INSERT INTO `__new_saved_views`("id", "name", "layout", "filter_tree", "sort_field", "sort_direction", "group_by", "visible_columns", "card_size", "search", "display", "is_pinned", "created_at", "updated_at")
SELECT "id", "name", "layout", "filter_tree",
	coalesce(json_extract("sort", '$[0].field'), 'title'),
	coalesce(json_extract("sort", '$[0].direction'), 'asc'),
	"group_by", "visible_columns", "card_size", "search", "display",
	"is_pinned", "created_at", "updated_at"
FROM `saved_views`
WHERE "layout" in ('gallery', 'table', 'timeline', 'statistics');--> statement-breakpoint
DROP TABLE `saved_views`;--> statement-breakpoint
ALTER TABLE `__new_saved_views` RENAME TO `saved_views`;--> statement-breakpoint
CREATE UNIQUE INDEX `saved_views_name_uq` ON `saved_views` (`name`);--> statement-breakpoint
CREATE INDEX `saved_views_pinned_idx` ON `saved_views` (`is_pinned`);--> statement-breakpoint
ALTER TABLE `works` ADD `page_count` integer;--> statement-breakpoint
ALTER TABLE `works` ADD `primary_platform` text;--> statement-breakpoint
UPDATE `works`
SET `metadata` = json_remove(
	`metadata`,
	'$.aliases', '$.externalLinks', '$.genres', '$.tags', '$.tone',
	'$.studios', '$.creator'
);--> statement-breakpoint
CREATE TRIGGER `works_validate_insert`
BEFORE INSERT ON `works`
WHEN NEW.kind NOT IN ('movie', 'series', 'anime', 'manga', 'novel', 'game', 'visual-novel', 'comic')
	OR NEW.status NOT IN ('announced', 'releasing', 'released', 'ended', 'unknown')
	OR coalesce(NEW.runtime_minutes, 0) < 0
	OR coalesce(NEW.page_count, 0) < 0
	OR coalesce(NEW.episode_count, 0) < 0
	OR coalesce(NEW.chapter_count, 0) < 0
	OR json_type(NEW.metadata, '$.aliases') IS NOT NULL
	OR json_type(NEW.metadata, '$.externalLinks') IS NOT NULL
	OR json_type(NEW.metadata, '$.genres') IS NOT NULL
	OR json_type(NEW.metadata, '$.tags') IS NOT NULL
	OR json_type(NEW.metadata, '$.tone') IS NOT NULL
	OR json_type(NEW.metadata, '$.studios') IS NOT NULL
	OR json_type(NEW.metadata, '$.creator') IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'invalid work enum or metric');
END;--> statement-breakpoint
CREATE TRIGGER `works_validate_update`
BEFORE UPDATE ON `works`
WHEN NEW.kind NOT IN ('movie', 'series', 'anime', 'manga', 'novel', 'game', 'visual-novel', 'comic')
	OR NEW.status NOT IN ('announced', 'releasing', 'released', 'ended', 'unknown')
	OR coalesce(NEW.runtime_minutes, 0) < 0
	OR coalesce(NEW.page_count, 0) < 0
	OR coalesce(NEW.episode_count, 0) < 0
	OR coalesce(NEW.chapter_count, 0) < 0
	OR json_type(NEW.metadata, '$.aliases') IS NOT NULL
	OR json_type(NEW.metadata, '$.externalLinks') IS NOT NULL
	OR json_type(NEW.metadata, '$.genres') IS NOT NULL
	OR json_type(NEW.metadata, '$.tags') IS NOT NULL
	OR json_type(NEW.metadata, '$.tone') IS NOT NULL
	OR json_type(NEW.metadata, '$.studios') IS NOT NULL
	OR json_type(NEW.metadata, '$.creator') IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'invalid work enum or metric');
END;--> statement-breakpoint
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
	CONSTRAINT "assets_owner_type_check" CHECK("__new_assets"."owner_type" = 'work'),
	CONSTRAINT "assets_type_check" CHECK("__new_assets"."asset_type" in ('poster', 'banner', 'logo'))
);
--> statement-breakpoint
INSERT INTO `__new_assets`("id", "owner_type", "owner_id", "asset_type", "relative_path", "mime_type", "width", "height", "blurhash", "checksum", "metadata", "created_at", "updated_at") SELECT "id", "owner_type", "owner_id", "asset_type", "relative_path", "mime_type", "width", "height", "blurhash", "checksum", "metadata", "created_at", "updated_at" FROM `assets`;--> statement-breakpoint
DROP TABLE `assets`;--> statement-breakpoint
ALTER TABLE `__new_assets` RENAME TO `assets`;--> statement-breakpoint
CREATE UNIQUE INDEX `assets_owner_type_uq` ON `assets` (`owner_type`,`owner_id`,`asset_type`);--> statement-breakpoint
CREATE INDEX `assets_owner_idx` ON `assets` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE INDEX `assets_type_idx` ON `assets` (`asset_type`);--> statement-breakpoint
UPDATE `entities`
SET `entity_type` = case
	when `entity_type` = 'producer' then 'organization'
	when `entity_type` = 'character' then 'person'
	else `entity_type`
end;--> statement-breakpoint
CREATE UNIQUE INDEX `entities_type_sort_name_uq` ON `entities` (`entity_type`,`sort_name`);--> statement-breakpoint
CREATE TRIGGER `entities_validate_insert`
BEFORE INSERT ON `entities`
WHEN NEW.entity_type NOT IN ('person', 'studio', 'publisher', 'organization')
BEGIN
	SELECT RAISE(ABORT, 'invalid entity type');
END;--> statement-breakpoint
CREATE TRIGGER `entities_validate_update`
BEFORE UPDATE ON `entities`
WHEN NEW.entity_type NOT IN ('person', 'studio', 'publisher', 'organization')
BEGIN
	SELECT RAISE(ABORT, 'invalid entity type');
END;--> statement-breakpoint
CREATE TABLE `__new_work_titles` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`title` text NOT NULL,
	`title_type` text DEFAULT 'alias' NOT NULL,
	`language` text,
	`script` text,
	`is_preferred` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "work_titles_type_check" CHECK("__new_work_titles"."title_type" in ('canonical', 'alias', 'localized', 'original'))
);
--> statement-breakpoint
INSERT INTO `__new_work_titles`("id", "work_id", "title", "title_type", "language", "script", "is_preferred") SELECT "id", "work_id", "title", "title_type", "language", "script", "is_preferred" FROM `work_titles`;--> statement-breakpoint
DROP TABLE `work_titles`;--> statement-breakpoint
ALTER TABLE `__new_work_titles` RENAME TO `work_titles`;--> statement-breakpoint
CREATE UNIQUE INDEX `work_titles_identity_uq` ON `work_titles` (`work_id`,`title`,`title_type`,`language`);--> statement-breakpoint
CREATE INDEX `work_titles_work_idx` ON `work_titles` (`work_id`);--> statement-breakpoint
CREATE TABLE `__new_personal_state` (
	`work_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`rating` real,
	`favorite` integer DEFAULT false NOT NULL,
	`owned` integer DEFAULT false NOT NULL,
	`wishlist` integer DEFAULT false NOT NULL,
	`progress` real DEFAULT 0 NOT NULL,
	`progress_total` real,
	`progress_unit` text DEFAULT 'unit' NOT NULL,
	`completed_at` integer,
	`replay_count` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`private_metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "personal_state_status_check" CHECK("__new_personal_state"."status" in ('planned', 'in-progress', 'completed', 'paused', 'dropped')),
	CONSTRAINT "personal_state_values_check" CHECK("__new_personal_state"."progress" >= 0
        and ("__new_personal_state"."progress_total" is null or "__new_personal_state"."progress_total" >= 0)
        and ("__new_personal_state"."rating" is null or ("__new_personal_state"."rating" >= 0 and "__new_personal_state"."rating" <= 10))
        and "__new_personal_state"."replay_count" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_personal_state`("work_id", "status", "rating", "favorite", "owned", "wishlist", "progress", "progress_total", "progress_unit", "completed_at", "replay_count", "notes", "private_metadata", "created_at", "updated_at") SELECT "work_id", "status", "rating", "favorite", "owned", "wishlist", "progress", "progress_total", "progress_unit", "completed_at", "replay_count", "notes", "private_metadata", "created_at", "updated_at" FROM `personal_state`;--> statement-breakpoint
DROP TABLE `personal_state`;--> statement-breakpoint
ALTER TABLE `__new_personal_state` RENAME TO `personal_state`;--> statement-breakpoint
CREATE INDEX `personal_state_status_idx` ON `personal_state` (`status`);--> statement-breakpoint
INSERT OR IGNORE INTO `terms` (`id`, `vocabulary`, `name`, `slug`, `description`) VALUES
	('controlled-genre-action', 'genre', 'Action', 'action', ''),
	('controlled-genre-adventure', 'genre', 'Adventure', 'adventure', ''),
	('controlled-genre-comedy', 'genre', 'Comedy', 'comedy', ''),
	('controlled-genre-drama', 'genre', 'Drama', 'drama', ''),
	('controlled-genre-fantasy', 'genre', 'Fantasy', 'fantasy', ''),
	('controlled-genre-historical', 'genre', 'Historical', 'historical', ''),
	('controlled-genre-horror', 'genre', 'Horror', 'horror', ''),
	('controlled-genre-mecha', 'genre', 'Mecha', 'mecha', ''),
	('controlled-genre-military', 'genre', 'Military', 'military', ''),
	('controlled-genre-music', 'genre', 'Music', 'music', ''),
	('controlled-genre-mystery', 'genre', 'Mystery', 'mystery', ''),
	('controlled-genre-political', 'genre', 'Political', 'political', ''),
	('controlled-genre-psychological', 'genre', 'Psychological', 'psychological', ''),
	('controlled-genre-romance', 'genre', 'Romance', 'romance', ''),
	('controlled-genre-sci-fi', 'genre', 'Sci-Fi', 'sci-fi', ''),
	('controlled-genre-slice-of-life', 'genre', 'Slice of Life', 'slice-of-life', ''),
	('controlled-genre-sports', 'genre', 'Sports', 'sports', ''),
	('controlled-genre-supernatural', 'genre', 'Supernatural', 'supernatural', ''),
	('controlled-genre-thriller', 'genre', 'Thriller', 'thriller', ''),
	('controlled-tone-wholesome', 'tone', 'Wholesome', 'wholesome', ''),
	('controlled-tone-emotional', 'tone', 'Emotional', 'emotional', ''),
	('controlled-tone-bittersweet', 'tone', 'Bittersweet', 'bittersweet', ''),
	('controlled-tone-reflective', 'tone', 'Reflective', 'reflective', ''),
	('controlled-tone-tense', 'tone', 'Tense', 'tense', ''),
	('controlled-tone-energetic', 'tone', 'Hype / Energetic', 'hype-energetic', ''),
	('controlled-tone-dark', 'tone', 'Dark', 'dark', ''),
	('controlled-tone-surreal', 'tone', 'Surreal / Whimsical', 'surreal-whimsical', ''),
	('controlled-tone-epic', 'tone', 'Epic', 'epic', ''),
	('controlled-tone-atmospheric', 'tone', 'Atmospheric', 'atmospheric', '');--> statement-breakpoint
INSERT OR IGNORE INTO `terms` (`id`, `vocabulary`, `name`, `slug`, `description`)
SELECT 'legacy-classification-' || "id", 'tag', "name",
	'legacy-classification-' || "slug", 'Preserved from the pre-controlled taxonomy.'
FROM `terms`
WHERE (
	"vocabulary" = 'genre'
	AND "name" NOT IN (
		'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Historical',
		'Horror', 'Mecha', 'Military', 'Music', 'Mystery', 'Political',
		'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
		'Supernatural', 'Thriller'
	)
) OR (
	"vocabulary" = 'tone'
	AND "name" NOT IN (
		'Wholesome', 'Emotional', 'Bittersweet', 'Reflective', 'Tense',
		'Hype / Energetic', 'Dark', 'Surreal / Whimsical', 'Epic', 'Atmospheric'
	)
);--> statement-breakpoint
INSERT OR IGNORE INTO `work_terms` (`work_id`, `term_id`, `weight`, `source`)
SELECT wt."work_id", 'legacy-classification-' || t."id", wt."weight", 'migration'
FROM `work_terms` wt
JOIN `terms` t ON t."id" = wt."term_id"
WHERE t."vocabulary" in ('genre', 'tone')
	AND t."id" NOT LIKE 'controlled-%'
	AND (
		(t."vocabulary" = 'genre' AND t."name" NOT IN (
			'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Historical',
			'Horror', 'Mecha', 'Military', 'Music', 'Mystery', 'Political',
			'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
			'Supernatural', 'Thriller'
		))
		OR
		(t."vocabulary" = 'tone' AND t."name" NOT IN (
			'Wholesome', 'Emotional', 'Bittersweet', 'Reflective', 'Tense',
			'Hype / Energetic', 'Dark', 'Surreal / Whimsical', 'Epic', 'Atmospheric'
		))
	);--> statement-breakpoint
INSERT OR IGNORE INTO `work_terms` (`work_id`, `term_id`, `weight`, `source`)
SELECT wt."work_id", target."id", wt."weight", 'migration'
FROM `work_terms` wt
JOIN `terms` legacy ON legacy."id" = wt."term_id" AND legacy."vocabulary" = 'tone'
JOIN `terms` target ON target."vocabulary" = 'tone' AND target."name" =
	CASE
		WHEN lower(legacy."name") GLOB '*wholesome*'
			OR lower(legacy."name") GLOB '*gentle*'
			OR lower(legacy."name") GLOB '*warm*'
			OR lower(legacy."name") GLOB '*heartwarming*'
			OR lower(legacy."name") GLOB '*lighthearted*' THEN 'Wholesome'
		WHEN lower(legacy."name") GLOB '*bittersweet*'
			OR lower(legacy."name") GLOB '*melanchol*' THEN 'Bittersweet'
		WHEN lower(legacy."name") GLOB '*reflect*'
			OR lower(legacy."name") GLOB '*philosoph*'
			OR lower(legacy."name") GLOB '*introspect*'
			OR lower(legacy."name") GLOB '*thoughtful*' THEN 'Reflective'
		WHEN lower(legacy."name") GLOB '*tense*'
			OR lower(legacy."name") GLOB '*suspens*'
			OR lower(legacy."name") GLOB '*high-stakes*' THEN 'Tense'
		WHEN lower(legacy."name") GLOB '*energetic*'
			OR lower(legacy."name") GLOB '*intense*'
			OR lower(legacy."name") GLOB '*fast-paced*'
			OR lower(legacy."name") GLOB '*thrill*'
			OR lower(legacy."name") GLOB '*adventurous*'
			OR lower(legacy."name") GLOB '*triumphant*' THEN 'Hype / Energetic'
		WHEN lower(legacy."name") GLOB '*dark*'
			OR lower(legacy."name") GLOB '*bleak*'
			OR lower(legacy."name") GLOB '*gritty*' THEN 'Dark'
		WHEN lower(legacy."name") GLOB '*surreal*'
			OR lower(legacy."name") GLOB '*whimsical*'
			OR lower(legacy."name") GLOB '*dreamlike*'
			OR lower(legacy."name") GLOB '*eccentric*' THEN 'Surreal / Whimsical'
		WHEN lower(legacy."name") GLOB '*epic*'
			OR lower(legacy."name") GLOB '*grand*' THEN 'Epic'
		WHEN lower(legacy."name") GLOB '*atmospheric*'
			OR lower(legacy."name") GLOB '*moody*'
			OR lower(legacy."name") GLOB '*immersive*' THEN 'Atmospheric'
		WHEN lower(legacy."name") GLOB '*emotion*'
			OR lower(legacy."name") GLOB '*moving*'
			OR lower(legacy."name") GLOB '*poignant*'
			OR lower(legacy."name") GLOB '*dramatic*'
			OR lower(legacy."name") GLOB '*earnest*' THEN 'Emotional'
	END
WHERE target."name" IS NOT NULL;--> statement-breakpoint
DELETE FROM `terms`
WHERE (`vocabulary` = 'genre' AND `name` NOT IN (
	'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Historical',
	'Horror', 'Mecha', 'Military', 'Music', 'Mystery', 'Political',
	'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
	'Supernatural', 'Thriller'
))
OR (`vocabulary` = 'tone' AND `name` NOT IN (
	'Wholesome', 'Emotional', 'Bittersweet', 'Reflective', 'Tense',
	'Hype / Energetic', 'Dark', 'Surreal / Whimsical', 'Epic', 'Atmospheric'
));--> statement-breakpoint
CREATE TRIGGER `terms_validate_insert`
BEFORE INSERT ON `terms`
WHEN NEW.vocabulary NOT IN ('genre', 'tone', 'tag', 'audience', 'country', 'era')
	OR (
		NEW.vocabulary = 'genre' AND NEW.name NOT IN (
			'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Historical',
			'Horror', 'Mecha', 'Military', 'Music', 'Mystery', 'Political',
			'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
			'Supernatural', 'Thriller'
		)
	)
	OR (
		NEW.vocabulary = 'tone' AND NEW.name NOT IN (
			'Wholesome', 'Emotional', 'Bittersweet', 'Reflective', 'Tense',
			'Hype / Energetic', 'Dark', 'Surreal / Whimsical', 'Epic', 'Atmospheric'
		)
	)
BEGIN
	SELECT RAISE(ABORT, 'invalid controlled taxonomy term');
END;--> statement-breakpoint
CREATE TRIGGER `terms_validate_update`
BEFORE UPDATE ON `terms`
WHEN NEW.vocabulary NOT IN ('genre', 'tone', 'tag', 'audience', 'country', 'era')
	OR (
		NEW.vocabulary = 'genre' AND NEW.name NOT IN (
			'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Historical',
			'Horror', 'Mecha', 'Military', 'Music', 'Mystery', 'Political',
			'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
			'Supernatural', 'Thriller'
		)
	)
	OR (
		NEW.vocabulary = 'tone' AND NEW.name NOT IN (
			'Wholesome', 'Emotional', 'Bittersweet', 'Reflective', 'Tense',
			'Hype / Energetic', 'Dark', 'Surreal / Whimsical', 'Epic', 'Atmospheric'
		)
	)
BEGIN
	SELECT RAISE(ABORT, 'invalid controlled taxonomy term');
END;--> statement-breakpoint
CREATE TABLE `__new_work_credits` (
	`work_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`role` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`work_id`, `entity_id`, `role`),
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "work_credits_role_check" CHECK("__new_work_credits"."role" in ('author', 'director', 'main-studio', 'publisher', 'creator'))
);
--> statement-breakpoint
INSERT OR IGNORE INTO `__new_work_credits`("work_id", "entity_id", "role", "position")
SELECT "work_id", "entity_id",
	case
		when "role" = 'animation-studio' then 'main-studio'
		when "role" in ('author', 'original-author', 'writer', 'writer-artist', 'artist') then 'author'
		else 'creator'
	end,
	"position"
FROM `work_credits`
WHERE "role" in (
	'animation-studio', 'author', 'original-author', 'writer',
	'writer-artist', 'artist', 'adaptation', 'director', 'publisher', 'creator'
);--> statement-breakpoint
DROP TABLE `work_credits`;--> statement-breakpoint
ALTER TABLE `__new_work_credits` RENAME TO `work_credits`;--> statement-breakpoint
CREATE INDEX `work_credits_entity_idx` ON `work_credits` (`entity_id`);
--> statement-breakpoint
CREATE VIRTUAL TABLE `works_fts` USING fts5(
  `canonical_title`,
  `summary`,
  content=`works`,
  content_rowid=`rowid`,
  tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `works_fts_insert` AFTER INSERT ON `works` BEGIN
  INSERT INTO `works_fts`(rowid, canonical_title, summary)
  VALUES (new.rowid, new.canonical_title, new.summary);
END;
--> statement-breakpoint
CREATE TRIGGER `works_fts_delete` AFTER DELETE ON `works` BEGIN
  INSERT INTO `works_fts`(`works_fts`, rowid, canonical_title, summary)
  VALUES ('delete', old.rowid, old.canonical_title, old.summary);
END;
--> statement-breakpoint
CREATE TRIGGER `works_fts_update` AFTER UPDATE ON `works` BEGIN
  INSERT INTO `works_fts`(`works_fts`, rowid, canonical_title, summary)
  VALUES ('delete', old.rowid, old.canonical_title, old.summary);
  INSERT INTO `works_fts`(rowid, canonical_title, summary)
  VALUES (new.rowid, new.canonical_title, new.summary);
END;
--> statement-breakpoint
INSERT INTO `works_fts`(`works_fts`) VALUES ('rebuild');
--> statement-breakpoint
CREATE TRIGGER `history_events_immutable_update`
BEFORE UPDATE ON `history_events`
BEGIN
  SELECT RAISE(ABORT, 'history_events is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `history_events_immutable_delete`
BEFORE DELETE ON `history_events`
BEGIN
  SELECT RAISE(ABORT, 'history_events is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `history_events_validate_season`
BEFORE INSERT ON `history_events`
WHEN NEW.season_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM work_seasons
    WHERE id = NEW.season_id AND work_id = NEW.work_id
  )
BEGIN
  SELECT RAISE(ABORT, 'season does not belong to work');
END;
--> statement-breakpoint
CREATE TRIGGER `history_events_validate_unit`
BEFORE INSERT ON `history_events`
WHEN NEW.unit_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM work_units
    WHERE id = NEW.unit_id AND work_id = NEW.work_id
  )
BEGIN
  SELECT RAISE(ABORT, 'unit does not belong to work');
END;
--> statement-breakpoint
CREATE TRIGGER `work_progress_validate_season`
BEFORE INSERT ON `work_progress`
WHEN NEW.season_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM work_seasons
    WHERE id = NEW.season_id AND work_id = NEW.work_id
  )
BEGIN
  SELECT RAISE(ABORT, 'season does not belong to work');
END;
--> statement-breakpoint
CREATE TRIGGER `work_progress_validate_unit`
BEFORE INSERT ON `work_progress`
WHEN NEW.unit_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM work_units
    WHERE id = NEW.unit_id AND work_id = NEW.work_id
  )
BEGIN
  SELECT RAISE(ABORT, 'unit does not belong to work');
END;
--> statement-breakpoint
CREATE TRIGGER `work_progress_validate_update`
BEFORE UPDATE ON `work_progress`
WHEN (
	NEW.season_id IS NOT NULL
	AND NOT EXISTS (
		SELECT 1 FROM work_seasons
		WHERE id = NEW.season_id AND work_id = NEW.work_id
	)
) OR (
	NEW.unit_id IS NOT NULL
	AND NOT EXISTS (
		SELECT 1 FROM work_units
		WHERE id = NEW.unit_id AND work_id = NEW.work_id
	)
)
BEGIN
  SELECT RAISE(ABORT, 'progress target does not belong to work');
END;
--> statement-breakpoint
CREATE TRIGGER `work_units_validate_season`
BEFORE INSERT ON `work_units`
WHEN NEW.season_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM work_seasons
    WHERE id = NEW.season_id AND work_id = NEW.work_id
  )
BEGIN
  SELECT RAISE(ABORT, 'season does not belong to work');
END;
--> statement-breakpoint
CREATE TRIGGER `work_units_validate_season_update`
BEFORE UPDATE ON `work_units`
WHEN NEW.season_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM work_seasons
    WHERE id = NEW.season_id AND work_id = NEW.work_id
  )
BEGIN
  SELECT RAISE(ABORT, 'season does not belong to work');
END;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
