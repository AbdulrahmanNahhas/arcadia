-- Curated second pass for the remaining people. Credits are transferred before
-- duplicate removal, then each retained person's credits are replaced with the
-- explicitly approved list below.
UPDATE contributions c SET entity_id = target.id
FROM entities source, entities target
WHERE source.kind='person' AND target.kind='person'
  AND source.name='Frances Eliza Burnett' AND target.name='Frances Hodgson Burnett'
  AND c.entity_id=source.id
  AND NOT EXISTS (
    SELECT 1 FROM contributions existing
    WHERE existing.title_id=c.title_id AND existing.entity_id=target.id AND existing.role_id=c.role_id
  );
--> statement-breakpoint
DELETE FROM contributions c USING entities source
WHERE source.kind='person' AND source.name='Frances Eliza Burnett' AND c.entity_id=source.id;
--> statement-breakpoint
UPDATE entities SET name='Hitomi Koto', sort_name='hitomi koto', updated_at=now()
WHERE kind='person' AND name='Hitomi Kotou';
--> statement-breakpoint
DELETE FROM entities WHERE kind='person' AND name IN (
  'Afro','Akihito Tsukushi','Akiyuki Tateyama','Alexandre Dumas','Charles Lutwidge Dodgson',
  'Charles Perrault','Hajime Yatate','Hans Christian Andersen','Hideo Takayashiki','Hideyuki Kurata',
  'Ito Nakamori','Jeanne-Marie Leprince de Beaumont','Jin Tanaka','Jonathan Swift','Kevin Penkin',
  'Lyman Baum','Masayuki Kojima','Rina Tayama','RADWIMPS','Yoshiaki Kyougoku','Robert Stevenson',
  'Jacob and Wilhelm Grimm','Aesop','Albert Barillé','Eiji Okabe','Fumiko Shiba','Gou Nagai',
  'Hajime Kamegaki','Haruka Nakamura','Hideo Nishimaki','Hector Malot','Hiroshi Watanabe',
  'Jean de Brunhoff','Hisayuki Toriumi','Johanna Spyri','Keiji Hayakawa','Kouichi Mashimo',
  'Kouhei Tanaka','Kazuma Jinnouchi','Makoto Miyazaki','Minako Seki','Yasuharu Takanashi',
  'Yasunori Mitsuda','Yoshihisa Hirano','Yuka Kitamura','Yutaka Yamada','Yuugo Kanno',
  'Shuuji Iuchi','Ritsuko Kawai','Hitomi Koto','Frances Eliza Burnett'
);
--> statement-breakpoint
UPDATE entities SET name='Fujiko F. Fujio', sort_name='fujiko f. fujio', updated_at=now()
WHERE kind='person' AND name='F. Fujio Fujiko';
--> statement-breakpoint
UPDATE entities SET name='Hikaru Kondo', sort_name='hikaru kondo', updated_at=now()
WHERE kind='person' AND name='Hikaru Kondou';
--> statement-breakpoint
UPDATE entities SET name='Yuuto Suzuki', sort_name='yuuto suzuki', updated_at=now()
WHERE kind='person' AND name='Yuuto  Suzuki';
--> statement-breakpoint
CREATE TEMP TABLE approved_people_credits (
  person_name text NOT NULL,
  canonical_title text NOT NULL,
  role_slug text NOT NULL,
  PRIMARY KEY (person_name, canonical_title, role_slug)
);
--> statement-breakpoint
INSERT INTO approved_people_credits (person_name, canonical_title, role_slug) VALUES
  ('Asato Asato','86 EIGHTY-SIX','original_author'),
  ('Atsuhiro Tomioka','Inazuma Eleven','writer'),('Atsuhiro Tomioka','LBX: Little Battlers eXperience','writer'),
  ('Ayumu Watanabe','Witch Hat Atelier','director'),('Budge Wilson','Hello Anne: Before Green Gables','original_author'),
  ('Eiichirou Oda','The One Piece','original_author'),('Akiko Nogi','LONA','creator'),('Akiko Nogi','LONA','writer'),
  ('Eiji Umehara','Vivy -Fluorite Eye''s Song-','creator'),('Eiji Umehara','Vivy -Fluorite Eye''s Song-','writer'),
  ('Eleanor Porter','The Story of Pollyanna, Girl of Love','original_author'),('Fujiko F. Fujio','Doraemon (2005)','original_author'),
  ('Fumihiko Shimo','Talentless Nana','writer'),('Haruichi Furudate','Haikyuu!!','original_author'),
  ('Haruo Sotozaki','Demon Slayer: Kimetsu no Yaiba','director'),('Hikaru Kondo','Demon Slayer: Kimetsu no Yaiba','producer'),
  ('Hiroaki Sakurai','Les Misérables: Shoujo Cosette','director'),('Hiroshi Fukutomi','The Marshmallow Times','director'),
  ('Hiroshi Kawamata','Anne Shirley','director'),('Hiroshi Koujina','Hunter × Hunter','director'),
  ('Hiroyoshi Mitsunobu','Captain Tsubasa','director'),('Joe Ksander','Next Gen','director'),('Joe Ksander','Next Gen','writer'),
  ('Kamome Shirahama','Witch Hat Atelier','original_author'),('Kana Akatsuki','Violet Evergarden','original_author'),('Kana Akatsuki','Violet Evergarden: the Movie','original_author'),
  ('Katsuhito Akiyama','Inazuma Eleven','director'),('Katsuyoshi Yatabe','Hello Anne: Before Green Gables','director'),('Katsuyoshi Yatabe','Muka Muka Paradise','director'),
  ('Kenichi Shimizu','Orb: On the Movements of the Earth','director'),('Kevin R. Adams','Next Gen','director'),('Kevin R. Adams','Next Gen','writer'),
  ('Kimiko Ueno','Delicious in Dungeon','writer'),('Kiyotaka Oshiyama','LOOK BACK','director'),('Kiyotaka Oshiyama','LOOK BACK','writer'),
  ('Koyoharu Gotouge','Demon Slayer: Kimetsu no Yaiba','original_author'),('Kunihisa Sugishima','Beyblade: Metal Fusion','director'),
  ('Laurent de Brunhoff','Babar','original_author'),('Lun Lun Yamamoto','The Marshmallow Times','original_author'),
  ('Makoto Yukimura','Vinland Saga','original_author'),('Maria Augusta von Trapp','Trapp Family Story','original_author'),
  ('Marimo Ragawa','Baby & Me','original_author'),('Mark Twain','The Adventures of Tom Sawyer','original_author'),
  ('Masaki Watanabe','SAKAMOTO DAYS','director'),('Masashi Koizuka','Attack on Titan','director'),('Masashi Koizuka','The One Piece','director'),
  ('Matsuri Isora','Secrets of the Silent Witch','original_author'),('Michihiro Tsuchiya','The Bugle Call: Song of War','writer'),
  ('Michiru Shimada','Hamtaro','writer'),('Michiru Shimada','Hello Anne: Before Green Gables','writer'),('Michiru Shimada','Little Women II: Jo’s Boys','writer'),('Michiru Shimada','Romeo and the Black Brothers','writer'),
  ('Mitsuteru Yokoyama','Romance of the Three Kingdoms','original_author'),('Naohito Takahashi','LBX: Little Battlers eXperience','director'),
  ('Naoko Yamada','A Silent Voice','director'),('Niisan Takahashi','Arabian Nights: Sinbad’s Adventures','writer'),('Niisan Takahashi','Maya the Bee','writer'),
  ('Nobutaka Nishizawa','Dragon Quest: The Adventure of Dai','director'),('Norio Nitta','Cocotama','director'),
  ('Osamu Dezaki','Fairy Tales of the World','director'),('Osamu Dezaki','Treasure Island','director'),('Osamu Nabeshima','Hamtaro','director'),
  ('Raymond Jafelice','Babar','director'),('Robert Louis Stevenson','Treasure Island','original_author'),('Ryouko Kui','Delicious in Dungeon','original_author'),
  ('Ryuuzou Nakanishi','Arabian Nights: Sinbad’s Adventures','writer'),('Ryuuzou Nakanishi','Princess Sara / Little Princess Sara','writer'),
  ('Shingo Irie','Orb: On the Movements of the Earth','writer'),('Shinji Ishihira','Talentless Nana','director'),
  ('Shinya Watada','The Bugle Call: Song of War','director'),('Shuuhei Yabuta','Vinland Saga','director'),
  ('Sousuke Touka','Ranking of Kings','original_author'),('Susumu Mitsunaka','Haikyuu!!','director'),
  ('Taichi Ishidate','Violet Evergarden','director'),('Taichi Ishidate','Violet Evergarden: the Movie','director'),
  ('Takahiro Oomori','Baby & Me','director'),('Takaomi Kanasaki','Secrets of the Silent Witch','director'),('Takaomi Kanasaki','Secrets of the Silent Witch','writer'),
  ('Takashi Katagiri','LONA','director'),('Takeru Hokazono','Kagurabachi','original_author'),('Tatsuya Endou','SPY x FAMILY','original_author'),
  ('Tetsuya Takeuchi','Kagurabachi','director'),('Tomoharu Katsumata','UFO Robot Grendizer','director'),
  ('Tomohiko Itou','Sword Art Online','director'),('Tomohiro Suzuki','One-Punch Man','writer'),
  ('Tomoko Konparu','Les Misérables: Shoujo Cosette','writer'),('Toshimasa Ishii','86 EIGHTY-SIX','director'),
  ('Toshio Kawaguchi','PLUTO','director'),('Tsuneo Komuro','Once Upon a Time... Life','director'),
  ('Uoto','Orb: On the Movements of the Earth','original_author'),('Victor Hugo','Les Misérables: Shoujo Cosette','original_author'),
  ('Wang Nima','Next Gen','original_author'),('Wang Nima','Next Gen','writer'),('Wilhelm Grimm','Grimm’s Fairy Tale Classics','original_author'),
  ('Yoshihiro Miyajima','Delicious in Dungeon','director'),('Yoshihiro Togashi','Hunter × Hunter','original_author'),
  ('Yoshitoki Ooima','A Silent Voice','original_author'),('Youichi Takahashi','Captain Tsubasa','original_author'),
  ('Yuuki Tabata','Black Clover','original_author'),('Yuuto Suzuki','SAKAMOTO DAYS','original_author');
--> statement-breakpoint
INSERT INTO entities (kind, name, sort_name, description)
SELECT DISTINCT 'person'::entity_kind, person_name, lower(person_name), '' FROM approved_people_credits
ON CONFLICT (kind, sort_name) DO UPDATE SET name=EXCLUDED.name, updated_at=now();
--> statement-breakpoint
DELETE FROM contributions c USING entities person
WHERE person.kind='person' AND person.name IN (SELECT DISTINCT person_name FROM approved_people_credits)
  AND c.entity_id=person.id;
--> statement-breakpoint
INSERT INTO contributions (title_id, entity_id, role_id, position, is_primary)
SELECT work.id, person.id, role.id, 0, false
FROM approved_people_credits approved
JOIN entities person ON person.kind='person' AND person.name=approved.person_name
JOIN titles work ON work.canonical_title=approved.canonical_title
JOIN roles role ON role.slug=approved.role_slug
ON CONFLICT (title_id, entity_id, role_id) DO NOTHING;
--> statement-breakpoint
DROP TABLE approved_people_credits;
