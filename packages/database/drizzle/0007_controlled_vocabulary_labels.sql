CREATE TABLE IF NOT EXISTS "vocabulary_labels" (
  "vocabulary" text NOT NULL, "value" text NOT NULL, "label_en" text NOT NULL,
  "label_ar" text NOT NULL, "description_en" text NOT NULL DEFAULT '',
  "description_ar" text NOT NULL DEFAULT '', "position" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  PRIMARY KEY ("vocabulary", "value"),
  CONSTRAINT "vocabulary_labels_vocabulary_check" CHECK ("vocabulary" in ('audiences','ages','risk-levels','release-statuses')),
  CONSTRAINT "vocabulary_labels_position_check" CHECK ("position" >= 0)
);
INSERT INTO vocabulary_labels (vocabulary, value, label_en, label_ar, position) VALUES
  ('audiences','general','General','عام',0), ('audiences','teen','Teen','يافعون',1), ('audiences','young-adult','Young Adult','شباب',2), ('audiences','adult','Adult','بالغون',3),
  ('ages','all','All','للجميع',0), ('ages','7+','7+','٧+',1), ('ages','10+','10+','١٠+',2), ('ages','13+','13+','١٣+',3), ('ages','16+','16+','١٦+',4), ('ages','18+','18+','١٨+',5),
  ('risk-levels','none','None','لا يوجد',0), ('risk-levels','low','Low','منخفض',1), ('risk-levels','medium','Medium','متوسط',2), ('risk-levels','high','High','مرتفع',3),
  ('release-statuses','announced','Announced','معلن',0), ('release-statuses','airing','Airing','يعرض الآن',1), ('release-statuses','completed','Completed','مكتمل',2), ('release-statuses','unknown','Unknown','غير معروف',3)
ON CONFLICT DO NOTHING;
