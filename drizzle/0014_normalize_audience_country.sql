-- Audience is a target-readership classification, never a content-risk label.
-- These are the complete controlled terms currently represented in the catalog.
INSERT OR IGNORE INTO `terms` (`id`, `vocabulary`, `name`, `slug`, `label_ar`, `description`, `description_ar`) VALUES
  ('taxonomy-audience-adult', 'audience', 'Adult', 'adult', 'بالغون', 'Primarily intended for adult readers or viewers; this reflects intended readership and narrative depth, not content risk.', 'موجّه أساساً للقراء أو المشاهدين البالغين؛ يصف الجمهور المقصود وعمق العمل، وليس درجة مخاطر المحتوى.'),
  ('taxonomy-audience-young-adult', 'audience', 'Young Adult', 'young-adult', 'شباب بالغون', 'Primarily intended for older teenagers and young adults; this reflects intended readership and narrative depth, not content risk.', 'موجّه أساساً للمراهقين الأكبر سناً والشباب البالغين؛ يصف الجمهور المقصود وعمق العمل، وليس درجة مخاطر المحتوى.'),
  ('taxonomy-audience-teen', 'audience', 'Teen', 'teen', 'مراهقون', 'Primarily intended for teenage readers or viewers; this reflects intended readership and narrative depth, not content risk.', 'موجّه أساساً للمراهقين؛ يصف الجمهور المقصود وعمق العمل، وليس درجة مخاطر المحتوى.'),
  ('taxonomy-audience-general', 'audience', 'General', 'general', 'عام', 'Intended for a broad general audience, including children and families; this reflects intended readership, not content risk.', 'موجّه لجمهور عام واسع، بما في ذلك الأطفال والعائلات؛ يصف الجمهور المقصود وليس درجة مخاطر المحتوى.'),
  ('taxonomy-country-france', 'country', 'France', 'france', 'فرنسا', 'Country of origin or primary production: France.', 'بلد المنشأ أو الإنتاج الرئيسي: فرنسا.'),
  ('taxonomy-country-japan', 'country', 'Japan', 'japan', 'اليابان', 'Country of origin or primary production: Japan.', 'بلد المنشأ أو الإنتاج الرئيسي: اليابان.'),
  ('taxonomy-country-south-korea', 'country', 'South Korea', 'south-korea', 'كوريا الجنوبية', 'Country of origin or primary production: South Korea.', 'بلد المنشأ أو الإنتاج الرئيسي: كوريا الجنوبية.'),
  ('taxonomy-country-united-kingdom', 'country', 'United Kingdom', 'united-kingdom', 'المملكة المتحدة', 'Country of origin or primary production: United Kingdom.', 'بلد المنشأ أو الإنتاج الرئيسي: المملكة المتحدة.'),
  ('taxonomy-country-united-states', 'country', 'United States', 'united-states', 'الولايات المتحدة', 'Country of origin or primary production: United States.', 'بلد المنشأ أو الإنتاج الرئيسي: الولايات المتحدة.');--> statement-breakpoint

UPDATE `terms`
SET
  `label_ar` = CASE `vocabulary` || ':' || `name`
    WHEN 'audience:Adult' THEN 'بالغون'
    WHEN 'audience:Young Adult' THEN 'شباب بالغون'
    WHEN 'audience:Teen' THEN 'مراهقون'
    WHEN 'audience:General' THEN 'عام'
    WHEN 'country:France' THEN 'فرنسا'
    WHEN 'country:Japan' THEN 'اليابان'
    WHEN 'country:South Korea' THEN 'كوريا الجنوبية'
    WHEN 'country:United Kingdom' THEN 'المملكة المتحدة'
    WHEN 'country:United States' THEN 'الولايات المتحدة'
  END,
  `description` = CASE `vocabulary` || ':' || `name`
    WHEN 'audience:Adult' THEN 'Primarily intended for adult readers or viewers; this reflects intended readership and narrative depth, not content risk.'
    WHEN 'audience:Young Adult' THEN 'Primarily intended for older teenagers and young adults; this reflects intended readership and narrative depth, not content risk.'
    WHEN 'audience:Teen' THEN 'Primarily intended for teenage readers or viewers; this reflects intended readership and narrative depth, not content risk.'
    WHEN 'audience:General' THEN 'Intended for a broad general audience, including children and families; this reflects intended readership, not content risk.'
    WHEN 'country:France' THEN 'Country of origin or primary production: France.'
    WHEN 'country:Japan' THEN 'Country of origin or primary production: Japan.'
    WHEN 'country:South Korea' THEN 'Country of origin or primary production: South Korea.'
    WHEN 'country:United Kingdom' THEN 'Country of origin or primary production: United Kingdom.'
    WHEN 'country:United States' THEN 'Country of origin or primary production: United States.'
  END,
  `description_ar` = CASE `vocabulary` || ':' || `name`
    WHEN 'audience:Adult' THEN 'موجّه أساساً للقراء أو المشاهدين البالغين؛ يصف الجمهور المقصود وعمق العمل، وليس درجة مخاطر المحتوى.'
    WHEN 'audience:Young Adult' THEN 'موجّه أساساً للمراهقين الأكبر سناً والشباب البالغين؛ يصف الجمهور المقصود وعمق العمل، وليس درجة مخاطر المحتوى.'
    WHEN 'audience:Teen' THEN 'موجّه أساساً للمراهقين؛ يصف الجمهور المقصود وعمق العمل، وليس درجة مخاطر المحتوى.'
    WHEN 'audience:General' THEN 'موجّه لجمهور عام واسع، بما في ذلك الأطفال والعائلات؛ يصف الجمهور المقصود وليس درجة مخاطر المحتوى.'
    WHEN 'country:France' THEN 'بلد المنشأ أو الإنتاج الرئيسي: فرنسا.'
    WHEN 'country:Japan' THEN 'بلد المنشأ أو الإنتاج الرئيسي: اليابان.'
    WHEN 'country:South Korea' THEN 'بلد المنشأ أو الإنتاج الرئيسي: كوريا الجنوبية.'
    WHEN 'country:United Kingdom' THEN 'بلد المنشأ أو الإنتاج الرئيسي: المملكة المتحدة.'
    WHEN 'country:United States' THEN 'بلد المنشأ أو الإنتاج الرئيسي: الولايات المتحدة.'
  END
WHERE (`vocabulary` = 'audience' AND `name` IN ('Adult', 'Young Adult', 'Teen', 'General'))
   OR (`vocabulary` = 'country' AND `name` IN ('France', 'Japan', 'South Korea', 'United Kingdom', 'United States'));--> statement-breakpoint

-- Preserve the source assignments already present in legacy metadata while
-- storing them in the normalized work_terms relation used by the application.
INSERT OR IGNORE INTO `work_terms` (`work_id`, `term_id`, `source`)
SELECT `works`.`id`, `terms`.`id`, 'audience-country-normalization'
FROM `works`
JOIN json_each(`works`.`metadata`, '$.audience') AS `legacy_audience`
JOIN `terms`
  ON `terms`.`vocabulary` = 'audience'
 AND `terms`.`name` = CASE `legacy_audience`.`value`
   WHEN 'Family' THEN 'General'
   WHEN 'Mature' THEN 'Adult'
   ELSE `legacy_audience`.`value`
 END
WHERE `legacy_audience`.`value` <> 'Unknown';--> statement-breakpoint

INSERT OR IGNORE INTO `work_terms` (`work_id`, `term_id`, `source`)
SELECT `works`.`id`, `terms`.`id`, 'audience-country-normalization'
FROM `works`
JOIN json_each(`works`.`metadata`, '$.country') AS `legacy_country`
JOIN `terms`
  ON `terms`.`vocabulary` = 'country'
 AND `terms`.`name` = `legacy_country`.`value`;--> statement-breakpoint

-- These records were already normalized by a prior curation pass, which
-- removed their legacy metadata. Keep their explicit target-audience choice.
INSERT OR IGNORE INTO `work_terms` (`work_id`, `term_id`, `source`)
SELECT `works`.`id`, `terms`.`id`, 'audience-country-normalization'
FROM (
  SELECT 'obsidian-animation-tv-86-eighty-six' AS `work_id`, 'Adult' AS `audience`
  UNION ALL SELECT 'obsidian-animation-tv-attack-on-titan', 'Adult'
  UNION ALL SELECT 'obsidian-animation-tv-ghost-in-shell', 'Adult'
  UNION ALL SELECT 'obsidian-animation-tv-historie', 'Adult'
  UNION ALL SELECT 'obsidian-animation-tv-monster', 'Adult'
  UNION ALL SELECT 'obsidian-animation-tv-oddtaxi', 'Adult'
  UNION ALL SELECT 'obsidian-animation-tv-orb-on-the-movements-of-the-earth', 'Adult'
  UNION ALL SELECT 'obsidian-animation-tv-oshi-no-ko', 'Adult'
  UNION ALL SELECT 'obsidian-animation-tv-pluto', 'Adult'
  UNION ALL SELECT 'obsidian-animation-tv-steinsgate', 'Adult'
  UNION ALL SELECT 'obsidian-animation-tv-vinland-saga', 'Adult'
  UNION ALL SELECT '5f659e22-3491-40f9-87c0-5a8950925001', 'Adult'
  UNION ALL SELECT '83bc45c9-4ebc-4650-a726-02450352f506', 'Adult'
  UNION ALL SELECT 'obsidian-animation-movies-silent-voice', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-movies-suzume', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-movies-weathering-with-you', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-movies-your-name', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-chainsaw-man', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-charlotte', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-classroom-of-the-elite', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-death-note', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-delicious-in-dungeon', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-frieren-beyond-journeys-end', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-fullmetal-alchemist-brotherhood', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-hell-paradise', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-hunter-hunter-2011', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-jujutsu-kaisen', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-kagurabachi', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-kaiju-08', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-my-happy-marriage', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-remake-our-life', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-rezero-starting-life-in-another-world', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-summertime-render', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-talentless-nana', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-the-apothecary-diaries', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-the-promised-neverland', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-violet-evergarden', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-vivy-fluorite-eyes-song', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-witch-hat-atelier', 'Young Adult'
  UNION ALL SELECT 'literature-manga-three-days-of-happiness', 'Young Adult'
  UNION ALL SELECT 'obsidian-animation-tv-black-clover', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-blue-box', 'Teen'
  UNION ALL SELECT 'literature-manga-blue-box', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-bocchi-the-rock', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-demon-slayer', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-fragrant-flower-blooms', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-gachiakuta', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-genshin', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-horimiya', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-jaadugar', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-kaguya-sama-love-is-war', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-lona', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-my-hero-academia', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-one-punch-man', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-ranking-of-kings', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-sakamoto-days', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-secrets-of-the-silent-witch', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-solo-leveling', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-sparks-of-tomorrow', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-spy-family', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-sword-art-online', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-the-bugle-call-song-of-war', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-the-one-piece', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-toilet-bound-hanako-kun', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-tonikawa-over-the-moon-for-you', 'Teen'
  UNION ALL SELECT 'obsidian-animation-tv-yamada-kun-999', 'Teen'
) AS `missing`
JOIN `works` ON `works`.`id` = `missing`.`work_id`
JOIN `terms`
  ON `terms`.`vocabulary` = 'audience'
 AND `terms`.`name` = `missing`.`audience`;--> statement-breakpoint

-- All animation records with missing legacy metadata originate in Japan.
INSERT OR IGNORE INTO `work_terms` (`work_id`, `term_id`, `source`)
SELECT `works`.`id`, `terms`.`id`, 'audience-country-normalization'
FROM `works`
JOIN `terms` ON `terms`.`vocabulary` = 'country' AND `terms`.`name` = 'Japan'
WHERE `works`.`id` LIKE 'obsidian-animation-%'
  AND NOT EXISTS (
    SELECT 1
    FROM `work_terms`
    JOIN `terms` AS `existing_country` ON `existing_country`.`id` = `work_terms`.`term_id`
    WHERE `work_terms`.`work_id` = `works`.`id`
      AND `existing_country`.`vocabulary` = 'country'
  );--> statement-breakpoint

INSERT OR IGNORE INTO `work_terms` (`work_id`, `term_id`, `source`)
SELECT `works`.`id`, `terms`.`id`, 'audience-country-normalization'
FROM (
  SELECT 'literature-manga-blue-box' AS `work_id`, 'Japan' AS `country`
  UNION ALL SELECT 'literature-manga-three-days-of-happiness', 'Japan'
  UNION ALL SELECT '5f659e22-3491-40f9-87c0-5a8950925001', 'United Kingdom'
  UNION ALL SELECT '83bc45c9-4ebc-4650-a726-02450352f506', 'United States'
) AS `missing`
JOIN `works` ON `works`.`id` = `missing`.`work_id`
JOIN `terms`
  ON `terms`.`vocabulary` = 'country'
 AND `terms`.`name` = `missing`.`country`;--> statement-breakpoint

-- Every work must have exactly one target audience and at least one country.
INSERT OR IGNORE INTO `work_terms` (`work_id`, `term_id`, `source`)
SELECT `works`.`id`, `terms`.`id`, 'audience-country-normalization'
FROM `works`
JOIN `terms` ON `terms`.`vocabulary` = 'audience' AND `terms`.`name` = 'General'
WHERE NOT EXISTS (
  SELECT 1
  FROM `work_terms`
  JOIN `terms` AS `existing_audience` ON `existing_audience`.`id` = `work_terms`.`term_id`
  WHERE `work_terms`.`work_id` = `works`.`id`
    AND `existing_audience`.`vocabulary` = 'audience'
);
