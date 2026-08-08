ALTER TABLE `works` ADD `is_private` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `works_private_idx` ON `works` (`is_private`);