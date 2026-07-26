-- The former Obsidian vault is no longer a catalog source. Remove its
-- filesystem path and import timestamp from local work metadata.
UPDATE `works`
SET `metadata` = json_remove(`metadata`, '$.source')
WHERE json_extract(`metadata`, '$.source.type') = 'obsidian';
