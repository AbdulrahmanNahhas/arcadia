-- Curated credits supplied for the current catalog. This is additive for people,
-- and replaces credits only for the listed person/work pairs so unrelated credits
-- remain untouched. Rows for titles not yet in the catalog are intentionally skipped.
CREATE TEMP TABLE requested_people_credits (
  person_name text NOT NULL,
  canonical_title text NOT NULL,
  role_slug text NOT NULL,
  PRIMARY KEY (person_name, canonical_title, role_slug)
);
--> statement-breakpoint
INSERT INTO requested_people_credits (person_name, canonical_title, role_slug) VALUES
  ('Hayao Miyazaki','Heidi, Girl of the Alps','scene_design'), ('Hayao Miyazaki','Future Boy Conan','director'), ('Hayao Miyazaki','Anne of Green Gables','scene_design'), ('Hayao Miyazaki','Castle in the Sky','director'), ('Hayao Miyazaki','Castle in the Sky','writer'), ('Hayao Miyazaki','My Neighbor Totoro','director'), ('Hayao Miyazaki','My Neighbor Totoro','writer'), ('Hayao Miyazaki','Kiki''s Delivery Service','director'), ('Hayao Miyazaki','Kiki''s Delivery Service','writer'), ('Hayao Miyazaki','Whisper of the Heart','writer'), ('Hayao Miyazaki','Ponyo','director'), ('Hayao Miyazaki','Ponyo','writer'), ('Hayao Miyazaki','The Secret World of Arrietty','writer'),
  ('John Lasseter','Toy Story','director'), ('John Lasseter','Toy Story','writer'), ('John Lasseter','Monsters, Inc.','executive_producer'), ('John Lasseter','The Incredibles','executive_producer'), ('John Lasseter','Cars','director'), ('John Lasseter','Cars','writer'), ('John Lasseter','Ratatouille','executive_producer'), ('John Lasseter','Up','executive_producer'), ('John Lasseter','Monsters University','executive_producer'), ('John Lasseter','Inside Out','executive_producer'), ('John Lasseter','Coco','executive_producer'),
  ('Hiroshi Seko','Attack on Titan','writer'), ('Hiroshi Seko','Jujutsu Kaisen','writer'), ('Hiroshi Seko','Mob Psycho 100','writer'), ('Hiroshi Seko','Vinland Saga','writer'),
  ('Michael Giacchino','The Incredibles','composer'), ('Michael Giacchino','Ratatouille','composer'), ('Michael Giacchino','Up','composer'), ('Michael Giacchino','Inside Out','composer'), ('Michael Giacchino','Coco','composer'), ('Michael Giacchino','Zootopia','composer'),
  ('Pete Docter','Toy Story','writer'), ('Pete Docter','Monsters, Inc.','director'), ('Pete Docter','Monsters, Inc.','writer'), ('Pete Docter','Up','director'), ('Pete Docter','Up','writer'), ('Pete Docter','Monsters University','executive_producer'), ('Pete Docter','Inside Out','director'), ('Pete Docter','Inside Out','writer'),
  ('Andrew Stanton','Toy Story','writer'), ('Andrew Stanton','Monsters, Inc.','writer'), ('Andrew Stanton','Monsters, Inc.','executive_producer'), ('Andrew Stanton','Ratatouille','executive_producer'), ('Andrew Stanton','Monsters University','executive_producer'), ('Andrew Stanton','Inside Out','executive_producer'),
  ('Hans Zimmer','The Lion King','composer'), ('Hans Zimmer','Madagascar','composer'), ('Hans Zimmer','Kung Fu Panda','composer'), ('Hans Zimmer','The Boss Baby','composer'), ('Hans Zimmer','The Boss Baby: Family Business','composer'),
  ('Kouzou Kusuba','The Story of Pollyanna, Girl of Love','director'), ('Kouzou Kusuba','Trapp Family Story','director'), ('Kouzou Kusuba','Little Women II: Jo''s Boys','director'), ('Kouzou Kusuba','Romeo and the Black Brothers','director'),
  ('Joe Hisaishi','Castle in the Sky','composer'), ('Joe Hisaishi','My Neighbor Totoro','composer'), ('Joe Hisaishi','Kiki''s Delivery Service','composer'), ('Joe Hisaishi','Ponyo','composer'),
  ('Randy Newman','Toy Story','composer'), ('Randy Newman','Monsters, Inc.','composer'), ('Randy Newman','Cars','composer'), ('Randy Newman','Monsters University','composer'),
  ('Evan Call','Violet Evergarden','composer'), ('Evan Call','Violet Evergarden: the Movie','composer'), ('Evan Call','Frieren: Beyond Journey''s End','composer'),
  ('Hiroyuki Sawano','Attack on Titan','composer'), ('Hiroyuki Sawano','86 EIGHTY-SIX','composer'), ('Hiroyuki Sawano','Solo Leveling','composer'),
  ('Guillermo del Toro','Trollhunters: Tales of Arcadia','creator'), ('Guillermo del Toro','Trollhunters: Tales of Arcadia','executive_producer'), ('Guillermo del Toro','3Below: Tales of Arcadia','creator'), ('Guillermo del Toro','3Below: Tales of Arcadia','executive_producer'), ('Guillermo del Toro','Wizards: Tales of Arcadia','creator'), ('Guillermo del Toro','Wizards: Tales of Arcadia','executive_producer'),
  ('Tom McGrath','Madagascar','director'), ('Tom McGrath','Madagascar','writer'), ('Tom McGrath','The Boss Baby','director'), ('Tom McGrath','The Boss Baby: Family Business','director'), ('Tom McGrath','The Boss Baby: Family Business','writer'),
  ('Lee Unkrich','Monsters, Inc.','director'), ('Lee Unkrich','Monsters University','executive_producer'), ('Lee Unkrich','Coco','director'), ('Lee Unkrich','Coco','writer'),
  ('Darla K. Anderson','Monsters, Inc.','producer'), ('Darla K. Anderson','Cars','producer'), ('Darla K. Anderson','Coco','producer'),
  ('Chris Meledandri','Despicable Me','producer'), ('Chris Meledandri','Minions','producer'), ('Chris Meledandri','The Secret Life of Pets','producer'),
  ('Janet Healy','Despicable Me','producer'), ('Janet Healy','Minions','producer'), ('Janet Healy','The Secret Life of Pets','producer'),
  ('Makoto Shinkai','Suzume','creator'), ('Makoto Shinkai','Suzume','director'), ('Makoto Shinkai','Suzume','writer'), ('Genki Kawamura','Suzume','producer'),
  ('Reiko Yoshida','A Silent Voice','writer'), ('Reiko Yoshida','Violet Evergarden','writer'), ('Reiko Yoshida','Violet Evergarden: the Movie','writer'),
  ('Shingo Adachi','Sword Art Online','character_designer'), ('Akira Miyazaki','The Adventures of Tom Sawyer','writer'), ('Akira Miyazaki','Lucy-May of the Southern Rainbow','writer'), ('Akira Miyazaki','Tales of Little Women','writer'),
  ('Isao Takahata','Heidi, Girl of the Alps','director'), ('Isao Takahata','Anne of Green Gables','director'), ('Isao Takahata','Castle in the Sky','producer'), ('Tetsurō Araki','Attack on Titan','director'), ('Keiichirō Saitō','Frieren: Beyond Journey''s End','director'),
  ('Kensuke Ushio','A Silent Voice','composer'), ('Kensuke Ushio','LOOK BACK','composer'), ('Taku Kishimoto','Haikyuu!!','writer'), ('Taku Kishimoto','Ranking of Kings','writer'), ('Toshiya Oono','86 EIGHTY-SIX','writer'),
  ('Yuuki Hayashi','My Hero Academia','composer'), ('Yuuki Hayashi','Haikyuu!!','composer'), ('Yuki Kajiura','Sword Art Online','composer'), ('Yuki Kajiura','Demon Slayer: Kimetsu no Yaiba','composer'), ('Kouta Yamamoto','Attack on Titan','composer'), ('Kouta Yamamoto','86 EIGHTY-SIX','composer'),
  ('Naoki Urasawa','PLUTO','original_author'), ('Tatsuki Fujimoto','LOOK BACK','original_author'), ('Aka Akasaka','Oshi No Ko','original_author'), ('ONE','One-Punch Man','original_author'), ('ONE','Mob Psycho 100','original_author'), ('Tappei Nagatsuki','Vivy -Fluorite Eye''s Song-','creator'), ('Tappei Nagatsuki','Vivy -Fluorite Eye''s Song-','writer'), ('Reki Kawahara','Sword Art Online','original_author'),
  ('Sergio Pablos','Despicable Me','creator'), ('Sergio Pablos','Despicable Me','writer'), ('Shingo Natsume','One-Punch Man','director'), ('Fumio Kurokawa','Princess Sara / Little Princess Sara','director'), ('Fumio Kurokawa','Tales of Little Women','director'), ('Hiroshi Saitou','The Adventures of Tom Sawyer','director'), ('Hiroshi Saitou','Lucy-May of the Southern Rainbow','director'),
  ('Frances Hodgson Burnett','The Secret Garden','original_author'), ('Frances Hodgson Burnett','Princess Sara / Little Princess Sara','original_author'), ('Lucy Maud Montgomery','Anne of Green Gables','original_author'), ('Lucy Maud Montgomery','Anne Shirley','original_author'), ('Louisa May Alcott','Tales of Little Women','original_author'), ('Louisa May Alcott','Little Women II: Jo''s Boys','original_author'),
  ('Michael Dante DiMartino','Avatar: The Last Airbender','creator'), ('Michael Dante DiMartino','Avatar: The Last Airbender','executive_producer'), ('Michael Dante DiMartino','Avatar: Seven Havens','creator'), ('Michael Dante DiMartino','Avatar: Seven Havens','executive_producer'), ('Bryan Konietzko','Avatar: The Last Airbender','creator'), ('Bryan Konietzko','Avatar: The Last Airbender','executive_producer'), ('Bryan Konietzko','Avatar: Seven Havens','creator'), ('Bryan Konietzko','Avatar: Seven Havens','executive_producer'),
  ('Akihiro Hino','Inazuma Eleven','creator'), ('Akihiro Hino','LBX: Little Battlers eXperience','creator'), ('Brad Bird','The Incredibles','director'), ('Brad Bird','The Incredibles','writer'), ('Brad Bird','Ratatouille','director'), ('Brad Bird','Ratatouille','writer'), ('John Powell','Kung Fu Panda','composer'), ('John Powell','How to Train Your Dragon','composer'),
  ('Michael McCullers','The Boss Baby','writer'), ('Michael McCullers','The Boss Baby: Family Business','writer'), ('Steve Mazzaro','The Boss Baby','composer'), ('Steve Mazzaro','The Boss Baby: Family Business','composer'), ('Eric Darnell','Madagascar','director'), ('Eric Darnell','Madagascar','writer'), ('Eric Darnell','Penguins of Madagascar','director'), ('Eric Darnell','Penguins of Madagascar','writer'),
  ('Chris Renaud','Despicable Me','director'), ('Chris Renaud','The Secret Life of Pets','director'), ('Pierre Coffin','Despicable Me','director'), ('Pierre Coffin','Minions','director'), ('Cinco Paul','Despicable Me','writer'), ('Cinco Paul','The Secret Life of Pets','writer'), ('Ken Daurio','Despicable Me','writer'), ('Ken Daurio','The Secret Life of Pets','writer'), ('Brian Lynch','Minions','writer'), ('Brian Lynch','The Secret Life of Pets','writer'),
  ('Phil Lord','The LEGO Movie','director'), ('Phil Lord','The LEGO Movie','writer'), ('Phil Lord','Spider-Man: Into the Spider-Verse','writer'), ('Phil Lord','Spider-Man: Into the Spider-Verse','producer'), ('Christopher Miller','The LEGO Movie','director'), ('Christopher Miller','The LEGO Movie','writer'), ('Christopher Miller','Spider-Man: Into the Spider-Verse','producer'), ('Mark Mothersbaugh','The LEGO Movie','composer'), ('Mark Mothersbaugh','Hotel Transylvania','composer'), ('Jonas Rivera','Up','producer'), ('Jonas Rivera','Inside Out','producer'),
  ('Hiromasa Yonebayashi','The Secret World of Arrietty','director'), ('Hiromasa Yonebayashi','Mary and the Witch''s Flower','director'), ('Hiromasa Yonebayashi','Mary and the Witch''s Flower','writer'), ('Yoshifumi Kondō','Anne of Green Gables','character_designer'), ('Yoshifumi Kondō','Anne of Green Gables','art_director'), ('Yoshifumi Kondō','Whisper of the Heart','director'), ('Osamu Tezuka','PLUTO','original_author');
--> statement-breakpoint
INSERT INTO entities (kind, name, sort_name, description)
SELECT DISTINCT 'person'::entity_kind, person_name, lower(person_name), '' FROM requested_people_credits
UNION
SELECT 'person'::entity_kind, name, lower(name), ''
FROM (VALUES ('Yasuhiro Nakanishi'), ('Masayoshi Tanaka')) AS people_without_catalog_works(name)
ON CONFLICT (kind, sort_name) DO UPDATE SET name = EXCLUDED.name, updated_at = now();
--> statement-breakpoint
DELETE FROM contributions c
USING requested_people_credits requested, entities person, titles work
WHERE person.kind = 'person'
  AND person.name = requested.person_name
  AND work.canonical_title = requested.canonical_title
  AND c.entity_id = person.id
  AND c.title_id = work.id;
--> statement-breakpoint
INSERT INTO contributions (title_id, entity_id, role_id, position, is_primary)
SELECT work.id, person.id, role.id, 0, false
FROM requested_people_credits requested
JOIN entities person ON person.kind = 'person' AND person.name = requested.person_name
JOIN titles work ON work.canonical_title = requested.canonical_title
JOIN roles role ON role.slug = requested.role_slug
ON CONFLICT (title_id, entity_id, role_id) DO NOTHING;
--> statement-breakpoint
DROP TABLE requested_people_credits;
