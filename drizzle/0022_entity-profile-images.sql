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
	CONSTRAINT "assets_owner_type_check" CHECK("__new_assets"."owner_type" in ('work', 'entity')),
	CONSTRAINT "assets_type_check" CHECK("__new_assets"."asset_type" in ('poster', 'banner', 'logo', 'profile'))
);
--> statement-breakpoint
INSERT INTO `__new_assets`("id", "owner_type", "owner_id", "asset_type", "relative_path", "mime_type", "width", "height", "blurhash", "checksum", "metadata", "created_at", "updated_at") SELECT "id", "owner_type", "owner_id", "asset_type", "relative_path", "mime_type", "width", "height", "blurhash", "checksum", "metadata", "created_at", "updated_at" FROM `assets`;--> statement-breakpoint
DROP TABLE `assets`;--> statement-breakpoint
ALTER TABLE `__new_assets` RENAME TO `assets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `assets_owner_type_uq` ON `assets` (`owner_type`,`owner_id`,`asset_type`);--> statement-breakpoint
CREATE INDEX `assets_owner_idx` ON `assets` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE INDEX `assets_type_idx` ON `assets` (`asset_type`);