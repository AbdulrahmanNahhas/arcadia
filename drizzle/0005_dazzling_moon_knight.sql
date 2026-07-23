CREATE TABLE `tracking_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`progress` integer NOT NULL,
	`status` text NOT NULL,
	`occurred_on` text NOT NULL,
	`day_sequence` integer NOT NULL,
	`recorded_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tracking_entries_progress_check" CHECK("tracking_entries"."progress" >= 0),
	CONSTRAINT "tracking_entries_status_check" CHECK("tracking_entries"."status" in ('planned', 'in-progress', 'completed', 'paused', 'dropped')),
	CONSTRAINT "tracking_entries_date_check" CHECK("tracking_entries"."occurred_on" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        and date("tracking_entries"."occurred_on") = "tracking_entries"."occurred_on"),
	CONSTRAINT "tracking_entries_sequence_check" CHECK("tracking_entries"."day_sequence" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tracking_entries_work_day_sequence_uq` ON `tracking_entries` (`work_id`,`occurred_on`,`day_sequence`);--> statement-breakpoint
CREATE INDEX `tracking_entries_work_order_idx` ON `tracking_entries` (`work_id`,`occurred_on`,`day_sequence`);--> statement-breakpoint
CREATE INDEX `tracking_entries_order_idx` ON `tracking_entries` (`occurred_on`,`day_sequence`);--> statement-breakpoint
DROP TABLE `history_events`;--> statement-breakpoint
DROP TABLE `work_progress`;