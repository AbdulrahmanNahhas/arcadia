INSERT INTO `terms` (`id`, `vocabulary`, `name`, `slug`, `description`)
SELECT lower(hex(randomblob(16))), 'audience', 'General', 'general', ''
WHERE NOT EXISTS (
	SELECT 1 FROM `terms`
	WHERE `vocabulary` = 'audience' AND `name` = 'General'
);--> statement-breakpoint
UPDATE OR IGNORE `work_terms`
SET `term_id` = (
	SELECT `id` FROM `terms`
	WHERE `vocabulary` = 'audience' AND `name` = 'General'
)
WHERE `term_id` IN (
	SELECT `id` FROM `terms`
	WHERE `vocabulary` = 'audience' AND `name` = 'Family'
);--> statement-breakpoint
UPDATE OR IGNORE `work_terms`
SET `term_id` = (
	SELECT `id` FROM `terms`
	WHERE `vocabulary` = 'audience' AND `name` = 'Adult'
)
WHERE `term_id` IN (
	SELECT `id` FROM `terms`
	WHERE `vocabulary` = 'audience' AND `name` = 'Mature'
);--> statement-breakpoint
DELETE FROM `work_terms`
WHERE `term_id` IN (
	SELECT `id` FROM `terms`
	WHERE `vocabulary` = 'audience'
		AND `name` IN ('Family', 'Mature', 'Unknown')
);--> statement-breakpoint
DELETE FROM `terms`
WHERE `vocabulary` = 'audience'
	AND `name` IN ('Family', 'Mature', 'Unknown');
