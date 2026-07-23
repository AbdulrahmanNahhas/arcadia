PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_history_events` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`season_id` text,
	`unit_id` text,
	`external_key` text,
	`import_batch_id` text,
	`event_type` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`recorded_at` integer DEFAULT (unixepoch()) NOT NULL,
	`source` text DEFAULT 'app' NOT NULL,
	`status_before` text,
	`status_after` text,
	`progress_before` real,
	`progress_after` real,
	`rating_value` real,
	`duration_minutes` integer,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`season_id`) REFERENCES `work_seasons`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`unit_id`) REFERENCES `work_units`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "history_events_type_check" CHECK("__new_history_events"."event_type" in (
        'started', 'status_changed', 'progress_updated', 'season_completed',
        'work_completed', 'dropped', 'rewatched', 'reread', 'rated'
      )),
	CONSTRAINT "history_events_source_check" CHECK("__new_history_events"."source" in ('app', 'manual', 'import')),
	CONSTRAINT "history_events_status_check" CHECK(("__new_history_events"."status_before" is null or "__new_history_events"."status_before" in ('planned', 'in-progress', 'completed', 'paused', 'dropped'))
        and ("__new_history_events"."status_after" is null or "__new_history_events"."status_after" in ('planned', 'in-progress', 'completed', 'paused', 'dropped'))),
	CONSTRAINT "history_events_values_check" CHECK(("__new_history_events"."progress_before" is null or "__new_history_events"."progress_before" >= 0)
        and ("__new_history_events"."progress_after" is null or "__new_history_events"."progress_after" >= 0)
        and ("__new_history_events"."rating_value" is null or ("__new_history_events"."rating_value" >= 0 and "__new_history_events"."rating_value" <= 10))
        and ("__new_history_events"."duration_minutes" is null or "__new_history_events"."duration_minutes" >= 0)
        and not ("__new_history_events"."season_id" is not null and "__new_history_events"."unit_id" is not null))
);
--> statement-breakpoint
INSERT INTO `__new_history_events`("id", "work_id", "season_id", "unit_id", "external_key", "import_batch_id", "event_type", "occurred_at", "recorded_at", "source", "status_before", "status_after", "progress_before", "progress_after", "rating_value", "duration_minutes", "notes")
SELECT "id", "work_id", "season_id", "unit_id", null, null, "event_type", "occurred_at",
	unixepoch(), 'app', null, null, "progress_before", "progress_after",
	null, "duration_minutes", "notes"
FROM `history_events`;--> statement-breakpoint
DROP TABLE `history_events`;--> statement-breakpoint
ALTER TABLE `__new_history_events` RENAME TO `history_events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `history_events_work_date_idx` ON `history_events` (`work_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `history_events_date_idx` ON `history_events` (`occurred_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `history_events_external_key_uq` ON `history_events` (`external_key`);--> statement-breakpoint
CREATE INDEX `history_events_import_batch_idx` ON `history_events` (`import_batch_id`);--> statement-breakpoint
CREATE INDEX `history_events_source_idx` ON `history_events` (`source`);--> statement-breakpoint
CREATE INDEX `history_events_season_idx` ON `history_events` (`season_id`);--> statement-breakpoint
CREATE INDEX `history_events_unit_idx` ON `history_events` (`unit_id`);
--> statement-breakpoint
CREATE TRIGGER `history_events_immutable_update`
BEFORE UPDATE ON `history_events`
BEGIN
  SELECT RAISE(ABORT, 'history_events is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `history_events_immutable_delete`
BEFORE DELETE ON `history_events`
BEGIN
  SELECT RAISE(ABORT, 'history_events is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `history_events_validate_season`
BEFORE INSERT ON `history_events`
WHEN NEW.season_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM work_seasons
    WHERE id = NEW.season_id AND work_id = NEW.work_id
  )
BEGIN
  SELECT RAISE(ABORT, 'season does not belong to work');
END;
--> statement-breakpoint
CREATE TRIGGER `history_events_validate_unit`
BEFORE INSERT ON `history_events`
WHEN NEW.unit_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM work_units
    WHERE id = NEW.unit_id AND work_id = NEW.work_id
  )
BEGIN
  SELECT RAISE(ABORT, 'unit does not belong to work');
END;
