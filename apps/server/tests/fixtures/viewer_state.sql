-- Synthetic data only. The Rust harness checks the newly created *_test database first.
INSERT INTO auth_users(id,name,email,role) VALUES
('viewer_owner_one','Fixture owner one','viewer-one@example.invalid','owner'),
('viewer_owner_two','Fixture owner two','viewer-two@example.invalid','owner'),
('viewer_member','Fixture member','viewer-member@example.invalid','member'),
('viewer_suspended','Fixture suspended','viewer-suspended@example.invalid','owner');
INSERT INTO accounts(id,auth_user_id,kind,status,display_name) VALUES
('20000000-0000-4000-8000-000000000001','viewer_owner_one','admin','active','Fixture owner one'),
('20000000-0000-4000-8000-000000000002','viewer_owner_two','admin','active','Fixture owner two'),
('20000000-0000-4000-8000-000000000003','viewer_member','family','active','Fixture member'),
('20000000-0000-4000-8000-000000000004','viewer_suspended','admin','suspended','Fixture suspended');
INSERT INTO titles(id,canonical_title,sort_title) VALUES
('10000000-0000-4000-8000-000000000001','Viewer mixed fixture','Viewer mixed fixture'),
('10000000-0000-4000-8000-000000000002','Viewer foreign fixture','Viewer foreign fixture'),
('10000000-0000-4000-8000-000000000003','Viewer empty fixture','Viewer empty fixture'),
('10000000-0000-4000-8000-000000000004','Viewer future fixture','Viewer future fixture'),
('10000000-0000-4000-8000-000000000005','Viewer unknown fixture','Viewer unknown fixture');
INSERT INTO installments(id,title_id,kind,position,title,status,release_date) VALUES
('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','season',1,'Completed season','completed',current_date-100),
('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','season',2,'Unknown season','unknown',null),
('40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','season',3,'Future season','announced',current_date+100),
('40000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','movie',4,'Undated completed movie','completed',null),
('40000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','special',5,'Unknown special','unknown',null),
('40000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','movie',6,'Future movie','announced',current_date+100),
('40000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','movie',7,'Completed with explicit future date','completed',current_date+100),
('40000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001','season',8,'Empty season','completed',null),
('40000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000002','season',1,'Foreign season','completed',null),
('40000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000004','season',1,'Only future season','announced',current_date+100),
('40000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000004','movie',2,'Only future movie','announced',current_date+100),
('40000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000005','special',1,'Only unknown special','unknown',null);
INSERT INTO episodes(id,installment_id,number,position,title,release_date) VALUES
('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',1,1,'Released episode',current_date-10),
('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001',1.5,2,'Undated fractional episode',null),
('50000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001',2,3,'Explicit future episode',current_date+100),
('50000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000002',1,1,'Unknown episode',null),
('50000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000002',2,2,'Released in unknown season',current_date-1),
('50000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000003',1,1,'Future season episode',current_date+100),
('50000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000004',1,1,'Episode incorrectly attached to movie',current_date-1),
('50000000-0000-4000-8000-000000000008','40000000-0000-4000-8000-000000000009',1,1,'Foreign episode',null),
('50000000-0000-4000-8000-000000000009','40000000-0000-4000-8000-000000000010',1,1,'Only future episode',current_date+100);
INSERT INTO account_title_states(account_id,title_id,is_favorite,personal_rating,notes,saved_offline) VALUES
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',false,4,'ملاحظة شخصية محفوظة',true),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',false,2,'Other owner note',false);
INSERT INTO account_playback_states(id,account_id,installment_id,episode_id,position_seconds,duration_seconds,is_played,played_manually,played_at,subtitle_offset_ms) VALUES
('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',123,1000,false,false,null,-750),
('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000004',null,999,1200,true,false,'2020-01-01T00:00:00Z',250),
('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002',70,null,true,true,'2020-01-01T00:00:00Z',null);
