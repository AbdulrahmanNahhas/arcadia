ALTER TABLE `personal_state` DROP COLUMN `owned`;--> statement-breakpoint
ALTER TABLE `personal_state` DROP COLUMN `wishlist`;--> statement-breakpoint
ALTER TABLE `personal_state` DROP COLUMN `notes`;--> statement-breakpoint
ALTER TABLE `works` DROP COLUMN `primary_platform`;--> statement-breakpoint
UPDATE `works`
SET `metadata` = json_remove(`metadata`, '$.favoriteCharacters', '$.publication.demographic')
WHERE json_type(`metadata`, '$.favoriteCharacters') IS NOT NULL
   OR json_type(`metadata`, '$.publication.demographic') IS NOT NULL;
