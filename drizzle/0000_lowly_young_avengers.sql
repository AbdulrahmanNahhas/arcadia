CREATE TABLE `assets` (
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
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `assets_owner_idx` ON `assets` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE INDEX `assets_type_idx` ON `assets` (`asset_type`);--> statement-breakpoint
CREATE TABLE `collection_items` (
	`collection_id` text NOT NULL,
	`work_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`added_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`collection_id`, `work_id`),
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`collection_type` text DEFAULT 'manual' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`filter_tree` text,
	`cover_asset_id` text,
	`settings` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `collections_type_idx` ON `collections` (`collection_type`);--> statement-breakpoint
CREATE TABLE `entities` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`name` text NOT NULL,
	`sort_name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `entities_type_idx` ON `entities` (`entity_type`);--> statement-breakpoint
CREATE INDEX `entities_sort_name_idx` ON `entities` (`sort_name`);--> statement-breakpoint
CREATE TABLE `external_links` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	`provider` text NOT NULL,
	`url` text NOT NULL,
	`external_id` text,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `external_links_owner_idx` ON `external_links` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE TABLE `field_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`data_type` text NOT NULL,
	`applies_to` text NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `field_definitions_key_unique` ON `field_definitions` (`key`);--> statement-breakpoint
CREATE INDEX `field_definitions_position_idx` ON `field_definitions` (`position`);--> statement-breakpoint
CREATE TABLE `field_values` (
	`work_id` text NOT NULL,
	`field_id` text NOT NULL,
	`text_value` text,
	`number_value` real,
	`boolean_value` integer,
	`date_value` integer,
	`json_value` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`work_id`, `field_id`),
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`field_id`) REFERENCES `field_definitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `history_events` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`event_type` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`progress_before` real,
	`progress_after` real,
	`duration_minutes` integer,
	`notes` text DEFAULT '' NOT NULL,
	`payload` text,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `history_events_work_date_idx` ON `history_events` (`work_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `personal_state` (
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
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `personal_state_status_idx` ON `personal_state` (`status`);--> statement-breakpoint
CREATE TABLE `saved_views` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`layout` text DEFAULT 'gallery' NOT NULL,
	`filter_tree` text NOT NULL,
	`sort` text DEFAULT '[]' NOT NULL,
	`group_by` text,
	`visible_columns` text DEFAULT '[]' NOT NULL,
	`card_size` integer DEFAULT 3 NOT NULL,
	`search` text DEFAULT '' NOT NULL,
	`display` text DEFAULT '{}' NOT NULL,
	`is_pinned` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `saved_views_pinned_idx` ON `saved_views` (`is_pinned`);--> statement-breakpoint
CREATE TABLE `similarity_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`artifact_type` text NOT NULL,
	`model` text,
	`dimensions` integer,
	`vector_path` text,
	`fingerprint` text,
	`features` text,
	`generated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `similarity_artifacts_work_idx` ON `similarity_artifacts` (`work_id`);--> statement-breakpoint
CREATE TABLE `terms` (
	`id` text PRIMARY KEY NOT NULL,
	`vocabulary` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`parent_id` text,
	`color` text,
	`description` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `terms_vocabulary_slug_uq` ON `terms` (`vocabulary`,`slug`);--> statement-breakpoint
CREATE INDEX `terms_parent_idx` ON `terms` (`parent_id`);--> statement-breakpoint
CREATE TABLE `work_credits` (
	`work_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`role` text NOT NULL,
	`character_name` text,
	`position` integer DEFAULT 0 NOT NULL,
	`details` text,
	PRIMARY KEY(`work_id`, `entity_id`, `role`),
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `work_credits_entity_idx` ON `work_credits` (`entity_id`);--> statement-breakpoint
CREATE TABLE `work_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`source_work_id` text NOT NULL,
	`target_work_id` text NOT NULL,
	`relation_type` text NOT NULL,
	`is_directed` integer DEFAULT true NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`source_work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `work_relations_source_idx` ON `work_relations` (`source_work_id`);--> statement-breakpoint
CREATE INDEX `work_relations_target_idx` ON `work_relations` (`target_work_id`);--> statement-breakpoint
CREATE TABLE `work_terms` (
	`work_id` text NOT NULL,
	`term_id` text NOT NULL,
	`weight` real DEFAULT 1 NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	PRIMARY KEY(`work_id`, `term_id`),
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `work_titles` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`title` text NOT NULL,
	`title_type` text DEFAULT 'alias' NOT NULL,
	`language` text,
	`script` text,
	`is_preferred` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `work_titles_work_idx` ON `work_titles` (`work_id`);--> statement-breakpoint
CREATE TABLE `works` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`canonical_title` text NOT NULL,
	`sort_title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`release_year` integer,
	`original_release_at` integer,
	`runtime_minutes` integer,
	`episode_count` integer,
	`chapter_count` integer,
	`status` text DEFAULT 'released' NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `works_kind_idx` ON `works` (`kind`);--> statement-breakpoint
CREATE INDEX `works_sort_title_idx` ON `works` (`sort_title`);--> statement-breakpoint
CREATE INDEX `works_release_year_idx` ON `works` (`release_year`);
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
