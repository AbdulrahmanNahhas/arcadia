-- Keep one canonical spelling for each case-insensitive alias/language pair before
-- enforcing the normalized unique index. PostgreSQL considers NULLs distinct in the
-- legacy constraint, which allowed repeated aliases with no language.
DELETE FROM "title_aliases" AS duplicate
USING (
  SELECT id,
    row_number() OVER (
      PARTITION BY title_id, lower(btrim(title)), coalesce(language, '')
      ORDER BY is_preferred DESC, id
    ) AS row_number
  FROM "title_aliases"
) AS ranked
WHERE duplicate.id = ranked.id AND ranked.row_number > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX "title_alias_normalized_identity_uq" ON "title_aliases" USING btree ("title_id",lower(btrim("title")),coalesce("language", ''));
--> statement-breakpoint
-- CODE: White is a SPY x FAMILY film, not a stand-alone umbrella title. Preserve
-- its artwork, score, credits, aliases, taxonomy, and stricter classification
-- while moving its movie installment into the parent series chronologically.
DO $$
DECLARE
  parent_id uuid;
  child_id uuid;
BEGIN
  SELECT id INTO parent_id FROM titles WHERE canonical_title = 'SPY x FAMILY';
  SELECT id INTO child_id FROM titles WHERE canonical_title = 'SPY x FAMILY CODE: White';
  IF parent_id IS NULL OR child_id IS NULL OR parent_id = child_id THEN
    RETURN;
  END IF;

  UPDATE installments
  SET position = position + 1, updated_at = now()
  WHERE title_id = parent_id AND position >= 2;

  UPDATE installments AS installment
  SET
    title_id = parent_id,
    position = 2,
    audience_override = CASE WHEN child.audience IS DISTINCT FROM parent.audience THEN child.audience ELSE NULL END,
    age_override = CASE WHEN child.age IS DISTINCT FROM parent.age THEN child.age ELSE NULL END,
    sexuality_risk_override = CASE WHEN child.sexuality_risk IS DISTINCT FROM parent.sexuality_risk THEN child.sexuality_risk ELSE NULL END,
    behavioral_risk_override = CASE WHEN child.behavioral_risk IS DISTINCT FROM parent.behavioral_risk THEN child.behavioral_risk ELSE NULL END,
    theology_risk_override = CASE WHEN child.theology_risk IS DISTINCT FROM parent.theology_risk THEN child.theology_risk ELSE NULL END,
    updated_at = now()
  FROM titles AS parent, titles AS child
  WHERE installment.title_id = child_id AND parent.id = parent_id AND child.id = child_id;

  INSERT INTO title_aliases (title_id, title, language, script, is_preferred)
  SELECT parent_id, title, language, script, is_preferred FROM title_aliases WHERE title_id = child_id
  ON CONFLICT DO NOTHING;
  INSERT INTO title_aliases (title_id, title)
  VALUES (parent_id, 'SPY x FAMILY CODE: White')
  ON CONFLICT DO NOTHING;

  INSERT INTO title_genres (title_id, value_id)
  SELECT parent_id, value_id FROM title_genres WHERE title_id = child_id ON CONFLICT DO NOTHING;
  INSERT INTO title_tones (title_id, value_id)
  SELECT parent_id, value_id FROM title_tones WHERE title_id = child_id ON CONFLICT DO NOTHING;
  INSERT INTO title_tags (title_id, value_id)
  SELECT parent_id, value_id FROM title_tags WHERE title_id = child_id ON CONFLICT DO NOTHING;
  INSERT INTO title_countries (title_id, value_id)
  SELECT parent_id, value_id FROM title_countries WHERE title_id = child_id ON CONFLICT DO NOTHING;
  INSERT INTO title_planets (title_id, planet_id)
  SELECT parent_id, planet_id FROM title_planets WHERE title_id = child_id ON CONFLICT DO NOTHING;
  INSERT INTO contributions (title_id, entity_id, role_id, position, is_primary)
  SELECT parent_id, entity_id, role_id, position, is_primary FROM contributions WHERE title_id = child_id
  ON CONFLICT DO NOTHING;
  UPDATE external_identities SET owner_id = parent_id WHERE owner_type = 'title' AND owner_id = child_id;
  DELETE FROM title_relations WHERE source_title_id = child_id OR target_title_id = child_id;
  DELETE FROM titles WHERE id = child_id;
END $$;
--> statement-breakpoint
-- Populate runtimes for released films. Announced films intentionally remain null.
UPDATE installments
SET runtime_minutes = CASE title
  WHEN 'حكاية لعبة 5' THEN 101
  WHEN 'قاتل الشياطين: قلعة اللانهاية' THEN 155
  WHEN 'أنا الحقير 4' THEN 94
  WHEN 'لوك باك' THEN 58
  WHEN 'كونغ فو باندا 4' THEN 94
  WHEN 'هايكيو!!: معركة مكب النفايات' THEN 85
  WHEN 'سباي × فاميلي: كود وايت' THEN 110
  WHEN 'فندق ترانسلفانيا: تحوّلات الوحوش' THEN 87
  WHEN 'جوجوتسو كايسن 0' THEN 105
  WHEN 'قاتل الشياطين: قطار موغن' THEN 117
  WHEN 'فايوليت إيفرغاردن: الفيلم' THEN 140
  WHEN 'كيف تروض تنينك: العالم الخفي' THEN 104
  WHEN 'العصر الجليدي 5: مسار التصادم' THEN 94
  ELSE runtime_minutes
END,
updated_at = now()
WHERE kind = 'movie' AND status = 'released' AND runtime_minutes IS NULL;
