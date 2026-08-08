INSERT OR IGNORE INTO `planets` (`id`, `slug`, `name_ar`, `name_en`, `icon`, `description`, `primary_color`, `secondary_color`, `display_order`, `classification_hints`) VALUES
  ('planet-action', 'action', 'كوكب الأكشن والقتال', 'Action & Combat', '⚔️', 'حكايات المواجهة والبطولة والصراع الحركي.', '#B85C57', '#4A2328', 10, '{"genres":["Action","War","Crime"],"tags":["Martial Arts","Military"]}'),
  ('planet-adventure', 'adventure-fantasy', 'كوكب المغامرات والخيال', 'Adventure & Fantasy', '🧭', 'رحلات إلى عوالم بعيدة وحكايات يحرّكها الاكتشاف والخيال.', '#7189E8', '#29355F', 20, '{"genres":["Adventure","Fantasy"],"tags":["Journey","Detailed Worldbuilding"]}'),
  ('planet-mystery', 'darkness-mystery', 'كوكب الظلام والغموض', 'Darkness & Mystery', '👁️', 'ألغاز وحكايات نفسية وعوالم تتكشف ببطء.', '#756A9A', '#262238', 30, '{"genres":["Mystery","Thriller","Horror","Psychological"],"tones":["Dark","Tense"]}'),
  ('planet-future', 'future-technology', 'كوكب المستقبل والتقنية', 'Future & Technology', '🤖', 'الخيال العلمي والتقنية والآلات وأسئلة المستقبل.', '#4F95A8', '#173B49', 40, '{"genres":["Science Fiction","Mecha"],"tags":["Robots","Artificial Intelligence"]}'),
  ('planet-history', 'history-knowledge', 'كوكب التاريخ والمعرفة', 'History & Knowledge', '📜', 'أعمال تستكشف التاريخ والمعرفة والسير والتحولات الحضارية.', '#B08A5C', '#493522', 50, '{"genres":["Historical"],"tags":["Educational","Biography"]}'),
  ('planet-emerald', 'emerald', 'كوكب زمردة', 'Emerald', '💎', 'حكايات وجدانية واجتماعية تركز على العلاقات والنمو الشخصي.', '#679B88', '#20483D', 60, '{"genres":["Drama","Romance","Slice of Life"],"tags":["Female Protagonist","Coming-of-Age"]}'),
  ('planet-comedy', 'comedy-fun', 'كوكب الكوميديا والمرح', 'Comedy & Fun', '😄', 'أعمال خفيفة ومرحة تقودها الكوميديا والرفقة.', '#C39A55', '#513D1D', 70, '{"genres":["Comedy"],"tones":["Wholesome","Energetic","Whimsical"]}'),
  ('planet-bonbon', 'bonbon', 'كوكب بون بون', 'Bon Bon', '🧸', 'حكايات لطيفة مناسبة للمشاهدة العائلية والسنوات الأولى.', '#C78391', '#54303A', 80, '{"audiences":["General"],"tones":["Wholesome"]}'),
  ('planet-sports', 'sports-challenge', 'كوكب الرياضة والتحدي', 'Sports & Challenge', '⚽', 'المنافسة والانضباط والعمل الجماعي وتجاوز الحدود.', '#6C9B70', '#27452B', 90, '{"genres":["Sports"],"tags":["Competition"]}');--> statement-breakpoint

INSERT OR IGNORE INTO `risk_dimensions` (`id`, `slug`, `name_ar`, `name_en`, `description`, `display_order`) VALUES
  ('risk-sexuality', 'sexuality', 'المحتوى الجنسي', 'Sexuality', 'المشاهد أو الإشارات أو الموضوعات الجنسية.', 10),
  ('risk-behavioral', 'behavioral', 'المخاوف السلوكية', 'Behavioral concerns', 'العنف والسلوك المؤذي والمواد والآثار النفسية.', 20),
  ('risk-theology', 'theology', 'المحتوى العقدي', 'Theology', 'الأفكار والممارسات والمضامين العقدية أو الغيبية.', 30);--> statement-breakpoint

INSERT OR IGNORE INTO `organization_relationship_types` (`id`, `name_ar`, `name_en`, `inverse_name_ar`, `category`, `is_directed`, `allows_cycles`, `display_order`) VALUES
  ('predecessor', 'سبقها', 'Predecessor', 'خلفتها', 'historical', true, false, 10),
  ('successor', 'خلفتها', 'Successor', 'سبقتها', 'historical', true, false, 20),
  ('founded-from', 'تأسست انطلاقاً من', 'Founded from', 'انبثقت عنها', 'historical', true, false, 30),
  ('spin-off', 'انفصلت عن', 'Spin-off', 'انبثقت عنها', 'historical', true, false, 40),
  ('subsidiary', 'شركة تابعة لـ', 'Subsidiary', 'شركة أم لـ', 'corporate', true, false, 50),
  ('parent', 'شركة أم لـ', 'Parent', 'شركة تابعة لـ', 'corporate', true, false, 60),
  ('merger', 'اندمجت مع', 'Merger', 'اندمجت مع', 'corporate', false, true, 70),
  ('renamed-to', 'أعيدت تسميتها إلى', 'Renamed to', 'كان اسمها', 'historical', true, false, 80),
  ('reorganized-as', 'أعيد تنظيمها بصفتها', 'Reorganized as', 'نتجت عن إعادة تنظيم', 'historical', true, false, 90),
  ('creative-lineage', 'امتداد إبداعي لـ', 'Creative lineage', 'أثرت في', 'creative', true, true, 100),
  ('other', 'صلة أخرى', 'Other', 'صلة أخرى', 'historical', false, true, 110);--> statement-breakpoint

INSERT OR IGNORE INTO `contribution_roles` (`id`, `name_ar`, `name_en`, `allowed_entity_type`, `display_order`) VALUES
  ('author', 'مؤلف', 'Author', 'person', 10),
  ('original-author', 'صاحب العمل الأصلي', 'Original author', 'person', 20),
  ('creator', 'مبتكر', 'Creator', 'person', 30),
  ('director', 'مخرج', 'Director', 'person', 40),
  ('writer', 'كاتب', 'Writer', 'person', 50),
  ('screenwriter', 'كاتب سيناريو', 'Screenwriter', 'person', 60),
  ('illustrator', 'رسام', 'Illustrator', 'person', 70),
  ('artist', 'فنان', 'Artist', 'person', 80),
  ('composer', 'ملحن', 'Composer', 'person', 90),
  ('editor', 'محرر', 'Editor', 'person', 100),
  ('translator', 'مترجم', 'Translator', 'person', 110),
  ('producer', 'منتج', 'Producer', 'any', 120),
  ('animation-studio', 'استوديو رسوم متحركة', 'Animation studio', 'organization', 130),
  ('production-company', 'شركة إنتاج', 'Production company', 'organization', 140),
  ('developer', 'مطوّر', 'Developer', 'organization', 150),
  ('publisher', 'ناشر', 'Publisher', 'organization', 160);--> statement-breakpoint

INSERT OR IGNORE INTO `person_profiles` (`entity_id`)
SELECT `id` FROM `entities` WHERE `entity_type` = 'person';--> statement-breakpoint

INSERT OR IGNORE INTO `organization_profiles` (`entity_id`, `organization_type`, `prominence`)
SELECT
  e.`id`,
  CASE
    WHEN EXISTS (SELECT 1 FROM `work_contributions` wc WHERE wc.`entity_id` = e.`id` AND wc.`role` = 'animation-studio') THEN 'studio'
    WHEN EXISTS (SELECT 1 FROM `work_contributions` wc WHERE wc.`entity_id` = e.`id` AND wc.`role` = 'publisher') THEN 'publisher'
    WHEN EXISTS (SELECT 1 FROM `work_contributions` wc WHERE wc.`entity_id` = e.`id` AND wc.`role` = 'production-company') THEN 'production-company'
    ELSE 'organization'
  END,
  CASE
    WHEN (SELECT COUNT(DISTINCT wc.`work_id`) FROM `work_contributions` wc WHERE wc.`entity_id` = e.`id`) >= 10 THEN 3
    WHEN (SELECT COUNT(DISTINCT wc.`work_id`) FROM `work_contributions` wc WHERE wc.`entity_id` = e.`id`) >= 5 THEN 2
    WHEN (SELECT COUNT(DISTINCT wc.`work_id`) FROM `work_contributions` wc WHERE wc.`entity_id` = e.`id`) >= 1 THEN 1
    ELSE 0
  END
FROM `entities` e
WHERE e.`entity_type` = 'organization';--> statement-breakpoint

INSERT OR IGNORE INTO `work_planet_assignments` (`work_id`, `planet_id`, `source`, `review_state`)
SELECT `id`, 'planet-adventure', 'migration-default', 'needs-review'
FROM `works`
WHERE `kind` IN ('movie', 'series', 'anime');--> statement-breakpoint

INSERT OR IGNORE INTO `work_risk_assessments` (`work_id`, `dimension_id`, `level`)
SELECT `id`, 'risk-sexuality', json_extract(`metadata`, '$.riskProfile.sexuality')
FROM `works`
WHERE json_extract(`metadata`, '$.riskProfile.sexuality') IN ('none', 'low', 'medium', 'high');--> statement-breakpoint
INSERT OR IGNORE INTO `work_risk_assessments` (`work_id`, `dimension_id`, `level`)
SELECT `id`, 'risk-behavioral', json_extract(`metadata`, '$.riskProfile.behavioral')
FROM `works`
WHERE json_extract(`metadata`, '$.riskProfile.behavioral') IN ('none', 'low', 'medium', 'high');--> statement-breakpoint
INSERT OR IGNORE INTO `work_risk_assessments` (`work_id`, `dimension_id`, `level`)
SELECT `id`, 'risk-theology', json_extract(`metadata`, '$.riskProfile.theology')
FROM `works`
WHERE json_extract(`metadata`, '$.riskProfile.theology') IN ('none', 'low', 'medium', 'high');--> statement-breakpoint

INSERT OR IGNORE INTO `search_documents` (`id`, `entity_type`, `entity_id`, `primary_text`, `secondary_text`, `keywords`, `image_path`)
SELECT
  'work:' || w.`id`,
  'work',
  w.`id`,
  w.`canonical_title`,
  COALESCE((SELECT group_concat(wt.`title`, ' ') FROM `work_titles` wt WHERE wt.`work_id` = w.`id`), ''),
  w.`kind` || ' ' || COALESCE(w.`summary`, ''),
  (SELECT a.`relative_path` FROM `assets` a WHERE a.`owner_type` = 'work' AND a.`owner_id` = w.`id` AND a.`asset_type` = 'poster' LIMIT 1)
FROM `works` w;--> statement-breakpoint

INSERT OR IGNORE INTO `search_documents` (`id`, `entity_type`, `entity_id`, `primary_text`, `secondary_text`, `keywords`, `image_path`)
SELECT
  CASE WHEN e.`entity_type` = 'person' THEN 'person:' ELSE 'studio:' END || e.`id`,
  CASE WHEN e.`entity_type` = 'person' THEN 'person' ELSE 'studio' END,
  e.`id`,
  e.`name`,
  COALESCE((SELECT group_concat(ea.`alias`, ' ') FROM `entity_aliases` ea WHERE ea.`entity_id` = e.`id`), ''),
  COALESCE(e.`description`, ''),
  (SELECT a.`relative_path` FROM `assets` a WHERE a.`owner_type` = 'entity' AND a.`owner_id` = e.`id` AND a.`asset_type` = 'profile' LIMIT 1)
FROM `entities` e;--> statement-breakpoint

INSERT OR IGNORE INTO `search_documents` (`id`, `entity_type`, `entity_id`, `primary_text`, `secondary_text`, `keywords`)
SELECT 'planet:' || `id`, 'planet', `id`, `name_ar`, COALESCE(`name_en`, ''), `description`
FROM `planets`;--> statement-breakpoint

CREATE VIRTUAL TABLE IF NOT EXISTS `search_documents_fts` USING fts5(
  `primary_text`,
  `secondary_text`,
  `keywords`,
  content='search_documents',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);--> statement-breakpoint
INSERT INTO `search_documents_fts`(`search_documents_fts`) VALUES ('rebuild');--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `search_documents_ai` AFTER INSERT ON `search_documents` BEGIN
  INSERT INTO `search_documents_fts`(`rowid`, `primary_text`, `secondary_text`, `keywords`)
  VALUES (new.`rowid`, new.`primary_text`, new.`secondary_text`, new.`keywords`);
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `search_documents_ad` AFTER DELETE ON `search_documents` BEGIN
  INSERT INTO `search_documents_fts`(`search_documents_fts`, `rowid`, `primary_text`, `secondary_text`, `keywords`)
  VALUES ('delete', old.`rowid`, old.`primary_text`, old.`secondary_text`, old.`keywords`);
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `search_documents_au` AFTER UPDATE ON `search_documents` BEGIN
  INSERT INTO `search_documents_fts`(`search_documents_fts`, `rowid`, `primary_text`, `secondary_text`, `keywords`)
  VALUES ('delete', old.`rowid`, old.`primary_text`, old.`secondary_text`, old.`keywords`);
  INSERT INTO `search_documents_fts`(`rowid`, `primary_text`, `secondary_text`, `keywords`)
  VALUES (new.`rowid`, new.`primary_text`, new.`secondary_text`, new.`keywords`);
END;
