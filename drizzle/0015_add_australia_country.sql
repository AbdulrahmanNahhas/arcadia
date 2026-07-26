INSERT OR IGNORE INTO `terms` (`id`, `vocabulary`, `name`, `slug`, `label_ar`, `description`, `description_ar`) VALUES
  ('taxonomy-country-australia', 'country', 'Australia', 'australia', 'أستراليا', 'Country of origin or primary production: Australia.', 'بلد المنشأ أو الإنتاج الرئيسي: أستراليا.');--> statement-breakpoint

UPDATE `terms`
SET
  `label_ar` = 'أستراليا',
  `description` = 'Country of origin or primary production: Australia.',
  `description_ar` = 'بلد المنشأ أو الإنتاج الرئيسي: أستراليا.'
WHERE `vocabulary` = 'country' AND `name` = 'Australia';--> statement-breakpoint

INSERT OR IGNORE INTO `work_terms` (`work_id`, `term_id`, `source`)
SELECT `works`.`id`, `terms`.`id`, 'audience-country-normalization'
FROM `works`
JOIN `terms` ON `terms`.`vocabulary` = 'country' AND `terms`.`name` = 'Australia'
WHERE `works`.`id` = '788073f2-8cb6-47ea-bcde-f639ca2395f6';
