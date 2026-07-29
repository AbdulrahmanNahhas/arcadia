DROP TABLE `collection_items`;--> statement-breakpoint
DROP TABLE `collections`;--> statement-breakpoint
ALTER TABLE `saved_views` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `saved_views` ADD `icon` text DEFAULT 'bookmark' NOT NULL;--> statement-breakpoint
ALTER TABLE `saved_views` ADD `color` text DEFAULT 'primary' NOT NULL;