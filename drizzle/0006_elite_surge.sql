PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	`notes` text DEFAULT '' NOT NULL,
	`private_metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "personal_state_status_check" CHECK("__new_personal_state"."status" in ('planned', 'in-progress', 'completed', 'paused', 'dropped')),
	CONSTRAINT "personal_state_values_check" CHECK("__new_personal_state"."progress" >= 0
        and ("__new_personal_state"."progress_total" is null or "__new_personal_state"."progress_total" >= 0)
        and ("__new_personal_state"."rating" is null or ("__new_personal_state"."rating" >= 0 and "__new_personal_state"."rating" <= 10)))
);
--> statement-breakpoint
INSERT INTO `__new_personal_state`("work_id", "status", "rating", "favorite", "owned", "wishlist", "progress", "progress_total", "progress_unit", "completed_at", "notes", "private_metadata", "created_at", "updated_at") SELECT "work_id", "status", "rating", "favorite", "owned", "wishlist", "progress", "progress_total", "progress_unit", "completed_at", "notes", "private_metadata", "created_at", "updated_at" FROM `personal_state`;--> statement-breakpoint
DROP TABLE `personal_state`;--> statement-breakpoint
ALTER TABLE `__new_personal_state` RENAME TO `personal_state`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `personal_state_status_idx` ON `personal_state` (`status`);