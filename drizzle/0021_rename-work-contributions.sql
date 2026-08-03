ALTER TABLE `work_credits` RENAME TO `work_contributions`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_work_contributions` (
	`work_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`role` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`work_id`, `entity_id`, `role`),
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "work_contributions_role_check" CHECK("__new_work_contributions"."role" in ('author', 'original-author', 'writer', 'screenwriter', 'director', 'illustrator', 'artist', 'main-studio', 'producer', 'developer', 'publisher', 'composer', 'editor', 'translator', 'creator'))
);
--> statement-breakpoint
INSERT INTO `__new_work_contributions`("work_id", "entity_id", "role", "position") SELECT "work_id", "entity_id", "role", "position" FROM `work_contributions`;--> statement-breakpoint
DROP TABLE `work_contributions`;--> statement-breakpoint
ALTER TABLE `__new_work_contributions` RENAME TO `work_contributions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `work_contributions_entity_idx` ON `work_contributions` (`entity_id`);