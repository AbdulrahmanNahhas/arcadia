-- Complete the catalog's high-signal organization and person credits.  This is
-- deliberately additive for people and keeps publisher/distributor relationships
-- limited to the curated, recurring sources.
UPDATE entities SET name='CoMix Wave Films', sort_name='comix wave films', updated_at=now()
WHERE kind='organization' AND name='CoMix Wave';
--> statement-breakpoint
UPDATE entities SET name='Shochiku', sort_name='shochiku', updated_at=now()
WHERE kind='organization' AND name='Shouchiku';
--> statement-breakpoint
UPDATE contributions c SET entity_id=target.id
FROM entities source, entities target
WHERE source.kind='organization' AND target.kind='organization'
  AND source.name='Pierrot' AND target.name='Studio Pierrot'
  AND c.entity_id=source.id
  AND NOT EXISTS (
    SELECT 1 FROM contributions existing
    WHERE existing.title_id=c.title_id AND existing.entity_id=target.id AND existing.role_id=c.role_id
  );
--> statement-breakpoint
DELETE FROM contributions c USING entities source
WHERE source.kind='organization' AND source.name='Pierrot' AND c.entity_id=source.id;
--> statement-breakpoint
DELETE FROM entities WHERE kind='organization' AND name='Pierrot';
--> statement-breakpoint
UPDATE contributions c SET role_id=role.id
FROM entities organization, roles role
WHERE organization.kind='organization' AND organization.name='Spacetoon'
  AND role.slug='distributor' AND c.entity_id=organization.id;
--> statement-breakpoint
UPDATE contributions c SET role_id=role.id
FROM titles work, entities organization, roles role
WHERE work.canonical_title='The Lion King' AND organization.name='Walt Disney Pictures'
  AND role.slug='production_company' AND c.title_id=work.id AND c.entity_id=organization.id;
--> statement-breakpoint
UPDATE contributions c SET role_id=role.id
FROM titles work, entities organization, roles role
WHERE work.canonical_title='The Angry Birds Movie' AND organization.name='Rovio Animation'
  AND role.slug='production_company' AND c.title_id=work.id AND c.entity_id=organization.id;
--> statement-breakpoint
UPDATE contributions c SET role_id=role.id
FROM titles work, entities organization, roles role
WHERE work.canonical_title='The LEGO Movie' AND organization.name='Warner Animation Group'
  AND role.slug='production_company' AND c.title_id=work.id AND c.entity_id=organization.id;
--> statement-breakpoint
UPDATE contributions c SET role_id=role.id
FROM titles work, entities organization, roles role
WHERE work.canonical_title='Flow' AND organization.name='Sacrebleu Productions'
  AND role.slug='production_company' AND c.title_id=work.id AND c.entity_id=organization.id;
--> statement-breakpoint
UPDATE contributions c SET role_id=role.id
FROM titles work, entities organization, roles role
WHERE work.canonical_title IN ('SAKAMOTO DAYS','The One Piece') AND organization.name='Shueisha'
  AND role.slug='publisher' AND c.title_id=work.id AND c.entity_id=organization.id;
--> statement-breakpoint
UPDATE contributions c SET role_id=role.id
FROM titles work, entities organization, roles role
WHERE work.canonical_title='Orb: On the Movements of the Earth' AND organization.name='Shogakukan'
  AND role.slug='publisher' AND c.title_id=work.id AND c.entity_id=organization.id;
--> statement-breakpoint
UPDATE contributions c SET role_id=role.id
FROM titles work, entities organization, roles role
WHERE work.canonical_title='The One Piece' AND organization.name='Netflix'
  AND role.slug='distributor' AND c.title_id=work.id AND c.entity_id=organization.id;
--> statement-breakpoint
UPDATE contributions c SET role_id=role.id
FROM titles work, entities organization, roles role
WHERE work.canonical_title='Black Clover' AND organization.name IN ('Funimation','Crunchyroll')
  AND role.slug='distributor' AND c.title_id=work.id AND c.entity_id=organization.id;
--> statement-breakpoint
UPDATE contributions c SET role_id=role.id
FROM titles work, entities organization, roles role
WHERE work.canonical_title='One-Punch Man' AND organization.name='Viz Media'
  AND role.slug='distributor' AND c.title_id=work.id AND c.entity_id=organization.id;
--> statement-breakpoint
UPDATE contributions c SET role_id=role.id
FROM titles work, entities organization, roles role
WHERE work.canonical_title='Vivy -Fluorite Eye''s Song-' AND organization.name='Aniplex of America'
  AND role.slug='distributor' AND c.title_id=work.id AND c.entity_id=organization.id;
--> statement-breakpoint
DELETE FROM contributions c USING titles work, entities organization
WHERE c.title_id=work.id AND c.entity_id=organization.id
  AND ((work.canonical_title='Belle and Sebastian' AND organization.name='TOHO Animation')
    OR (work.canonical_title='InuYasha' AND organization.name='Kyoto Animation')
    OR (work.canonical_title='The Bugle Call: Song of War' AND organization.name='CyberAgent'));
--> statement-breakpoint
CREATE TEMP TABLE approved_organization_credits (
  organization_name text NOT NULL,
  canonical_title text NOT NULL,
  role_slug text NOT NULL,
  PRIMARY KEY (organization_name, canonical_title, role_slug)
);
--> statement-breakpoint
INSERT INTO approved_organization_credits (organization_name, canonical_title, role_slug) VALUES
  ('A-1 Pictures','Solo Leveling','animation_studio'),('A-1 Pictures','Kaguya-sama: Love Is War','animation_studio'),('A-1 Pictures','Sword Art Online the Movie: Integral Domain','animation_studio'),
  ('BONES','My Hero Academia','animation_studio'),('BONES','Fullmetal Alchemist: Brotherhood','animation_studio'),('BONES','Mob Psycho 100','animation_studio'),
  ('BONES FILM','Gachiakuta','animation_studio'),('BONES FILM','Fate Rewinder','animation_studio'),
  ('CloverWorks','The Fragrant Flower Blooms With Dignity','animation_studio'),('CloverWorks','Bocchi the Rock!','animation_studio'),('CloverWorks','The Promised Neverland','animation_studio'),('CloverWorks','Horimiya','animation_studio'),
  ('CoMix Wave Films','Your Name','animation_studio'),('CoMix Wave Films','Weathering with You','animation_studio'),
  ('MADHOUSE','Monster','animation_studio'),('MADHOUSE','Frieren: Beyond Journey''s End','animation_studio'),('MADHOUSE','My Love Story with Yamada-kun at Lv999','animation_studio'),('MADHOUSE','Death Note','animation_studio'),('MADHOUSE','ghost (Working Title)','animation_studio'),
  ('MAPPA','Jujutsu Kaisen','animation_studio'),('MAPPA','Chainsaw Man','animation_studio'),('MAPPA','Attack on Titan','animation_studio'),
  ('OLM','ODDTAXI','animation_studio'),('OLM','Summertime Render','animation_studio'),('OLM','The Apothecary Diaries','animation_studio'),
  ('WHITE FOX','Re:Zero − Starting Life in Another World','animation_studio'),('WHITE FOX','Steins;Gate','animation_studio'),
  ('Lerche','Classroom of the Elite','animation_studio'),('Lerche','Toilet-bound Hanako-kun','animation_studio'),
  ('Titmouse','Pantheon','animation_studio'),('Titmouse','Scavengers Reign','animation_studio'),
  ('ufotable','Genshin Impact Animation Project','animation_studio'),('ufotable','Witch on the Holy Night','animation_studio'),
  ('Fortiche Production','Arcane','animation_studio'),('Orange','Land of the Lustrous','animation_studio'),('feel.','Remake Our Life!','animation_studio'),
  ('JM Animation','Avatar: The Last Airbender','animation_studio'),('DR Movie','Avatar: The Last Airbender','animation_studio'),('MOI Animation','Avatar: The Last Airbender','animation_studio'),
  ('ENISHIYA','Takopi’s Original Sin: Thank You, See You Tomorrow','animation_studio'),('Skybound Animation','Invincible','animation_studio'),('Maven Image Platform','Invincible','animation_studio'),
  ('Telecom Animation Film','Blue Box','animation_studio'),('CLAP','WASTED CHEF','animation_studio'),('Production I.G','Kaiju No. 8','animation_studio'),('Doga Kobo','Oshi No Ko','animation_studio'),('OUTLINE','THE RIBBON HERO','animation_studio'),
  ('P.I.C.S.','ODDTAXI','animation_studio'),('Seven Arcs','TONIKAWA: Over The Moon For You','animation_studio'),('Kinema Citrus','My Happy Marriage','animation_studio'),('Pixar','Cars','animation_studio'),('Qzil.la','Sekiro: No Defeat','animation_studio'),('P.A. Works','Charlotte','animation_studio'),
  ('Kamikaze Douga','Ghost of Tsushima: Legends','animation_studio'),('WIT Studio','Attack on Titan','animation_studio'),('Psyde Kick Studio','Sword Art Online the Movie: Integral Domain','animation_studio'),('The SPA Studios','Klaus','animation_studio'),('Nippon Animation','Muka Muka Paradise','animation_studio'),('TOHO animation STUDIO','The Apothecary Diaries','animation_studio'),
  ('MPC','The Lion King','animation_studio'),('Sony Pictures Imageworks','The Angry Birds Movie','animation_studio'),('Animal Logic','The LEGO Movie','animation_studio'),('Dream Well Studio','Flow','animation_studio'),('MK Company','Belle and Sebastian','animation_studio'),('Visual 80','Belle and Sebastian','animation_studio'),
  ('Riot Games','Arcane','production_company'),('Nickelodeon Animation Studio','Avatar: The Last Airbender','production_company'),('Amazon MGM Studios','Invincible','production_company'),('AMC Studios','Pantheon','production_company'),('Twin Engine','THE RIBBON HERO','production_company'),('HoYoverse','Genshin Impact Animation Project','production_company'),('Green Street Pictures','Scavengers Reign','production_company'),('ARCH','Sekiro: No Defeat','production_company'),('Bandai Namco Filmworks','ghost (Working Title)','production_company'),('Aniplex','Ghost of Tsushima: Legends','production_company'),('PlayStation Productions','Ghost of Tsushima: Legends','production_company'),('Story Inc.','Fate Rewinder','production_company'),('Aniplex','Sword Art Online the Movie: Integral Domain','production_company'),('Atresmedia Cine','Klaus','production_company'),('TOHO','Belle and Sebastian','production_company'),
  ('Netflix','Arcane','distributor'),('Prime Video','Invincible','distributor'),('Netflix','THE RIBBON HERO','distributor'),('Max','Scavengers Reign','distributor'),('ANIMEC','Sekiro: No Defeat','distributor'),('Crunchyroll','Ghost of Tsushima: Legends','distributor'),('ANIMEC','Sword Art Online the Movie: Integral Domain','distributor'),('Netflix','Klaus','distributor'),('Shochiku','WASTED CHEF','distributor'),('KADOKAWA Animation','WASTED CHEF','distributor'),
  ('Shueisha','Black Clover','publisher'),('Shueisha','Blue Box','publisher'),('Shueisha','Captain Tsubasa','publisher'),('Shueisha','Chainsaw Man','publisher'),('Shueisha','Death Note','publisher'),('Shueisha','Dragon Quest: The Adventure of Dai','publisher'),('Shueisha','Haikyuu!!','publisher'),('Shueisha','Hunter × Hunter','publisher'),('Shueisha','Jujutsu Kaisen','publisher'),('Shueisha','Kagurabachi','publisher'),('Shueisha','Kaiju No. 8','publisher'),('Shueisha','Kaguya-sama: Love Is War','publisher'),('Shueisha','LOOK BACK','publisher'),('Shueisha','My Hero Academia','publisher'),('Shueisha','One-Punch Man','publisher'),('Shueisha','Oshi No Ko','publisher'),('Shueisha','SAKAMOTO DAYS','publisher'),('Shueisha','SPY x FAMILY','publisher'),('Shueisha','Summertime Render','publisher'),('Shueisha','Takopi’s Original Sin: Thank You, See You Tomorrow','publisher'),('Shueisha','The One Piece','publisher'),('Shueisha','The Promised Neverland','publisher'),
  ('Shogakukan','Beyblade: Metal Fusion','publisher'),('Shogakukan','Detective Conan / Case Closed','publisher'),('Shogakukan','Doraemon (2005)','publisher'),('Shogakukan','Fate Rewinder','publisher'),('Shogakukan','Frieren: Beyond Journey''s End','publisher'),('Shogakukan','Inazuma Eleven','publisher'),('Shogakukan','InuYasha','publisher'),('Shogakukan','LBX: Little Battlers eXperience','publisher'),('Shogakukan','Mob Psycho 100','publisher'),('Shogakukan','Monster','publisher'),('Shogakukan','Muka Muka Paradise','publisher'),('Shogakukan','Orb: On the Movements of the Earth','publisher'),('Shogakukan','PLUTO','publisher'),('Shogakukan','The Marshmallow Times','publisher'),('Shogakukan','TONIKAWA: Over The Moon For You','publisher'),
  ('Kadokawa','86 EIGHTY-SIX','publisher'),('Kadokawa','Classroom of the Elite','publisher'),('Kadokawa','Delicious in Dungeon','publisher'),('Kadokawa','My Happy Marriage','publisher'),('Kadokawa','My Love Story with Yamada-kun at Lv999','publisher'),('Kadokawa','Ranking of Kings','publisher'),('Kadokawa','Re:Zero − Starting Life in Another World','publisher'),('Kadokawa','Remake Our Life!','publisher'),('Kadokawa','Secrets of the Silent Witch','publisher'),('Kadokawa','Sword Art Online','publisher'),('Kadokawa','Sword Art Online the Movie: Integral Domain','publisher'),
  ('Kodansha','A Silent Voice','publisher'),('Kodansha','Attack on Titan','publisher'),('Kodansha','Gachiakuta','publisher'),('Kodansha','Land of the Lustrous','publisher'),('Kodansha','The Fragrant Flower Blooms With Dignity','publisher'),('Kodansha','Vinland Saga','publisher'),('Kodansha','Witch Hat Atelier','publisher'),
  ('Square Enix','Fullmetal Alchemist: Brotherhood','publisher'),('Square Enix','Horimiya','publisher'),('Square Enix','Talentless Nana','publisher'),('Square Enix','Toilet-bound Hanako-kun','publisher');
--> statement-breakpoint
INSERT INTO entities (kind, name, sort_name, description)
SELECT DISTINCT 'organization'::entity_kind, organization_name, lower(organization_name), ''
FROM approved_organization_credits
ON CONFLICT (kind, sort_name) DO UPDATE SET name=EXCLUDED.name, updated_at=now();
--> statement-breakpoint
INSERT INTO contributions (title_id, entity_id, role_id, position, is_primary)
SELECT work.id, organization.id, role.id, 0, false
FROM approved_organization_credits approved
JOIN entities organization ON organization.kind='organization' AND organization.name=approved.organization_name
JOIN titles work ON work.canonical_title=approved.canonical_title
JOIN roles role ON role.slug=approved.role_slug
ON CONFLICT (title_id, entity_id, role_id) DO NOTHING;
--> statement-breakpoint
DROP TABLE approved_organization_credits;
--> statement-breakpoint
CREATE TEMP TABLE approved_person_credits (
  person_name text NOT NULL,
  canonical_title text NOT NULL,
  role_slug text NOT NULL,
  PRIMARY KEY (person_name, canonical_title, role_slug)
);
--> statement-breakpoint
INSERT INTO approved_person_credits (person_name, canonical_title, role_slug) VALUES
  ('Hiroshi Seko','Chainsaw Man','writer'),('Hiroshi Seko','Gachiakuta','writer'),('Evan Call','My Happy Marriage','composer'),
  ('Makoto Shinkai','Your Name','creator'),('Makoto Shinkai','Your Name','director'),('Makoto Shinkai','Your Name','writer'),('Makoto Shinkai','Weathering with You','creator'),('Makoto Shinkai','Weathering with You','director'),('Makoto Shinkai','Weathering with You','writer'),
  ('Genki Kawamura','Your Name','producer'),('Genki Kawamura','Weathering with You','producer'),
  ('Yasuhiro Nakanishi','Kaguya-sama: Love Is War','writer'),('Yasuhiro Nakanishi','My Love Story with Yamada-kun at Lv999','writer'),('Yasuhiro Nakanishi','Toilet-bound Hanako-kun','writer'),
  ('Shingo Adachi','WASTED CHEF','character_designer'),('Shingo Adachi','Sword Art Online the Movie: Integral Domain','director'),('Tetsurō Araki','Death Note','director'),('Keiichirō Saitō','Bocchi the Rock!','director'),('Kensuke Ushio','Chainsaw Man','composer'),('Toshiya Oono','The Promised Neverland','writer'),('Naoki Urasawa','Monster','original_author'),('Tatsuki Fujimoto','Chainsaw Man','original_author'),('Aka Akasaka','Kaguya-sama: Love Is War','original_author'),('Tappei Nagatsuki','Re:Zero − Starting Life in Another World','original_author'),('Reki Kawahara','Sword Art Online the Movie: Integral Domain','original_author'),
  ('Sergio Pablos','Klaus','creator'),('Sergio Pablos','Klaus','director'),('Sergio Pablos','Klaus','writer'),('Shingo Natsume','ghost (Working Title)','creator'),('Shingo Natsume','ghost (Working Title)','director'),('Masayoshi Tanaka','Your Name','character_designer'),('Masayoshi Tanaka','Weathering with You','character_designer'),('Osamu Tezuka','THE RIBBON HERO','original_author'),('John Lasseter','Big Hero 6','executive_producer'),('John Lasseter','Zootopia','executive_producer'),('Andrew Stanton','Up','executive_producer');
--> statement-breakpoint
INSERT INTO contributions (title_id, entity_id, role_id, position, is_primary)
SELECT work.id, person.id, role.id, 0, false
FROM approved_person_credits approved
JOIN entities person ON person.kind='person' AND person.name=approved.person_name
JOIN titles work ON work.canonical_title=approved.canonical_title
JOIN roles role ON role.slug=approved.role_slug
ON CONFLICT (title_id, entity_id, role_id) DO NOTHING;
--> statement-breakpoint
DROP TABLE approved_person_credits;
