PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_saved_views` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`icon` text DEFAULT 'bookmark' NOT NULL,
	`color` text DEFAULT 'primary' NOT NULL,
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
	CONSTRAINT "saved_views_layout_check" CHECK("__new_saved_views"."layout" in ('gallery', 'wide', 'table', 'timeline', 'statistics')),
	CONSTRAINT "saved_views_sort_direction_check" CHECK("__new_saved_views"."sort_direction" in ('asc', 'desc')),
	CONSTRAINT "saved_views_card_size_check" CHECK("__new_saved_views"."card_size" >= 1 and "__new_saved_views"."card_size" <= 300)
);
--> statement-breakpoint
INSERT INTO `__new_saved_views`("id", "name", "description", "icon", "color", "layout", "filter_tree", "sort_field", "sort_direction", "group_by", "visible_columns", "card_size", "search", "display", "is_pinned", "created_at", "updated_at") SELECT "id", "name", "description", "icon", "color", "layout", "filter_tree", "sort_field", "sort_direction", "group_by", "visible_columns", "card_size", "search", "display", "is_pinned", "created_at", "updated_at" FROM `saved_views`;--> statement-breakpoint
DROP TABLE `saved_views`;--> statement-breakpoint
ALTER TABLE `__new_saved_views` RENAME TO `saved_views`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `saved_views_name_uq` ON `saved_views` (`name`);--> statement-breakpoint
CREATE INDEX `saved_views_pinned_idx` ON `saved_views` (`is_pinned`);