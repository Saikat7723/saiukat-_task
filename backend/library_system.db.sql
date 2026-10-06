BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "admins" (
	"id"	INTEGER NOT NULL,
	"full_name"	VARCHAR(100) NOT NULL,
	"email"	VARCHAR(120) NOT NULL,
	"hashed_password"	VARCHAR(255) NOT NULL,
	"role"	VARCHAR(9) NOT NULL,
	"is_active"	BOOLEAN NOT NULL,
	"created_at"	DATETIME NOT NULL,
	"updated_at"	DATETIME NOT NULL,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "attendance_events" (
	"id"	INTEGER NOT NULL,
	"student_id"	INTEGER,
	"event_type"	VARCHAR(30) NOT NULL,
	"timestamp"	DATETIME NOT NULL,
	"confidence"	FLOAT,
	"camera_id"	VARCHAR(50),
	"raw_info"	TEXT,
	"created_at"	DATETIME NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("student_id") REFERENCES "students"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "attendance_sessions" (
	"id"	INTEGER NOT NULL,
	"student_id"	INTEGER NOT NULL,
	"session_date"	DATE NOT NULL,
	"check_in_time"	DATETIME NOT NULL,
	"check_out_time"	DATETIME,
	"duration_minutes"	INTEGER NOT NULL,
	"status"	VARCHAR(20) NOT NULL,
	"confidence"	FLOAT,
	"camera_id"	VARCHAR(50),
	"notes"	TEXT,
	"created_at"	DATETIME NOT NULL,
	"updated_at"	DATETIME NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("student_id") REFERENCES "students"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "attendance_settings" (
	"id"	INTEGER NOT NULL,
	"setting_key"	VARCHAR(50) NOT NULL,
	"setting_value"	VARCHAR(255) NOT NULL,
	"description"	VARCHAR(255),
	"updated_at"	DATETIME NOT NULL,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id"	INTEGER NOT NULL,
	"admin_id"	INTEGER,
	"admin_email"	VARCHAR(120),
	"action"	VARCHAR(100) NOT NULL,
	"target_type"	VARCHAR(50),
	"target_id"	VARCHAR(50),
	"details"	TEXT,
	"ip_address"	VARCHAR(45),
	"timestamp"	DATETIME NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("admin_id") REFERENCES "admins"("id") ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS "book_authors" (
	"id"	INTEGER NOT NULL,
	"name"	VARCHAR(100) NOT NULL,
	"bio"	TEXT,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "book_categories" (
	"id"	INTEGER NOT NULL,
	"name"	VARCHAR(100) NOT NULL,
	"code"	VARCHAR(20) NOT NULL,
	"description"	TEXT,
	UNIQUE("code"),
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "book_issues" (
	"id"	INTEGER NOT NULL,
	"student_id"	INTEGER NOT NULL,
	"book_id"	INTEGER NOT NULL,
	"issue_date"	DATE NOT NULL,
	"due_date"	DATE NOT NULL,
	"return_date"	DATE,
	"fine_amount"	FLOAT NOT NULL,
	"status"	VARCHAR(20) NOT NULL,
	"notes"	TEXT,
	"issued_by_admin_id"	INTEGER,
	"created_at"	DATETIME NOT NULL,
	"updated_at"	DATETIME NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("book_id") REFERENCES "books"("id") ON DELETE CASCADE,
	FOREIGN KEY("issued_by_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL,
	FOREIGN KEY("student_id") REFERENCES "students"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "books" (
	"id"	INTEGER NOT NULL,
	"isbn"	VARCHAR(30) NOT NULL,
	"title"	VARCHAR(200) NOT NULL,
	"author_id"	INTEGER,
	"category_id"	INTEGER,
	"publisher"	VARCHAR(100),
	"description"	TEXT,
	"edition"	VARCHAR(30),
	"publication_year"	INTEGER,
	"total_copies"	INTEGER NOT NULL,
	"available_copies"	INTEGER NOT NULL,
	"shelf_location"	VARCHAR(50),
	"status"	VARCHAR(20) NOT NULL,
	"created_at"	DATETIME NOT NULL,
	"updated_at"	DATETIME NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("author_id") REFERENCES "book_authors"("id") ON DELETE SET NULL,
	FOREIGN KEY("category_id") REFERENCES "book_categories"("id") ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS "cameras" (
	"id"	INTEGER NOT NULL,
	"camera_code"	VARCHAR(50) NOT NULL,
	"name"	VARCHAR(100) NOT NULL,
	"location"	VARCHAR(100) NOT NULL,
	"stream_url_or_index"	VARCHAR(255) NOT NULL,
	"status"	VARCHAR(20) NOT NULL,
	"created_at"	DATETIME NOT NULL,
	"updated_at"	DATETIME NOT NULL,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "courses" (
	"id"	INTEGER NOT NULL,
	"code"	VARCHAR(20) NOT NULL,
	"name"	VARCHAR(100) NOT NULL,
	"department_id"	INTEGER NOT NULL,
	"duration_years"	INTEGER NOT NULL,
	"created_at"	DATETIME NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("department_id") REFERENCES "departments"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "departments" (
	"id"	INTEGER NOT NULL,
	"code"	VARCHAR(20) NOT NULL,
	"name"	VARCHAR(100) NOT NULL,
	"description"	TEXT,
	"created_at"	DATETIME NOT NULL,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "holidays" (
	"id"	INTEGER NOT NULL,
	"title"	VARCHAR(100) NOT NULL,
	"holiday_date"	DATE NOT NULL,
	"description"	TEXT,
	"created_at"	DATETIME NOT NULL,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"id"	INTEGER NOT NULL,
	"token_hash"	VARCHAR(64) NOT NULL,
	"owner_type"	VARCHAR(20) NOT NULL,
	"owner_id"	INTEGER NOT NULL,
	"expires_at"	DATETIME NOT NULL,
	"used_at"	DATETIME,
	"created_at"	DATETIME NOT NULL,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "student_face_profiles" (
	"id"	INTEGER NOT NULL,
	"student_id"	INTEGER NOT NULL,
	"embedding_vector"	JSON NOT NULL,
	"face_bounding_box"	JSON,
	"reference_image_path"	VARCHAR(255) NOT NULL,
	"is_active"	BOOLEAN NOT NULL,
	"created_at"	DATETIME NOT NULL,
	"updated_at"	DATETIME NOT NULL,
	PRIMARY KEY("id"),
	UNIQUE("student_id"),
	FOREIGN KEY("student_id") REFERENCES "students"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "students" (
	"id"	INTEGER NOT NULL,
	"student_id"	VARCHAR(50) NOT NULL,
	"full_name"	VARCHAR(120) NOT NULL,
	"email"	VARCHAR(120) NOT NULL,
	"hashed_password"	VARCHAR(255),
	"phone"	VARCHAR(20),
	"department_id"	INTEGER,
	"course_id"	INTEGER,
	"dob"	DATE,
	"gender"	VARCHAR(20),
	"date_of_joining"	DATE,
	"semester"	VARCHAR(50),
	"enrollment_year"	INTEGER,
	"address"	TEXT,
	"emergency_phone"	VARCHAR(20),
	"remarks"	TEXT,
	"library_member"	BOOLEAN NOT NULL,
	"profile_photo_path"	VARCHAR(255),
	"status"	VARCHAR(20) NOT NULL,
	"created_at"	DATETIME NOT NULL,
	"updated_at"	DATETIME NOT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("course_id") REFERENCES "courses"("id") ON DELETE SET NULL,
	FOREIGN KEY("department_id") REFERENCES "departments"("id") ON DELETE SET NULL
);
INSERT INTO "admins" VALUES (1,'System Administrator','admin@library.com','$argon2id$v=19$m=65536,t=3,p=4$OYfQWqvVOgeg9N47h5CSEg$Z/s35iuthyOaqo5P+3dENkACPl9Uuux2Dy+c4QxWRdI','ADMIN',1,'2026-09-30 04:34:12.798370','2026-09-30 04:34:12.798370');
INSERT INTO "admins" VALUES (2,'Chief Librarian','librarian@library.com','$argon2id$v=19$m=65536,t=3,p=4$tzbmvLfW2ntP6Z1zTsn5nw$dZGZ6vm5Znc/scEPAOSabKyeNj85svCd0WlpEYSuqvw','LIBRARIAN',1,'2026-09-30 04:34:12.798370','2026-09-30 04:34:12.798370');
INSERT INTO "attendance_events" VALUES (1,1,'CHECK_IN','2026-10-01 08:50:59.363385',0.91586446762085,'browser-ddc6f35d-bba2-40db-8','Verified camera face; daily automatic attendance','2026-10-01 08:50:59.402423');
INSERT INTO "attendance_events" VALUES (2,1,'CHECK_OUT','2026-10-01 08:52:24.027612',0.814036905765533,'browser-622a151b-e7e3-48c2-a','Verified camera face after departure; automatic check-out for session 1','2026-10-01 08:52:24.030133');
INSERT INTO "attendance_events" VALUES (3,1,'CHECK_IN','2026-10-01 08:52:24.646886',0.808329522609711,'browser-622a151b-e7e3-48c2-a','Verified camera face; daily automatic attendance','2026-10-01 08:52:24.649127');
INSERT INTO "attendance_events" VALUES (4,1,'CHECK_OUT','2026-10-01 08:52:30.660959',0.778180718421936,'browser-622a151b-e7e3-48c2-a','Verified camera face after departure; automatic check-out for session 2','2026-10-01 08:52:30.664067');
INSERT INTO "attendance_events" VALUES (5,1,'CHECK_IN','2026-10-01 08:52:31.277897',0.861997485160828,'browser-622a151b-e7e3-48c2-a','Verified camera face; daily automatic attendance','2026-10-01 08:52:31.279413');
INSERT INTO "attendance_events" VALUES (6,1,'CHECK_OUT','2026-10-01 08:52:34.339130',0.833936810493469,'browser-622a151b-e7e3-48c2-a','Verified camera face after departure; automatic check-out for session 3','2026-10-01 08:52:34.341720');
INSERT INTO "attendance_events" VALUES (7,1,'CHECK_IN','2026-10-01 08:52:34.951941',0.843854069709778,'browser-622a151b-e7e3-48c2-a','Verified camera face; daily automatic attendance','2026-10-01 08:52:34.954018');
INSERT INTO "attendance_events" VALUES (8,1,'CHECK_OUT','2026-10-01 08:52:44.716623',0.840087115764618,'browser-622a151b-e7e3-48c2-a','Verified camera face after departure; automatic check-out for session 4','2026-10-01 08:52:44.719042');
INSERT INTO "attendance_events" VALUES (9,1,'CHECK_IN','2026-10-01 08:52:45.338487',0.827848255634308,'browser-622a151b-e7e3-48c2-a','Verified camera face; daily automatic attendance','2026-10-01 08:52:45.341505');
INSERT INTO "attendance_events" VALUES (10,1,'CHECK_OUT','2026-10-01 08:52:47.929523',0.827848255634308,'browser-622a151b-e7e3-48c2-a','Operator confirmed check-out from the live attendance monitor','2026-10-01 08:52:47.930523');
INSERT INTO "attendance_events" VALUES (11,1,'CHECK_IN','2026-10-01 08:52:48.440318',0.811747848987579,'browser-622a151b-e7e3-48c2-a','Verified camera face; daily automatic attendance','2026-10-01 08:52:48.441345');
INSERT INTO "attendance_events" VALUES (12,1,'CHECK_OUT','2026-10-01 08:52:50.406480',0.811747848987579,'browser-622a151b-e7e3-48c2-a','Operator confirmed check-out from the live attendance monitor','2026-10-01 08:52:50.408099');
INSERT INTO "attendance_events" VALUES (13,1,'CHECK_IN','2026-10-01 08:52:50.894255',0.818636119365692,'browser-622a151b-e7e3-48c2-a','Verified camera face; daily automatic attendance','2026-10-01 08:52:50.895255');
INSERT INTO "attendance_events" VALUES (14,1,'CHECK_OUT',0,0.818636119365692,'browser-622a151b-e7e3-48c2-a','Operator confirmed check-out from the live attendance monitor','2026-10-01 08:52:56.245385');
INSERT INTO "attendance_events" VALUES (15,1,'CHECK_IN','2026-10-01 08:52:56.486826',0.835836887359619,'browser-622a151b-e7e3-48c2-a','Verified camera face; daily automatic attendance','2026-10-01 08:52:56.488337');
INSERT INTO "attendance_events" VALUES (16,1,'CHECK_OUT','2026-10-01 08:53:04.337214',0.911832332611084,'browser-622a151b-e7e3-48c2-a','Verified camera face after departure; automatic check-out for session 8','2026-10-01 08:53:04.340350');
INSERT INTO "attendance_events" VALUES (17,1,'CHECK_IN','2026-10-01 08:53:04.965108',0.943651974201202,'browser-622a151b-e7e3-48c2-a','Verified camera face; daily automatic attendance','2026-10-01 08:53:04.966633');
INSERT INTO "attendance_events" VALUES (18,1,'CHECK_OUT','2026-10-01 08:53:05.648415',0.943651974201202,'browser-622a151b-e7e3-48c2-a','Operator confirmed check-out from the live attendance monitor','2026-10-01 08:53:05.649686');
INSERT INTO "attendance_events" VALUES (19,1,'CHECK_IN','2026-10-01 08:53:06.210850',0.904134333133698,'browser-622a151b-e7e3-48c2-a','Verified camera face; daily automatic attendance','2026-10-01 08:53:06.212310');
INSERT INTO "attendance_events" VALUES (20,1,'CHECK_IN','2026-10-06 07:49:31.223980',0.680504739284515,'browser-4c7d8136-25d3-4f1a-9','Server-validated daily attendance','2026-10-06 07:49:31.240542');
INSERT INTO "attendance_events" VALUES (21,2,'CHECK_IN','2026-10-06 08:03:17.430953',0.881982564926147,'browser-026d24c8-ea89-4770-9','Server-validated daily attendance','2026-10-06 08:03:17.434189');
INSERT INTO "attendance_sessions" VALUES (1,1,'2026-10-01','2026-10-01 08:50:59.363385','2026-10-01 08:52:24.027612',1,'Present',0.91586446762085,'browser-ddc6f35d-bba2-40db-8',NULL,'2026-10-01 08:50:59.405423','2026-10-01 08:52:24.034662');
INSERT INTO "attendance_sessions" VALUES (2,1,'2026-10-01','2026-10-01 08:52:24.646886','2026-10-01 08:52:30.660959',0,'Present',0.808329522609711,'browser-622a151b-e7e3-48c2-a',NULL,'2026-10-01 08:52:24.651067','2026-10-01 08:52:30.667884');
INSERT INTO "attendance_sessions" VALUES (3,1,'2026-10-01','2026-10-01 08:52:31.277897','2026-10-01 08:52:34.339130',0,'Present',0.861997485160828,'browser-622a151b-e7e3-48c2-a',NULL,'2026-10-01 08:52:31.282460','2026-10-01 08:52:34.345885');
INSERT INTO "attendance_sessions" VALUES (4,1,'2026-10-01','2026-10-01 08:52:34.951941','2026-10-01 08:52:44.716623',0,'Present',0.843854069709778,'browser-622a151b-e7e3-48c2-a',NULL,'2026-10-01 08:52:34.957628','2026-10-01 08:52:44.722967');
INSERT INTO "attendance_sessions" VALUES (5,1,'2026-10-01','2026-10-01 08:52:45.338487','2026-10-01 08:52:47.929523',0,'Present',0.827848255634308,'browser-622a151b-e7e3-48c2-a',NULL,'2026-10-01 08:52:45.344216','2026-10-01 08:52:47.938818');
INSERT INTO "attendance_sessions" VALUES (6,1,'2026-10-01','2026-10-01 08:52:48.440318','2026-10-01 08:52:50.406480',0,'Present',0.811747848987579,'browser-622a151b-e7e3-48c2-a',NULL,'2026-10-01 08:52:48.444634','2026-10-01 08:52:50.412291');
INSERT INTO "attendance_sessions" VALUES (7,1,'2026-10-01','2026-10-01 08:52:50.894255','2026-10-01 08:52:56.244383',0,'Present',0.818636119365692,'browser-622a151b-e7e3-48c2-a',NULL,'2026-10-01 08:52:50.897952','2026-10-01 08:52:56.248466');
INSERT INTO "attendance_sessions" VALUES (8,1,'2026-10-01','2026-10-01 08:52:56.486826','2026-10-01 08:53:04.337214',0,'Present',0.835836887359619,'browser-622a151b-e7e3-48c2-a',NULL,'2026-10-01 08:52:56.491091','2026-10-01 08:53:04.343142');
INSERT INTO "attendance_sessions" VALUES (9,1,'2026-10-01','2026-10-01 08:53:04.965108','2026-10-01 08:53:05.648415',0,'Present',0.943651974201202,'browser-622a151b-e7e3-48c2-a',NULL,'2026-10-01 08:53:04.969706','2026-10-01 08:53:05.658980');
INSERT INTO "attendance_sessions" VALUES (10,1,'2026-10-01','2026-10-01 08:53:06.210850',NULL,0,'Present',0.904134333133698,'browser-622a151b-e7e3-48c2-a',NULL,'2026-10-01 08:53:06.214572','2026-10-01 08:53:06.214572');
INSERT INTO "attendance_sessions" VALUES (11,1,'2026-10-06','2026-10-06 07:49:31.223980',NULL,0,'Present',0.680504739284515,'browser-4c7d8136-25d3-4f1a-9',NULL,'2026-10-06 07:49:31.247990','2026-10-06 07:49:31.247990');
INSERT INTO "attendance_sessions" VALUES (12,2,'2026-10-06','2026-10-06 08:03:17.430953',NULL,0,'Present',0.881982564926147,'browser-026d24c8-ea89-4770-9',NULL,'2026-10-06 08:03:17.436736','2026-10-06 08:03:17.437685');
INSERT INTO "attendance_settings" VALUES (1,'FACE_RECOGNITION_THRESHOLD','0.60','Minimum confidence required for automatic attendance matching','2026-09-30 04:34:12.803510');
INSERT INTO "attendance_settings" VALUES (2,'ATTENDANCE_COOLDOWN_SECONDS','300','Cooldown period in seconds to prevent duplicate attendance','2026-09-30 04:34:12.803510');
INSERT INTO "attendance_settings" VALUES (3,'AUTO_CHECKOUT_HOURS','8','Automatic check-out after N hours if unclosed','2026-09-30 04:34:12.803510');
INSERT INTO "attendance_settings" VALUES (4,'OVERDUE_FINE_PER_DAY','','Optional overdue fine per day; leave blank to disable fines','2026-09-30 04:34:12.803510');
INSERT INTO "attendance_settings" VALUES (5,'attendance_start_time','00:00',NULL,'2026-10-02 06:54:03.312657');
INSERT INTO "attendance_settings" VALUES (6,'attendance_cutoff_time','14:00',NULL,'2026-10-02 06:54:03.312657');
INSERT INTO "audit_logs" VALUES (1,1,'admin@library.com','STUDENT_CREATE','Student','1','Created student rohan (STU000001)',NULL,'2026-09-30 05:29:58.647675');
INSERT INTO "audit_logs" VALUES (2,1,'admin@library.com','STUDENT_UPDATE','Student','1','Updated student rohan',NULL,'2026-09-30 05:50:08.088490');
INSERT INTO "audit_logs" VALUES (3,1,'admin@library.com','STUDENT_UPDATE','Student','1','Updated student rohan',NULL,'2026-09-30 05:50:09.451413');
INSERT INTO "audit_logs" VALUES (4,1,'admin@library.com','STUDENT_UPDATE','Student','1','Updated student rohan',NULL,'2026-09-30 05:50:10.433332');
INSERT INTO "audit_logs" VALUES (5,1,'admin@library.com','STUDENT_UPDATE','Student','1','Updated student rohan',NULL,'2026-09-30 05:50:31.726711');
INSERT INTO "audit_logs" VALUES (6,1,'admin@library.com','STUDENT_UPDATE','Student','1','Updated student rohan',NULL,'2026-09-30 05:53:55.372888');
INSERT INTO "audit_logs" VALUES (7,1,'admin@library.com','STUDENT_FACE_REGISTER','Student','1','Registered face embedding & photo for rohan',NULL,'2026-09-30 05:53:55.643750');
INSERT INTO "audit_logs" VALUES (8,1,'admin@library.com','STUDENT_DEACTIVATE','Student','1','Permanently deleted student rohan (STU000001)',NULL,'2026-09-30 05:54:11.516259');
INSERT INTO "audit_logs" VALUES (9,1,'admin@library.com','STUDENT_CREATE','Student','1','Created student Tarun (STU000001)',NULL,'2026-09-30 05:56:05.849762');
INSERT INTO "audit_logs" VALUES (10,1,'admin@library.com','STUDENT_UPDATE','Student','1','Updated student Tarun',NULL,'2026-09-30 05:56:15.916685');
INSERT INTO "audit_logs" VALUES (11,1,'admin@library.com','STUDENT_FACE_REGISTER','Student','1','Registered face embedding & photo for Tarun',NULL,'2026-09-30 05:56:16.013325');
INSERT INTO "audit_logs" VALUES (12,1,'admin@library.com','ATTENDANCE_CHECK_OUT','AttendanceSession','2','Checked out Tarun from attendance session 2',NULL,'2026-09-30 05:56:44.387891');
INSERT INTO "audit_logs" VALUES (13,1,'admin@library.com','STUDENT_CREATE','Student','2','Created student akash (STU000002)',NULL,'2026-09-30 06:04:45.899743');
INSERT INTO "audit_logs" VALUES (14,1,'admin@library.com','STUDENT_DEACTIVATE','Student','1','Permanently deleted student Tarun (STU000001)',NULL,'2026-09-30 06:05:08.680414');
INSERT INTO "audit_logs" VALUES (15,1,'admin@library.com','STUDENT_UPDATE','Student','2','Updated student akash',NULL,'2026-09-30 06:05:31.688546');
INSERT INTO "audit_logs" VALUES (16,1,'admin@library.com','STUDENT_FACE_REGISTER','Student','2','Registered face embedding & photo for akash',NULL,'2026-09-30 06:05:31.780476');
INSERT INTO "audit_logs" VALUES (17,1,'admin@library.com','ATTENDANCE_CHECK_OUT','AttendanceSession','2','Checked out akash from attendance session 2',NULL,'2026-09-30 06:09:09.962916');
INSERT INTO "audit_logs" VALUES (18,1,'admin@library.com','STUDENT_DEACTIVATE','Student','2','Permanently deleted student akash (STU000002)',NULL,'2026-10-01 08:43:27.059660');
INSERT INTO "audit_logs" VALUES (19,1,'admin@library.com','STUDENT_CREATE','Student','1','Created student Santanu (STU000001)',NULL,'2026-10-01 08:44:41.868754');
INSERT INTO "audit_logs" VALUES (20,1,'admin@library.com','STUDENT_FACE_REGISTER','Student','1','Registered face embedding & photo for Santanu',NULL,'2026-10-01 08:44:42.155605');
INSERT INTO "audit_logs" VALUES (21,1,'admin@library.com','STUDENT_DEACTIVATE','Student','1','Permanently deleted student Santanu (STU000001)',NULL,'2026-10-01 08:47:07.096861');
INSERT INTO "audit_logs" VALUES (22,1,'admin@library.com','STUDENT_CREATE','Student','1','Created student Sumit (STU000001)',NULL,'2026-10-01 08:48:48.005380');
INSERT INTO "audit_logs" VALUES (23,1,'admin@library.com','STUDENT_FACE_REGISTER','Student','1','Registered face embedding & photo for Sumit',NULL,'2026-10-01 08:48:48.092756');
INSERT INTO "audit_logs" VALUES (24,1,'admin@library.com','ATTENDANCE_CHECK_OUT','AttendanceSession','5','Checked out Sumit from attendance session 5',NULL,'2026-10-01 08:52:47.938818');
INSERT INTO "audit_logs" VALUES (25,1,'admin@library.com','ATTENDANCE_CHECK_OUT','AttendanceSession','6','Checked out Sumit from attendance session 6',NULL,'2026-10-01 08:52:50.411133');
INSERT INTO "audit_logs" VALUES (26,1,'admin@library.com','ATTENDANCE_CHECK_OUT','AttendanceSession','7','Checked out Sumit from attendance session 7',NULL,'2026-10-01 08:52:56.248466');
INSERT INTO "audit_logs" VALUES (27,1,'admin@library.com','ATTENDANCE_CHECK_OUT','AttendanceSession','9','Checked out Sumit from attendance session 9',NULL,'2026-10-01 08:53:05.657922');
INSERT INTO "audit_logs" VALUES (28,1,'admin@library.com','STUDENT_CREATE','Student','2','Created student Safik (STU000002)',NULL,'2026-10-06 07:19:29.214845');
INSERT INTO "audit_logs" VALUES (29,1,'admin@library.com','STUDENT_FACE_REGISTER','Student','2','Registered face embedding & photo for Safik',NULL,'2026-10-06 07:19:29.330470');
INSERT INTO "courses" VALUES (1,'BTECH-CSE','B.Tech in Computer Science & Engineering',1,4,'2026-09-30 04:34:31.925341');
INSERT INTO "courses" VALUES (2,'BTECH-IT','B.Tech in Information Technology',2,4,'2026-09-30 04:34:31.926342');
INSERT INTO "courses" VALUES (3,'BTECH-ECE','B.Tech in Electronics & Communication Engineering',3,4,'2026-09-30 04:34:31.927341');
INSERT INTO "courses" VALUES (4,'BTECH-EEE','B.Tech in Electrical & Electronics Engineering',4,4,'2026-09-30 04:34:31.928342');
INSERT INTO "courses" VALUES (5,'BTECH-EE','B.Tech in Electrical Engineering',5,4,'2026-09-30 04:34:31.929341');
INSERT INTO "courses" VALUES (6,'BTECH-ME','B.Tech in Mechanical Engineering',6,4,'2026-09-30 04:34:31.929341');
INSERT INTO "courses" VALUES (7,'BTECH-CE','B.Tech in Civil Engineering',7,4,'2026-09-30 04:34:31.930341');
INSERT INTO "courses" VALUES (8,'BTECH-CHE','B.Tech in Chemical Engineering',8,4,'2026-09-30 04:34:31.931341');
INSERT INTO "courses" VALUES (9,'BTECH-BT','B.Tech in Biotechnology Engineering',9,4,'2026-09-30 04:34:31.932341');
INSERT INTO "courses" VALUES (10,'BTECH-TE','B.Tech in Textile Engineering',10,4,'2026-09-30 04:34:31.933341');
INSERT INTO "courses" VALUES (11,'BTECH-IPE','B.Tech in Industrial & Production Engineering',11,4,'2026-09-30 04:34:31.934341');
INSERT INTO "courses" VALUES (12,'BTECH-AE','B.Tech in Aerospace Engineering',12,4,'2026-09-30 04:34:31.935341');
INSERT INTO "courses" VALUES (13,'BTECH-ARCH','B.Tech in Architecture',13,4,'2026-09-30 04:34:31.935341');
INSERT INTO "departments" VALUES (1,'CSE','Computer Science & Engineering','Institution academic programme','2026-09-30 04:34:31.922341');
INSERT INTO "departments" VALUES (2,'IT','Information Technology','Institution academic programme','2026-09-30 04:34:31.924341');
INSERT INTO "departments" VALUES (3,'ECE','Electronics & Communication Engineering','Institution academic programme','2026-09-30 04:34:31.926342');
INSERT INTO "departments" VALUES (4,'EEE','Electrical & Electronics Engineering','Institution academic programme','2026-09-30 04:34:31.927341');
INSERT INTO "departments" VALUES (5,'EE','Electrical Engineering','Institution academic programme','2026-09-30 04:34:31.928342');
INSERT INTO "departments" VALUES (6,'ME','Mechanical Engineering','Institution academic programme','2026-09-30 04:34:31.929341');
INSERT INTO "departments" VALUES (7,'CE','Civil Engineering','Institution academic programme','2026-09-30 04:34:31.929341');
INSERT INTO "departments" VALUES (8,'CHE','Chemical Engineering','Institution academic programme','2026-09-30 04:34:31.930341');
INSERT INTO "departments" VALUES (9,'BT','Biotechnology Engineering','Institution academic programme','2026-09-30 04:34:31.931341');
INSERT INTO "departments" VALUES (10,'TE','Textile Engineering','Institution academic programme','2026-09-30 04:34:31.932341');
INSERT INTO "departments" VALUES (11,'IPE','Industrial & Production Engineering','Institution academic programme','2026-09-30 04:34:31.933341');
INSERT INTO "departments" VALUES (12,'AE','Aerospace Engineering','Institution academic programme','2026-09-30 04:34:31.934341');
INSERT INTO "departments" VALUES (13,'ARCH','Architecture','Institution academic programme','2026-09-30 04:34:31.935341');
INSERT INTO "student_face_profiles" VALUES (1,1,'{"model": "sface-2021dec-v1", "vector": [-0.11863404512405396, 0.04750167578458786, 0.04636891931295395, 0.08534355461597443, 0.0582512803375721, -0.007008868269622326, -0.035701144486665726, 0.05702052265405655, -0.07126453518867493, 0.10237982869148254, -0.043575718998909, 0.11206099390983582, -0.0796189159154892, 0.12879511713981628, 0.052194930613040924, 0.14166373014450073, -0.06585631519556046, -0.0030432571657001972, -0.12763062119483948, 0.04808604344725609, -0.032431211322546005, -0.10851668566465378, -0.09538345783948898, -0.059588849544525146, -0.1499522477388382, 0.0036612791009247303, -0.013534142635762691, 0.11136548966169357, 0.11881845444440842, -0.003657169407233596, -0.004899268504232168, 0.11830592155456543, -0.09349202364683151, 0.07477983087301254, -0.10065297782421112, -0.06301850080490112, -0.0732099711894989, 0.03582406044006348, 0.06360206753015518, 0.07234373688697815, -0.19232620298862457, -0.11551427096128464, 0.19815169274806976, 0.07527840882539749, 0.10134582221508026, -0.02774684689939022, 0.07690199464559555, 0.17543667554855347, -0.09927763044834137, 0.03504927456378937, 0.15156999230384827, 0.014564204029738903, 0.027141867205500603, -0.020445814356207848, 0.018475789576768875, 0.03156805783510208, -0.07783923298120499, -0.022826142609119415, -0.013430720195174217, 0.003985569812357426, -0.1155402660369873, 0.01901259832084179, 0.0007914238958619535, -0.10453693568706512, 0.019205423071980476, 0.051239270716905594, 0.08404289931058884, 0.13131192326545715, 0.07742913067340851, 0.1051938459277153, -0.02194439433515072, 0.0015246494440361857, 0.1447892189025879, -0.12209541350603104, 0.13311931490898132, -0.0450226366519928, -0.07109109312295914, 0.0664137750864029, 0.12240489572286606, -0.06186450645327568, -0.024894794449210167, -0.12862548232078552, -0.020909490063786507, 0.08538477122783661, 0.07076585292816162, 0.09424830228090286, 0.04253542050719261, -0.2000141441822052, -0.02259528636932373, -0.03361966460943222, 0.03829622268676758, -0.013747488148510456, 0.08182564377784729, -0.11567877978086472, 0.03181886300444603, 0.0455181710422039, -0.07083441317081451, -0.08242762833833694, 0.07132352888584137, 0.06944528222084045, 0.05709279328584671, -0.02350398153066635, -0.10507971793413162, 0.035531725734472275, 0.08876567333936691, 0.09966282546520233, 0.07030875980854034, 0.04025924205780029, 0.2850753664970398, 0.05861824378371239, 0.09165263175964355, -0.14382526278495789, 0.08441593497991562, 0.045316554605960846, 0.03702057525515556, -0.0837145671248436, -0.03279166668653488, 0.05018788203597069, 0.037865396589040756, -0.02112456224858761, 0.17884181439876556, 0.03794282302260399, 0.07428967952728271, -0.0823492780327797, -0.1465669870376587, -0.06949975341558456, 0.11722125113010406, 0.05224495753645897]}','{"x": 172, "y": 48, "w": 150, "h": 210}','/uploads/profiles/student_1_d654cd4086204351b2e51d27c258b2de.jpg',1,'2026-10-01 08:48:48.085936','2026-10-01 08:48:48.085936');
INSERT INTO "student_face_profiles" VALUES (2,2,'{"model": "sface-2021dec-v1", "vector": [-0.07614411413669586, 0.0198355782777071, 0.11549421399831772, -0.004577877931296825, 0.1805940866470337, -0.01974731869995594, -0.07426553219556808, -0.14232315123081207, -0.1742153912782669, -0.043723300099372864, 0.0036661657504737377, 0.013942561112344265, -0.03725387901067734, 0.13789407908916473, -0.07450351864099503, 0.08485636860132217, -0.1136433333158493, -0.059384554624557495, -0.05138355493545532, 0.024209121242165565, -0.07851973921060562, -0.028628258034586906, -0.053872957825660706, 0.1156822219491005, -0.08204120397567749, -0.12568700313568115, -0.07245582342147827, -0.0254293754696846, -0.08598800748586655, 0.03805183246731758, 0.038325946778059006, -0.024478914216160774, 0.02893766760826111, 0.06743252277374268, 0.18470461666584015, 0.0540333017706871, 0.015324248932301998, -0.04095735773444176, -0.06295361369848251, 0.054030947387218475, -0.03715793788433075, 0.10600719600915909, -0.038085680454969406, 0.008025950752198696, 0.11012326180934906, 0.021944541484117508, 0.08173081278800964, 0.05010190233588219, 0.14259392023086548, -0.027963830158114433, 0.08343850821256638, 0.005654752254486084, 0.10025268793106079, -0.05490322411060333, 0.12910717725753784, -0.05184517055749893, 0.05473922938108444, 0.010016527026891708, 0.08758816868066788, 0.03848714381456375, -0.04550100490450859, -0.07812625169754028, -0.18373054265975952, 0.04575537517666817, 0.15652996301651, 0.05191829428076744, 0.019227351993322372, 0.10236614942550659, -0.07626748830080032, -0.08762894570827484, -0.05198799818754196, -0.09691586345434189, 0.14590220153331757, -0.07770760357379913, 0.11171958595514297, -0.18065400421619415, -0.03585393726825714, -0.037618983536958694, -0.12408263236284256, 0.12746694684028625, 0.005642938427627087, 0.0006071669049561024, -0.05149253457784653, 0.06726795434951782, -0.1330868899822235, 0.1519240140914917, 0.002002023858949542, -0.19979514181613922, 0.005551409907639027, 0.11828165501356125, 0.2139418125152588, -0.09395595639944077, 0.033032357692718506, 0.025037327781319618, 0.014350509271025658, 0.010388650000095367, -0.09600420296192169, -0.020732151344418526, 0.005399482324719429, -0.027500243857502937, 0.04579911753535271, 0.09500758349895477, -0.059369172900915146, -0.018735313788056374, -0.07223431020975113, -0.01708293706178665, 0.08049625903367996, -0.126033753156662, 0.06415175646543503, -0.02298448421061039, 0.009236267767846584, -0.10348314791917801, 0.10654367506504059, -0.23939253389835358, 0.006210433319211006, 0.05362611636519432, 0.10733699798583984, 0.15088477730751038, 0.04221878945827484, 0.05062958598136902, -0.08280773460865021, -0.057092100381851196, 0.1873687505722046, -0.007306959014385939, 0.11634988337755203, -0.012410691007971764, -0.04878295212984085, 0.022926896810531616]}','{"x": 175, "y": 126, "w": 114, "h": 150}','/uploads/profiles/student_2_a0ecbdd9a8f34fc3af2472441b0a11b5.jpg',1,'2026-10-06 07:19:29.322034','2026-10-06 07:19:29.322034');
INSERT INTO "students" VALUES (1,'STU000001','Sumit','sumit@library.com','$argon2id$v=19$m=65536,t=3,p=4$3fvfuxfiPIew1nqvNcY4hw$D/6BqVaPOxIlj5ncXXVOumh94nxvWbv2s1khX88zFC0','9883199400',10,10,'2009-02-11','','2026-10-01','4',2026,'kolkata','','',1,'/uploads/profiles/student_1_d654cd4086204351b2e51d27c258b2de.jpg','Active','2026-10-01 08:48:47.995394','2026-10-01 08:48:48.083854');
INSERT INTO "students" VALUES (2,'STU000002','Safik','admindd@library.com','$argon2id$v=19$m=65536,t=3,p=4$3bv3/r/X+h/DWItxDuGc8w$r8PP3mXJEIB9hv21aGxWzPuOTdP71Z6P7TsXZzxz++g','9883199407',12,NULL,NULL,'','2026-10-06','4',2026,'','','',1,'/uploads/profiles/student_2_a0ecbdd9a8f34fc3af2472441b0a11b5.jpg','Active','2026-10-06 07:19:29.200651','2026-10-06 07:19:29.319050');
CREATE UNIQUE INDEX IF NOT EXISTS "ix_admins_email" ON "admins" (
	"email"
);
CREATE INDEX IF NOT EXISTS "ix_admins_id" ON "admins" (
	"id"
);
CREATE INDEX IF NOT EXISTS "ix_attendance_events_id" ON "attendance_events" (
	"id"
);
CREATE INDEX IF NOT EXISTS "ix_attendance_events_student_id" ON "attendance_events" (
	"student_id"
);
CREATE INDEX IF NOT EXISTS "ix_attendance_events_timestamp" ON "attendance_events" (
	"timestamp"
);
CREATE INDEX IF NOT EXISTS "ix_attendance_sessions_check_in_time" ON "attendance_sessions" (
	"check_in_time"
);
CREATE INDEX IF NOT EXISTS "ix_attendance_sessions_id" ON "attendance_sessions" (
	"id"
);
CREATE INDEX IF NOT EXISTS "ix_attendance_sessions_session_date" ON "attendance_sessions" (
	"session_date"
);
CREATE INDEX IF NOT EXISTS "ix_attendance_sessions_student_id" ON "attendance_sessions" (
	"student_id"
);
CREATE INDEX IF NOT EXISTS "ix_attendance_settings_id" ON "attendance_settings" (
	"id"
);
CREATE UNIQUE INDEX IF NOT EXISTS "ix_attendance_settings_setting_key" ON "attendance_settings" (
	"setting_key"
);
CREATE INDEX IF NOT EXISTS "ix_audit_logs_action" ON "audit_logs" (
	"action"
);
CREATE INDEX IF NOT EXISTS "ix_audit_logs_id" ON "audit_logs" (
	"id"
);
CREATE INDEX IF NOT EXISTS "ix_audit_logs_timestamp" ON "audit_logs" (
	"timestamp"
);
CREATE INDEX IF NOT EXISTS "ix_book_authors_id" ON "book_authors" (
	"id"
);
CREATE INDEX IF NOT EXISTS "ix_book_authors_name" ON "book_authors" (
	"name"
);
CREATE INDEX IF NOT EXISTS "ix_book_categories_id" ON "book_categories" (
	"id"
);
CREATE UNIQUE INDEX IF NOT EXISTS "ix_book_categories_name" ON "book_categories" (
	"name"
);
CREATE INDEX IF NOT EXISTS "ix_book_issues_book_id" ON "book_issues" (
	"book_id"
);
CREATE INDEX IF NOT EXISTS "ix_book_issues_due_date" ON "book_issues" (
	"due_date"
);
CREATE INDEX IF NOT EXISTS "ix_book_issues_id" ON "book_issues" (
	"id"
);
CREATE INDEX IF NOT EXISTS "ix_book_issues_issue_date" ON "book_issues" (
	"issue_date"
);
CREATE INDEX IF NOT EXISTS "ix_book_issues_return_date" ON "book_issues" (
	"return_date"
);
CREATE INDEX IF NOT EXISTS "ix_book_issues_status" ON "book_issues" (
	"status"
);
CREATE INDEX IF NOT EXISTS "ix_book_issues_student_id" ON "book_issues" (
	"student_id"
);
CREATE INDEX IF NOT EXISTS "ix_books_id" ON "books" (
	"id"
);
CREATE UNIQUE INDEX IF NOT EXISTS "ix_books_isbn" ON "books" (
	"isbn"
);
CREATE INDEX IF NOT EXISTS "ix_books_title" ON "books" (
	"title"
);
CREATE UNIQUE INDEX IF NOT EXISTS "ix_cameras_camera_code" ON "cameras" (
	"camera_code"
);
CREATE INDEX IF NOT EXISTS "ix_cameras_id" ON "cameras" (
	"id"
);
CREATE UNIQUE INDEX IF NOT EXISTS "ix_courses_code" ON "courses" (
	"code"
);
CREATE INDEX IF NOT EXISTS "ix_courses_id" ON "courses" (
	"id"
);
CREATE UNIQUE INDEX IF NOT EXISTS "ix_departments_code" ON "departments" (
	"code"
);
CREATE INDEX IF NOT EXISTS "ix_departments_id" ON "departments" (
	"id"
);
CREATE UNIQUE INDEX IF NOT EXISTS "ix_holidays_holiday_date" ON "holidays" (
	"holiday_date"
);
CREATE INDEX IF NOT EXISTS "ix_holidays_id" ON "holidays" (
	"id"
);
CREATE INDEX IF NOT EXISTS "ix_password_reset_tokens_expires_at" ON "password_reset_tokens" (
	"expires_at"
);
CREATE INDEX IF NOT EXISTS "ix_password_reset_tokens_id" ON "password_reset_tokens" (
	"id"
);
CREATE INDEX IF NOT EXISTS "ix_password_reset_tokens_owner_id" ON "password_reset_tokens" (
	"owner_id"
);
CREATE UNIQUE INDEX IF NOT EXISTS "ix_password_reset_tokens_token_hash" ON "password_reset_tokens" (
	"token_hash"
);
CREATE INDEX IF NOT EXISTS "ix_student_face_profiles_id" ON "student_face_profiles" (
	"id"
);
CREATE UNIQUE INDEX IF NOT EXISTS "ix_students_email" ON "students" (
	"email"
);
CREATE INDEX IF NOT EXISTS "ix_students_full_name" ON "students" (
	"full_name"
);
CREATE INDEX IF NOT EXISTS "ix_students_id" ON "students" (
	"id"
);
CREATE UNIQUE INDEX IF NOT EXISTS "ix_students_student_id" ON "students" (
	"student_id"
);
COMMIT;
