CREATE TABLE `personal_scores` (
	`work_id` text NOT NULL,
	`criterion` text NOT NULL,
	`value` real NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`work_id`, `criterion`),
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "personal_scores_criterion_check" CHECK("personal_scores"."criterion" in ('story', 'characters', 'depth', 'worldBuilding', 'originality', 'craft')),
	CONSTRAINT "personal_scores_value_check" CHECK("personal_scores"."value" >= 0 and "personal_scores"."value" <= 10)
);
--> statement-breakpoint
CREATE INDEX `personal_scores_work_idx` ON `personal_scores` (`work_id`);--> statement-breakpoint
INSERT INTO `personal_scores` (`work_id`, `criterion`, `value`, `updated_at`)
SELECT
	`works`.`id`,
	CASE `scores`.`key`
		WHEN 'Story' THEN 'story'
		WHEN 'Characters' THEN 'characters'
		WHEN 'Depth' THEN 'depth'
		WHEN 'World building' THEN 'worldBuilding'
		WHEN 'Originality' THEN 'originality'
		WHEN 'Visuals' THEN 'craft'
	END,
	CAST(`scores`.`value` AS real),
	unixepoch()
FROM `works`, json_each(`works`.`metadata`, '$.scoreBreakdown') AS `scores`
WHERE `scores`.`key` IN ('Story', 'Characters', 'Depth', 'World building', 'Originality', 'Visuals')
	AND CAST(`scores`.`value` AS real) BETWEEN 0 AND 10;--> statement-breakpoint
INSERT INTO `work_titles` (`id`, `work_id`, `title`, `title_type`, `language`, `script`, `is_preferred`)
SELECT
	lower(hex(randomblob(16))),
	`works`.`id`,
	trim(json_extract(`works`.`metadata`, '$.subtitle')),
	'localized',
	'ar',
	'Arab',
	true
FROM `works`
WHERE trim(coalesce(json_extract(`works`.`metadata`, '$.subtitle'), '')) <> ''
	AND json_extract(`works`.`metadata`, '$.subtitle') GLOB '*[ء-ي]*'
	AND NOT EXISTS (
		SELECT 1 FROM `work_titles`
		WHERE `work_titles`.`work_id` = `works`.`id`
			AND `work_titles`.`title_type` = 'localized'
			AND `work_titles`.`language` = 'ar'
	);--> statement-breakpoint
INSERT INTO `work_titles` (`id`, `work_id`, `title`, `title_type`, `is_preferred`)
SELECT
	lower(hex(randomblob(16))),
	`works`.`id`,
	trim(json_extract(`works`.`metadata`, '$.subtitle')),
	'alias',
	false
FROM `works`
WHERE trim(coalesce(json_extract(`works`.`metadata`, '$.subtitle'), '')) <> ''
	AND json_extract(`works`.`metadata`, '$.subtitle') NOT GLOB '*[ء-ي]*'
	AND NOT EXISTS (
		SELECT 1 FROM `work_titles`
		WHERE `work_titles`.`work_id` = `works`.`id`
			AND `work_titles`.`title` = trim(json_extract(`works`.`metadata`, '$.subtitle'))
	);--> statement-breakpoint
CREATE TABLE `term_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`term_id` text NOT NULL,
	`alias` text NOT NULL,
	`language` text,
	`normalized_alias` text NOT NULL,
	FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `term_aliases_identity_uq` ON `term_aliases` (`term_id`,`normalized_alias`);--> statement-breakpoint
CREATE INDEX `term_aliases_lookup_idx` ON `term_aliases` (`normalized_alias`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_personal_state` (
	`work_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`progress` real DEFAULT 0 NOT NULL,
	`progress_total` real,
	`progress_unit` text DEFAULT 'unit' NOT NULL,
	`completed_at` integer,
	`private_metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "personal_state_status_check" CHECK("__new_personal_state"."status" in ('planned', 'in-progress', 'completed', 'paused', 'dropped')),
	CONSTRAINT "personal_state_values_check" CHECK("__new_personal_state"."progress" >= 0
        and ("__new_personal_state"."progress_total" is null or "__new_personal_state"."progress_total" >= 0)
        )
);
--> statement-breakpoint
INSERT INTO `__new_personal_state`("work_id", "status", "favorite", "progress", "progress_total", "progress_unit", "completed_at", "private_metadata", "created_at", "updated_at") SELECT "work_id", "status", "favorite", "progress", "progress_total", "progress_unit", "completed_at", "private_metadata", "created_at", "updated_at" FROM `personal_state`;--> statement-breakpoint
DROP TABLE `personal_state`;--> statement-breakpoint
ALTER TABLE `__new_personal_state` RENAME TO `personal_state`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `personal_state_status_idx` ON `personal_state` (`status`);--> statement-breakpoint
DROP TRIGGER IF EXISTS `terms_validate_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `terms_validate_update`;--> statement-breakpoint
INSERT INTO `terms` (`id`, `vocabulary`, `name`, `slug`, `description`)
SELECT lower(hex(randomblob(16))), 'tag', `candidate`.`name`, `candidate`.`slug`, ''
FROM (
	SELECT 'Mecha' AS `name`, 'mecha' AS `slug`
	UNION ALL SELECT 'Military', 'military'
	UNION ALL SELECT 'Political', 'political'
	UNION ALL SELECT 'Psychological', 'psychological'
) AS `candidate`
WHERE NOT EXISTS (
	SELECT 1 FROM `terms`
	WHERE `terms`.`vocabulary` = 'tag' AND `terms`.`slug` = `candidate`.`slug`
);--> statement-breakpoint
UPDATE OR IGNORE `work_terms`
SET `term_id` = (
	SELECT `tag`.`id` FROM `terms` AS `tag`
	WHERE `tag`.`vocabulary` = 'tag'
		AND `tag`.`slug` = (
			SELECT `genre`.`slug` FROM `terms` AS `genre`
			WHERE `genre`.`id` = `work_terms`.`term_id`
		)
)
WHERE `term_id` IN (
	SELECT `id` FROM `terms`
	WHERE `vocabulary` = 'genre'
		AND `name` IN ('Mecha', 'Military', 'Political', 'Psychological')
);--> statement-breakpoint
DELETE FROM `work_terms`
WHERE `term_id` IN (
	SELECT `id` FROM `terms`
	WHERE `vocabulary` = 'genre'
		AND `name` IN ('Mecha', 'Military', 'Political', 'Psychological')
);--> statement-breakpoint
DELETE FROM `terms`
WHERE `vocabulary` = 'genre'
	AND `name` IN ('Mecha', 'Military', 'Political', 'Psychological');--> statement-breakpoint
UPDATE `terms`
SET `name` = 'Science Fiction', `slug` = 'science-fiction'
WHERE `vocabulary` = 'genre' AND `name` = 'Sci-Fi';--> statement-breakpoint
INSERT INTO `terms` (`id`, `vocabulary`, `name`, `slug`, `description`)
SELECT lower(hex(randomblob(16))), 'audience', 'General', 'general', ''
WHERE NOT EXISTS (
	SELECT 1 FROM `terms`
	WHERE `vocabulary` = 'audience' AND `name` = 'General'
);--> statement-breakpoint
UPDATE OR IGNORE `work_terms`
SET `term_id` = (
	SELECT `id` FROM `terms`
	WHERE `vocabulary` = 'audience' AND `name` = 'General'
)
WHERE `term_id` IN (
	SELECT `id` FROM `terms`
	WHERE `vocabulary` = 'audience' AND `name` = 'Family'
);--> statement-breakpoint
UPDATE OR IGNORE `work_terms`
SET `term_id` = (
	SELECT `id` FROM `terms`
	WHERE `vocabulary` = 'audience' AND `name` = 'Adult'
)
WHERE `term_id` IN (
	SELECT `id` FROM `terms`
	WHERE `vocabulary` = 'audience' AND `name` = 'Mature'
);--> statement-breakpoint
DELETE FROM `work_terms`
WHERE `term_id` IN (
	SELECT `id` FROM `terms`
	WHERE `vocabulary` = 'audience'
		AND `name` IN ('Family', 'Mature', 'Unknown')
);--> statement-breakpoint
DELETE FROM `terms`
WHERE `vocabulary` = 'audience'
	AND `name` IN ('Family', 'Mature', 'Unknown');--> statement-breakpoint
CREATE TEMP TABLE `taxonomy_promotions_v8` (
	`source_slug` text PRIMARY KEY,
	`target_vocabulary` text NOT NULL,
	`target_name` text NOT NULL
);--> statement-breakpoint
INSERT INTO `taxonomy_promotions_v8` VALUES
	('lighthearted', 'tone', 'Wholesome'),
	('warm', 'tone', 'Wholesome'),
	('nostalgic', 'tone', 'Reflective'),
	('energetic', 'tone', 'Hype / Energetic'),
	('fast-paced', 'tone', 'Hype / Energetic'),
	('adventurous', 'tone', 'Hype / Energetic'),
	('intense', 'tone', 'Tense'),
	('playful', 'tone', 'Surreal / Whimsical'),
	('stylish', 'tone', 'Surreal / Whimsical'),
	('mysterious', 'tone', 'Atmospheric'),
	('hopeful', 'tone', 'Wholesome'),
	('ai', 'tag', 'Artificial Intelligence'),
	('super-power', 'tag', 'Special Abilities'),
	('anti-hero', 'tag', 'Antihero'),
	('secret-identity', 'tag', 'Hidden Identity'),
	('sibling-bond', 'tag', 'Siblings'),
	('time-manipulation', 'tag', 'Time Travel');--> statement-breakpoint
UPDATE OR IGNORE `work_terms`
SET `term_id` = (
	SELECT `target`.`id`
	FROM `terms` AS `source`
	JOIN `taxonomy_promotions_v8` AS `promotion`
		ON `promotion`.`source_slug` = `source`.`slug`
	JOIN `terms` AS `target`
		ON `target`.`vocabulary` = `promotion`.`target_vocabulary`
		AND `target`.`name` = `promotion`.`target_name`
	WHERE `source`.`id` = `work_terms`.`term_id`
)
WHERE `term_id` IN (
	SELECT `source`.`id`
	FROM `terms` AS `source`
	JOIN `taxonomy_promotions_v8` AS `promotion`
		ON `promotion`.`source_slug` = `source`.`slug`
);--> statement-breakpoint
DELETE FROM `work_terms`
WHERE `term_id` IN (
	SELECT `source`.`id`
	FROM `terms` AS `source`
	JOIN `taxonomy_promotions_v8` AS `promotion`
		ON `promotion`.`source_slug` = `source`.`slug`
);--> statement-breakpoint
DELETE FROM `terms`
WHERE `id` IN (
	SELECT `source`.`id`
	FROM `terms` AS `source`
	JOIN `taxonomy_promotions_v8` AS `promotion`
		ON `promotion`.`source_slug` = `source`.`slug`
);--> statement-breakpoint
DROP TABLE `taxonomy_promotions_v8`;--> statement-breakpoint
DELETE FROM `work_terms`
WHERE `term_id` IN (
	SELECT `tag`.`id`
	FROM `terms` AS `tag`
	WHERE `tag`.`vocabulary` = 'tag'
		AND EXISTS (
			SELECT 1 FROM `terms` AS `controlled`
			WHERE `controlled`.`vocabulary` IN ('genre', 'tone')
				AND lower(`controlled`.`name`) = lower(`tag`.`name`)
		)
);--> statement-breakpoint
DELETE FROM `terms`
WHERE `vocabulary` = 'tag'
	AND EXISTS (
		SELECT 1 FROM `terms` AS `controlled`
		WHERE `controlled`.`vocabulary` IN ('genre', 'tone')
			AND lower(`controlled`.`name`) = lower(`terms`.`name`)
	);--> statement-breakpoint
DELETE FROM `work_terms`
WHERE `term_id` IN (
	SELECT `terms`.`id`
	FROM `terms`
	LEFT JOIN `work_terms` AS `usage` ON `usage`.`term_id` = `terms`.`id`
	WHERE `terms`.`vocabulary` = 'tag'
	GROUP BY `terms`.`id`
	HAVING count(`usage`.`work_id`) <= 1
		AND `terms`.`name` NOT IN (
			'Afterlife', 'Amnesia', 'Authoritarianism', 'Betrayal',
			'Censorship', 'Existentialism', 'Espionage', 'Folklore',
			'Language Barrier', 'Mental Illness', 'Mortality', 'Pacifism',
			'Racism', 'Rebellion', 'Reincarnation', 'Sacrifice', 'Samurai',
			'Social Anxiety', 'Time Loop', 'Vigilante Justice', 'Weird Fiction',
			'Youkai'
		)
);--> statement-breakpoint
DELETE FROM `terms`
WHERE `vocabulary` = 'tag'
	AND `id` NOT IN (SELECT `term_id` FROM `work_terms`);--> statement-breakpoint
DELETE FROM `work_terms`
WHERE `term_id` IN (
	SELECT `id` FROM `terms`
	WHERE `vocabulary` = 'tag'
		AND `name` IN (
			'Birds', 'Cannibalism', 'Everyday Life', 'Original Anime',
			'Pets', 'Rescue', 'Spiritual', 'Youthful'
		)
);--> statement-breakpoint
DELETE FROM `terms`
WHERE `vocabulary` = 'tag'
	AND `name` IN (
		'Birds', 'Cannibalism', 'Everyday Life', 'Original Anime',
		'Pets', 'Rescue', 'Spiritual', 'Youthful'
	);--> statement-breakpoint
DELETE FROM `work_terms`
WHERE rowid IN (
	SELECT `link_rowid`
	FROM (
		SELECT
			`work_terms`.rowid AS `link_rowid`,
			row_number() OVER (
				PARTITION BY `work_terms`.`work_id`
				ORDER BY (
					SELECT count(*)
					FROM `work_terms` AS `global_usage`
					WHERE `global_usage`.`term_id` = `work_terms`.`term_id`
				) DESC,
				`terms`.`name`
			) AS `position`
		FROM `work_terms`
		JOIN `terms` ON `terms`.`id` = `work_terms`.`term_id`
		WHERE `terms`.`vocabulary` = 'tag'
	)
	WHERE `position` > 12
);--> statement-breakpoint
DELETE FROM `terms`
WHERE `vocabulary` = 'tag'
	AND `id` NOT IN (SELECT `term_id` FROM `work_terms`);--> statement-breakpoint
DELETE FROM `work_terms`
WHERE `term_id` IN (SELECT `id` FROM `terms` WHERE `vocabulary` = 'era');--> statement-breakpoint
DELETE FROM `terms` WHERE `vocabulary` = 'era';--> statement-breakpoint
CREATE TEMP TABLE `work_terms_v8_backup` AS
SELECT `work_id`, `term_id`, `weight`, `source` FROM `work_terms`;--> statement-breakpoint
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
          'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Historical',
          'Horror', 'Music', 'Mystery', 'Romance', 'Science Fiction',
          'Slice of Life', 'Sports',
          'Supernatural', 'Thriller'
        )
      ) and (
        "__new_terms"."vocabulary" <> 'tone'
        or "__new_terms"."name" in (
          'Wholesome', 'Emotional', 'Bittersweet', 'Reflective', 'Tense',
          'Hype / Energetic', 'Dark', 'Surreal / Whimsical', 'Epic',
          'Atmospheric'
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
	"name",
	"slug",
	"parent_id",
	"color",
	CASE "name"
		WHEN 'Action' THEN 'أكشن'
		WHEN 'Adventure' THEN 'مغامرة'
		WHEN 'Comedy' THEN 'كوميديا'
		WHEN 'Drama' THEN 'دراما'
		WHEN 'Fantasy' THEN 'فانتازيا'
		WHEN 'Historical' THEN 'تاريخي'
		WHEN 'Horror' THEN 'رعب'
		WHEN 'Music' THEN 'موسيقى'
		WHEN 'Mystery' THEN 'غموض'
		WHEN 'Romance' THEN 'رومانسية'
		WHEN 'Science Fiction' THEN 'خيال علمي'
		WHEN 'Slice of Life' THEN 'شريحة من الحياة'
		WHEN 'Sports' THEN 'رياضة'
		WHEN 'Supernatural' THEN 'خوارق'
		WHEN 'Thriller' THEN 'إثارة'
		WHEN 'Wholesome' THEN 'دافئ'
		WHEN 'Emotional' THEN 'عاطفي'
		WHEN 'Bittersweet' THEN 'حلو ومر'
		WHEN 'Reflective' THEN 'تأملي'
		WHEN 'Tense' THEN 'متوتر'
		WHEN 'Hype / Energetic' THEN 'حماسي'
		WHEN 'Dark' THEN 'قاتم'
		WHEN 'Surreal / Whimsical' THEN 'سريالي / خيالي مرح'
		WHEN 'Epic' THEN 'ملحمي'
		WHEN 'Atmospheric' THEN 'غني بالأجواء'
		WHEN 'Adult' THEN 'بالغون'
		WHEN 'Young Adult' THEN 'شباب بالغون'
		WHEN 'Teen' THEN 'مراهقون'
		WHEN 'General' THEN 'عام'
		WHEN 'Male Protagonist' THEN 'بطل ذكر'
		WHEN 'Female Protagonist' THEN 'بطلة'
		WHEN 'Classic Literature' THEN 'أدب كلاسيكي'
		WHEN 'Coming-of-Age' THEN 'النضج'
		WHEN 'Found Family' THEN 'العائلة المختارة'
		WHEN 'Ensemble Cast' THEN 'بطولة جماعية'
		WHEN 'Adult Cast' THEN 'شخصيات بالغة'
		WHEN 'School' THEN 'المدرسة'
		WHEN 'Travel' THEN 'السفر'
		WHEN 'Magic' THEN 'السحر'
		WHEN 'Survival' THEN 'البقاء'
		WHEN 'Teen Cast' THEN 'شخصيات مراهقة'
		WHEN 'Family Life' THEN 'الحياة العائلية'
		WHEN 'Friendship' THEN 'الصداقة'
		WHEN 'Special Abilities' THEN 'قدرات خاصة'
		WHEN 'Philosophy' THEN 'الفلسفة'
		WHEN 'Swordplay' THEN 'المبارزة بالسيوف'
		WHEN 'Tragedy' THEN 'المأساة'
		WHEN 'Gore' THEN 'مشاهد دموية'
		WHEN 'Martial Arts' THEN 'فنون قتالية'
		WHEN 'Crime' THEN 'الجريمة'
		WHEN 'Revenge' THEN 'الانتقام'
		WHEN 'War' THEN 'الحرب'
		WHEN 'Bullying' THEN 'التنمّر'
		WHEN 'Conspiracy' THEN 'المؤامرة'
		WHEN 'Monsters' THEN 'الوحوش'
		WHEN 'Demons' THEN 'الشياطين'
		WHEN 'Grief' THEN 'الفقد'
		WHEN 'Robots' THEN 'الروبوتات'
		WHEN 'Military' THEN 'عسكري'
		WHEN 'Royalty' THEN 'الملكية'
		WHEN 'Superhero' THEN 'أبطال خارقون'
		WHEN 'Workplace' THEN 'مكان العمل'
		WHEN 'Class Conflict' THEN 'صراع طبقي'
		WHEN 'Curses' THEN 'اللعنات'
		WHEN 'Mind Games' THEN 'ألعاب ذهنية'
		WHEN 'Mythology' THEN 'الأساطير'
		WHEN 'Redemption' THEN 'الخلاص'
		ELSE NULL
	END,
	"description",
	''
FROM `terms`;--> statement-breakpoint
DROP TABLE `terms`;--> statement-breakpoint
ALTER TABLE `__new_terms` RENAME TO `terms`;--> statement-breakpoint
CREATE UNIQUE INDEX `terms_vocabulary_slug_uq` ON `terms` (`vocabulary`,`slug`);--> statement-breakpoint
CREATE INDEX `terms_parent_idx` ON `terms` (`parent_id`);--> statement-breakpoint
INSERT INTO `work_terms` (`work_id`, `term_id`, `weight`, `source`)
SELECT `work_id`, `term_id`, `weight`, `source` FROM `work_terms_v8_backup`;--> statement-breakpoint
DROP TABLE `work_terms_v8_backup`;--> statement-breakpoint
INSERT INTO `term_aliases` (`id`, `term_id`, `alias`, `language`, `normalized_alias`)
SELECT lower(hex(randomblob(16))), `id`, `name`, 'en', lower(trim(`name`))
FROM `terms`;--> statement-breakpoint
INSERT INTO `term_aliases` (`id`, `term_id`, `alias`, `language`, `normalized_alias`)
SELECT lower(hex(randomblob(16))), `id`, `label_ar`, 'ar', trim(`label_ar`)
FROM `terms`
WHERE `label_ar` IS NOT NULL;--> statement-breakpoint
INSERT INTO `term_aliases` (`id`, `term_id`, `alias`, `language`, `normalized_alias`)
SELECT lower(hex(randomblob(16))), `id`, 'Sci-Fi', 'en', 'sci-fi'
FROM `terms`
WHERE `vocabulary` = 'genre' AND `name` = 'Science Fiction';--> statement-breakpoint
CREATE TABLE `__new_work_credits` (
	`work_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`role` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`work_id`, `entity_id`, `role`),
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "work_credits_role_check" CHECK("__new_work_credits"."role" in ('author', 'writer', 'director', 'illustrator', 'main-studio', 'developer', 'publisher', 'composer', 'creator'))
);
--> statement-breakpoint
INSERT INTO `__new_work_credits`("work_id", "entity_id", "role", "position") SELECT "work_id", "entity_id", "role", "position" FROM `work_credits`;--> statement-breakpoint
DROP TABLE `work_credits`;--> statement-breakpoint
ALTER TABLE `__new_work_credits` RENAME TO `work_credits`;--> statement-breakpoint
CREATE INDEX `work_credits_entity_idx` ON `work_credits` (`entity_id`);--> statement-breakpoint
ALTER TABLE `works` ADD `playtime_minutes` integer;--> statement-breakpoint
ALTER TABLE `works` ADD `volume_count` integer;--> statement-breakpoint
ALTER TABLE `works` ADD `route_count` integer;--> statement-breakpoint
CREATE TRIGGER `works_media_metrics_validate_insert`
BEFORE INSERT ON `works`
WHEN NEW.`playtime_minutes` < 0
	OR NEW.`volume_count` < 0
	OR NEW.`route_count` < 0
BEGIN
	SELECT RAISE(ABORT, 'media metrics must be non-negative');
END;--> statement-breakpoint
CREATE TRIGGER `works_media_metrics_validate_update`
BEFORE UPDATE OF `playtime_minutes`, `volume_count`, `route_count` ON `works`
WHEN NEW.`playtime_minutes` < 0
	OR NEW.`volume_count` < 0
	OR NEW.`route_count` < 0
BEGIN
	SELECT RAISE(ABORT, 'media metrics must be non-negative');
END;--> statement-breakpoint
UPDATE `works`
SET `metadata` = json_remove(
	`metadata`,
	'$.subtitle',
	'$.scoreBreakdown',
	'$.riskProfile.fanService'
);
