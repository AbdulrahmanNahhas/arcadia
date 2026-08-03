PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `entity_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`alias` text NOT NULL,
	`normalized_alias` text NOT NULL,
	`language` text,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entity_aliases_identity_uq` ON `entity_aliases` (`entity_id`,`normalized_alias`);--> statement-breakpoint
CREATE INDEX `entity_aliases_lookup_idx` ON `entity_aliases` (`normalized_alias`);--> statement-breakpoint
CREATE TABLE `entity_external_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`provider` text NOT NULL,
	`external_id` text NOT NULL,
	`url` text,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entity_external_identity_uq` ON `entity_external_identities` (`provider`,`external_id`);--> statement-breakpoint
CREATE INDEX `entity_external_identity_entity_idx` ON `entity_external_identities` (`entity_id`);--> statement-breakpoint
CREATE TEMP TABLE `__entity_map` AS
SELECT source.id AS old_id,
  source.name AS old_name,
  source.metadata AS old_metadata,
  CASE
    WHEN source.entity_type = 'person' THEN source.id
    ELSE (
      SELECT candidate.id
      FROM entities candidate
      LEFT JOIN assets candidate_asset
        ON candidate_asset.owner_type = 'entity'
       AND candidate_asset.owner_id = candidate.id
       AND candidate_asset.asset_type = 'profile'
      WHERE candidate.entity_type <> 'person'
        AND lower(trim(candidate.sort_name)) = lower(trim(source.sort_name))
      ORDER BY
        (candidate_asset.id IS NOT NULL) DESC,
        (length(candidate.description) + length(candidate.metadata)) DESC,
        candidate.created_at ASC,
        candidate.id ASC
      LIMIT 1
    )
  END AS new_id
FROM entities source;--> statement-breakpoint
CREATE TEMP TABLE `__contribution_backup` AS
SELECT work_id, entity_id, role, position FROM work_contributions;--> statement-breakpoint
CREATE TABLE `__new_entities` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`name` text NOT NULL,
	`sort_name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "entities_type_check" CHECK("__new_entities"."entity_type" in ('person', 'organization'))
);
--> statement-breakpoint
INSERT INTO `__new_entities`("id", "entity_type", "name", "sort_name", "description", "metadata", "created_at", "updated_at")
SELECT entity.id,
  CASE WHEN entity.entity_type = 'person' THEN 'person' ELSE 'organization' END,
  entity.name,
  lower(trim(entity.sort_name)),
  entity.description,
  entity.metadata,
  entity.created_at,
  entity.updated_at
FROM `entities` entity
JOIN `__entity_map` mapping ON mapping.old_id = entity.id AND mapping.new_id = entity.id;--> statement-breakpoint
DROP TABLE `entities`;--> statement-breakpoint
ALTER TABLE `__new_entities` RENAME TO `entities`;--> statement-breakpoint
CREATE UNIQUE INDEX `entities_type_sort_name_uq` ON `entities` (`entity_type`,`sort_name`);--> statement-breakpoint
CREATE INDEX `entities_type_idx` ON `entities` (`entity_type`);--> statement-breakpoint
CREATE INDEX `entities_sort_name_idx` ON `entities` (`sort_name`);--> statement-breakpoint
INSERT OR IGNORE INTO `entity_aliases` (`id`, `entity_id`, `alias`, `normalized_alias`, `language`)
SELECT 'migration-alias-' || mapping.old_id,
  mapping.new_id,
  mapping.old_name,
  lower(trim(mapping.old_name)),
  NULL
FROM `__entity_map` mapping
JOIN `entities` canonical ON canonical.id = mapping.new_id
WHERE mapping.old_id <> mapping.new_id
  AND lower(trim(mapping.old_name)) <> lower(trim(canonical.name));--> statement-breakpoint
INSERT OR IGNORE INTO `entity_aliases` (`id`, `entity_id`, `alias`, `normalized_alias`, `language`)
SELECT 'migration-metadata-alias-' || mapping.old_id || '-' || aliases.key,
  mapping.new_id,
  aliases.value,
  lower(trim(aliases.value)),
  NULL
FROM `__entity_map` mapping, json_each(mapping.old_metadata, '$.alternativeNames') aliases
WHERE json_type(mapping.old_metadata, '$.alternativeNames') = 'array'
  AND typeof(aliases.value) = 'text'
  AND trim(aliases.value) <> '';--> statement-breakpoint
INSERT OR IGNORE INTO `entity_external_identities` (`id`, `entity_id`, `provider`, `external_id`, `url`)
SELECT 'migration-mal-' || mapping.old_id,
  mapping.new_id,
  coalesce(json_extract(mapping.old_metadata, '$.sourceProvider'), 'MyAnimeList'),
  cast(json_extract(mapping.old_metadata, '$.malId') AS text),
  json_extract(mapping.old_metadata, '$.sourceUrl')
FROM `__entity_map` mapping
WHERE json_extract(mapping.old_metadata, '$.malId') IS NOT NULL;--> statement-breakpoint
DELETE FROM `assets`
WHERE owner_type = 'entity'
  AND id NOT IN (
    SELECT min(candidate.id)
    FROM assets candidate
    JOIN `__entity_map` candidate_mapping ON candidate_mapping.old_id = candidate.owner_id
    WHERE candidate.owner_type = 'entity'
    GROUP BY candidate_mapping.new_id, candidate.asset_type
  );--> statement-breakpoint
UPDATE `assets`
SET owner_id = (SELECT new_id FROM `__entity_map` WHERE old_id = assets.owner_id)
WHERE owner_type = 'entity';--> statement-breakpoint
CREATE TABLE `__new_personal_state` (
	`work_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'saved' NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`progress` real DEFAULT 0 NOT NULL,
	`progress_total` real,
	`progress_unit` text DEFAULT 'unit' NOT NULL,
	`completed_at` integer,
	`private_metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "personal_state_status_check" CHECK("__new_personal_state"."status" in ('saved', 'planned', 'in-progress', 'completed', 'paused', 'dropped')),
	CONSTRAINT "personal_state_values_check" CHECK("__new_personal_state"."progress" >= 0
        and ("__new_personal_state"."progress_total" is null or "__new_personal_state"."progress_total" >= 0)
        and ("__new_personal_state"."status" not in ('saved', 'planned') or "__new_personal_state"."progress" = 0)
        )
);
--> statement-breakpoint
INSERT INTO `__new_personal_state`("work_id", "status", "favorite", "progress", "progress_total", "progress_unit", "completed_at", "private_metadata", "created_at", "updated_at") SELECT "work_id", "status", "favorite", "progress", "progress_total", "progress_unit", "completed_at", "private_metadata", "created_at", "updated_at" FROM `personal_state`;--> statement-breakpoint
DROP TABLE `personal_state`;--> statement-breakpoint
ALTER TABLE `__new_personal_state` RENAME TO `personal_state`;--> statement-breakpoint
CREATE INDEX `personal_state_status_idx` ON `personal_state` (`status`);--> statement-breakpoint
CREATE TABLE `__new_tracking_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`progress_before` integer DEFAULT 0 NOT NULL,
	`progress` integer NOT NULL,
	`status_before` text DEFAULT 'planned' NOT NULL,
	`status` text NOT NULL,
	`occurred_on` text NOT NULL,
	`day_sequence` integer NOT NULL,
	`recorded_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tracking_entries_progress_before_check" CHECK("__new_tracking_entries"."progress_before" >= 0),
	CONSTRAINT "tracking_entries_progress_check" CHECK("__new_tracking_entries"."progress" >= 0),
	CONSTRAINT "tracking_entries_status_before_check" CHECK("__new_tracking_entries"."status_before" in ('saved', 'planned', 'in-progress', 'completed', 'paused', 'dropped')),
	CONSTRAINT "tracking_entries_status_check" CHECK("__new_tracking_entries"."status" in ('saved', 'planned', 'in-progress', 'completed', 'paused', 'dropped')),
	CONSTRAINT "tracking_entries_date_check" CHECK("__new_tracking_entries"."occurred_on" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        and date("__new_tracking_entries"."occurred_on") = "__new_tracking_entries"."occurred_on"),
	CONSTRAINT "tracking_entries_sequence_check" CHECK("__new_tracking_entries"."day_sequence" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_tracking_entries`("id", "work_id", "progress_before", "progress", "status_before", "status", "occurred_on", "day_sequence", "recorded_at") SELECT "id", "work_id", "progress_before", "progress", "status_before", "status", "occurred_on", "day_sequence", "recorded_at" FROM `tracking_entries`;--> statement-breakpoint
DROP TABLE `tracking_entries`;--> statement-breakpoint
ALTER TABLE `__new_tracking_entries` RENAME TO `tracking_entries`;--> statement-breakpoint
CREATE UNIQUE INDEX `tracking_entries_work_day_sequence_uq` ON `tracking_entries` (`work_id`,`occurred_on`,`day_sequence`);--> statement-breakpoint
CREATE INDEX `tracking_entries_work_order_idx` ON `tracking_entries` (`work_id`,`occurred_on`,`day_sequence`);--> statement-breakpoint
CREATE INDEX `tracking_entries_order_idx` ON `tracking_entries` (`occurred_on`,`day_sequence`);--> statement-breakpoint
CREATE TABLE `__new_work_contributions` (
	`work_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`role` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`work_id`, `entity_id`, `role`),
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "work_contributions_role_check" CHECK("__new_work_contributions"."role" in ('author', 'original-author', 'writer', 'screenwriter', 'director', 'illustrator', 'artist', 'animation-studio', 'production-company', 'producer', 'developer', 'publisher', 'composer', 'editor', 'translator', 'creator'))
);
--> statement-breakpoint
INSERT OR IGNORE INTO `__new_work_contributions`("work_id", "entity_id", "role", "is_primary", "position")
SELECT contribution.work_id,
  mapping.new_id,
  CASE
    WHEN contribution.role = 'main-studio' THEN 'animation-studio'
    WHEN contribution.role = 'producer' AND canonical.entity_type = 'organization' THEN 'production-company'
    ELSE contribution.role
  END,
  CASE WHEN contribution.role = 'main-studio' THEN true ELSE false END,
  contribution.position
FROM `__contribution_backup` contribution
JOIN `__entity_map` mapping ON mapping.old_id = contribution.entity_id
JOIN `entities` canonical ON canonical.id = mapping.new_id;--> statement-breakpoint
DROP TABLE `work_contributions`;--> statement-breakpoint
ALTER TABLE `__new_work_contributions` RENAME TO `work_contributions`;--> statement-breakpoint
CREATE INDEX `work_contributions_entity_idx` ON `work_contributions` (`entity_id`);--> statement-breakpoint
CREATE TABLE `__new_work_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`source_work_id` text NOT NULL,
	`target_work_id` text NOT NULL,
	`relation_type` text NOT NULL,
	`is_directed` integer DEFAULT true NOT NULL,
	`provenance` text DEFAULT 'manual' NOT NULL,
	`external_key` text,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`source_work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "work_relations_type_check" CHECK("__new_work_relations"."relation_type" in ('sequel', 'adaptation', 'spin-off', 'side-story', 'compilation', 'alternative', 'related')),
	CONSTRAINT "work_relations_distinct_endpoints_check" CHECK("__new_work_relations"."source_work_id" <> "__new_work_relations"."target_work_id"),
	CONSTRAINT "work_relations_direction_check" CHECK(("__new_work_relations"."relation_type" in ('alternative', 'related') and "__new_work_relations"."is_directed" = false and "__new_work_relations"."source_work_id" < "__new_work_relations"."target_work_id")
        or ("__new_work_relations"."relation_type" not in ('alternative', 'related') and "__new_work_relations"."is_directed" = true))
);
--> statement-breakpoint
INSERT OR IGNORE INTO `__new_work_relations`("id", "source_work_id", "target_work_id", "relation_type", "is_directed", "provenance", "external_key", "notes")
SELECT relation.id,
  CASE
    WHEN relation.relation_type = 'prequel' THEN relation.target_work_id
    WHEN relation.relation_type = 'adaptation'
      AND (SELECT kind FROM works WHERE id = relation.source_work_id) IN ('anime', 'movie', 'series')
      AND (SELECT kind FROM works WHERE id = relation.target_work_id) IN ('manga', 'novel', 'comic')
      THEN relation.target_work_id
    WHEN relation.relation_type IN ('alternative', 'related') AND relation.source_work_id > relation.target_work_id THEN relation.target_work_id
    ELSE relation.source_work_id
  END,
  CASE
    WHEN relation.relation_type = 'prequel' THEN relation.source_work_id
    WHEN relation.relation_type = 'adaptation'
      AND (SELECT kind FROM works WHERE id = relation.source_work_id) IN ('anime', 'movie', 'series')
      AND (SELECT kind FROM works WHERE id = relation.target_work_id) IN ('manga', 'novel', 'comic')
      THEN relation.source_work_id
    WHEN relation.relation_type IN ('alternative', 'related') AND relation.source_work_id > relation.target_work_id THEN relation.source_work_id
    ELSE relation.target_work_id
  END,
  CASE WHEN relation.relation_type = 'prequel' THEN 'sequel' ELSE relation.relation_type END,
  CASE WHEN relation.relation_type IN ('alternative', 'related') THEN false ELSE true END,
  'migration',
  NULL,
  relation.notes
FROM `work_relations` relation
WHERE relation.source_work_id <> relation.target_work_id
  AND relation.relation_type IN ('sequel', 'prequel', 'adaptation', 'spin-off', 'side-story', 'compilation', 'alternative', 'related');--> statement-breakpoint
DROP TABLE `work_relations`;--> statement-breakpoint
ALTER TABLE `__new_work_relations` RENAME TO `work_relations`;--> statement-breakpoint
CREATE UNIQUE INDEX `work_relations_pair_type_uq` ON `work_relations` (`source_work_id`,`target_work_id`,`relation_type`);--> statement-breakpoint
CREATE INDEX `work_relations_source_idx` ON `work_relations` (`source_work_id`);--> statement-breakpoint
CREATE INDEX `work_relations_target_idx` ON `work_relations` (`target_work_id`);
--> statement-breakpoint
DROP TABLE `__entity_map`;--> statement-breakpoint
DROP TABLE `__contribution_backup`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
