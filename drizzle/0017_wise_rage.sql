PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	CONSTRAINT "tracking_entries_status_before_check" CHECK("__new_tracking_entries"."status_before" in ('planned', 'in-progress', 'completed', 'paused', 'dropped')),
	CONSTRAINT "tracking_entries_status_check" CHECK("__new_tracking_entries"."status" in ('planned', 'in-progress', 'completed', 'paused', 'dropped')),
	CONSTRAINT "tracking_entries_date_check" CHECK("__new_tracking_entries"."occurred_on" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        and date("__new_tracking_entries"."occurred_on") = "__new_tracking_entries"."occurred_on"),
	CONSTRAINT "tracking_entries_sequence_check" CHECK("__new_tracking_entries"."day_sequence" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_tracking_entries`(
	"id",
	"work_id",
	"progress_before",
	"progress",
	"status_before",
	"status",
	"occurred_on",
	"day_sequence",
	"recorded_at"
)
SELECT
	current."id",
	current."work_id",
	CASE
		WHEN NOT (
			work."kind" IN ('series', 'anime')
			OR work."kind" IN ('manga', 'comic', 'novel')
			OR EXISTS (
				SELECT 1
				FROM `work_units`
				WHERE `work_units`."work_id" = work."id"
					AND `work_units`."unit_type" IN ('episode', 'chapter')
			)
		) THEN 0
		ELSE COALESCE((
			SELECT previous."progress"
			FROM `tracking_entries` AS previous
			WHERE previous."work_id" = current."work_id"
				AND (
					previous."occurred_on" < current."occurred_on"
					OR (
						previous."occurred_on" = current."occurred_on"
						AND previous."day_sequence" < current."day_sequence"
					)
				)
			ORDER BY previous."occurred_on" DESC, previous."day_sequence" DESC
			LIMIT 1
		), 0)
	END,
	CASE
		WHEN NOT (
			work."kind" IN ('series', 'anime')
			OR work."kind" IN ('manga', 'comic', 'novel')
			OR EXISTS (
				SELECT 1
				FROM `work_units`
				WHERE `work_units`."work_id" = work."id"
					AND `work_units`."unit_type" IN ('episode', 'chapter')
			)
		) THEN 0
		ELSE current."progress"
	END,
	COALESCE((
		SELECT previous."status"
		FROM `tracking_entries` AS previous
		WHERE previous."work_id" = current."work_id"
			AND (
				previous."occurred_on" < current."occurred_on"
				OR (
					previous."occurred_on" = current."occurred_on"
					AND previous."day_sequence" < current."day_sequence"
				)
			)
		ORDER BY previous."occurred_on" DESC, previous."day_sequence" DESC
		LIMIT 1
	), 'planned'),
	current."status",
	current."occurred_on",
	current."day_sequence",
	current."recorded_at"
FROM `tracking_entries` AS current
INNER JOIN `works` AS work ON work."id" = current."work_id";--> statement-breakpoint
DROP TABLE `tracking_entries`;--> statement-breakpoint
ALTER TABLE `__new_tracking_entries` RENAME TO `tracking_entries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `tracking_entries_work_day_sequence_uq` ON `tracking_entries` (`work_id`,`occurred_on`,`day_sequence`);--> statement-breakpoint
CREATE INDEX `tracking_entries_work_order_idx` ON `tracking_entries` (`work_id`,`occurred_on`,`day_sequence`);--> statement-breakpoint
CREATE INDEX `tracking_entries_order_idx` ON `tracking_entries` (`occurred_on`,`day_sequence`);--> statement-breakpoint
UPDATE `personal_state`
SET
	`progress` = 0,
	`progress_total` = NULL,
	`progress_unit` = 'movie'
WHERE `work_id` IN (
	SELECT work."id"
	FROM `works` AS work
	WHERE NOT (
		work."kind" IN ('series', 'anime')
		OR work."kind" IN ('manga', 'comic', 'novel')
		OR EXISTS (
			SELECT 1
			FROM `work_units`
			WHERE `work_units`."work_id" = work."id"
				AND `work_units`."unit_type" IN ('episode', 'chapter')
		)
	)
);
