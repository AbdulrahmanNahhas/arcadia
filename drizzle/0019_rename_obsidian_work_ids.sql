-- Work IDs were originally namespaced by their import source. The source is
-- no longer meaningful, so remove that namespace while retaining all catalog
-- and personal-history relationships.

INSERT INTO `works` (
  `id`,
  `kind`,
  `canonical_title`,
  `sort_title`,
  `summary`,
  `release_year`,
  `original_release_at`,
  `runtime_minutes`,
  `playtime_minutes`,
  `page_count`,
  `episode_count`,
  `chapter_count`,
  `volume_count`,
  `route_count`,
  `status`,
  `metadata`,
  `created_at`,
  `updated_at`
)
SELECT
  replace(`id`, 'obsidian-', ''),
  `kind`,
  `canonical_title`,
  `sort_title`,
  `summary`,
  `release_year`,
  `original_release_at`,
  `runtime_minutes`,
  `playtime_minutes`,
  `page_count`,
  `episode_count`,
  `chapter_count`,
  `volume_count`,
  `route_count`,
  `status`,
  `metadata`,
  `created_at`,
  `updated_at`
FROM `works`
WHERE `id` LIKE 'obsidian-%';--> statement-breakpoint

INSERT INTO `work_seasons`
SELECT
  replace(`id`, 'obsidian-', ''),
  replace(`work_id`, 'obsidian-', ''),
  `title`,
  `season_number`,
  `position`,
  `runtime_minutes`,
  `unit_count`,
  `release_at`,
  `created_at`,
  `updated_at`
FROM `work_seasons`
WHERE `work_id` LIKE 'obsidian-%';--> statement-breakpoint

UPDATE `work_titles`
SET `id` = replace(`id`, 'obsidian-', '')
WHERE `id` LIKE '%obsidian-%';--> statement-breakpoint
UPDATE `work_titles`
SET `work_id` = replace(`work_id`, 'obsidian-', '')
WHERE `work_id` LIKE 'obsidian-%';--> statement-breakpoint
UPDATE `work_credits`
SET `work_id` = replace(`work_id`, 'obsidian-', '')
WHERE `work_id` LIKE 'obsidian-%';--> statement-breakpoint
UPDATE `work_terms`
SET `work_id` = replace(`work_id`, 'obsidian-', '')
WHERE `work_id` LIKE 'obsidian-%';--> statement-breakpoint
UPDATE `work_relations`
SET `source_work_id` = replace(`source_work_id`, 'obsidian-', '')
WHERE `source_work_id` LIKE 'obsidian-%';--> statement-breakpoint
UPDATE `work_relations`
SET `target_work_id` = replace(`target_work_id`, 'obsidian-', '')
WHERE `target_work_id` LIKE 'obsidian-%';--> statement-breakpoint
UPDATE `personal_state`
SET `work_id` = replace(`work_id`, 'obsidian-', '')
WHERE `work_id` LIKE 'obsidian-%';--> statement-breakpoint
UPDATE `personal_scores`
SET `work_id` = replace(`work_id`, 'obsidian-', '')
WHERE `work_id` LIKE 'obsidian-%';--> statement-breakpoint
UPDATE `tracking_entries`
SET `id` = replace(`id`, 'obsidian-', '')
WHERE `id` LIKE '%obsidian-%';--> statement-breakpoint
UPDATE `tracking_entries`
SET `work_id` = replace(`work_id`, 'obsidian-', '')
WHERE `work_id` LIKE 'obsidian-%';--> statement-breakpoint
UPDATE `work_units`
SET `id` = replace(`id`, 'obsidian-', '')
WHERE `id` LIKE '%obsidian-%';--> statement-breakpoint
UPDATE `work_units`
SET `season_id` = replace(`season_id`, 'obsidian-', '')
WHERE `season_id` LIKE 'obsidian-%';--> statement-breakpoint
UPDATE `work_units`
SET `work_id` = replace(`work_id`, 'obsidian-', '')
WHERE `work_id` LIKE 'obsidian-%';--> statement-breakpoint
UPDATE `assets`
SET `owner_id` = replace(`owner_id`, 'obsidian-', '')
WHERE `owner_type` = 'work' AND `owner_id` LIKE 'obsidian-%';--> statement-breakpoint
UPDATE `external_links`
SET `owner_id` = replace(`owner_id`, 'obsidian-', '')
WHERE `owner_type` = 'work' AND `owner_id` LIKE 'obsidian-%';--> statement-breakpoint
UPDATE `similarity_artifacts`
SET `work_id` = replace(`work_id`, 'obsidian-', '')
WHERE `work_id` LIKE 'obsidian-%';--> statement-breakpoint

DELETE FROM `work_seasons` WHERE `work_id` LIKE 'obsidian-%';--> statement-breakpoint
DELETE FROM `works` WHERE `id` LIKE 'obsidian-%';
