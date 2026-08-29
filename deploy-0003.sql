-- ============================================================================
--  Creator Network — migration 0003_fluffy_kang
--
--  Run in phpMyAdmin's SQL tab against the `creator` database.
--
--  Adds `user_settings`: per-account notification preferences and the record
--  of a closure request. One new table, purely additive — it touches nothing
--  that already exists, and no existing row changes.
--
--  STEP 1  create the table, with its collation stated explicitly
--  STEP 2  the foreign key
--  STEP 3  record the migration as applied
--
--  The collation is named rather than left to the database default. That is
--  the exact thing that stopped the last run: a table created on a different
--  collation from `user` cannot carry a foreign key to it, because InnoDB
--  refuses a key between two string columns whose collations differ. The
--  default is now correct, so this is belt and braces — but it costs nothing
--  and it is the failure that already happened once.
-- ============================================================================


-- ============================================================================
-- STEP 1 — the table
-- ============================================================================

CREATE TABLE `user_settings` (
	`user_id` varchar(36) NOT NULL,
	`deals_email` boolean NOT NULL DEFAULT true,
	`deals_app` boolean NOT NULL DEFAULT true,
	`messages_email` boolean NOT NULL DEFAULT true,
	`messages_app` boolean NOT NULL DEFAULT true,
	`account_email` boolean NOT NULL DEFAULT true,
	`product_email` boolean NOT NULL DEFAULT false,
	`closure_requested_at` timestamp(3) NULL,
	`closure_reason` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `user_settings_user_id` PRIMARY KEY(`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- ============================================================================
-- STEP 2 — the foreign key
-- ============================================================================

ALTER TABLE `user_settings`
	ADD CONSTRAINT `user_settings_user_id_user_id_fk`
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
	ON DELETE cascade ON UPDATE no action;


-- ============================================================================
-- STEP 3 — record it as applied
--
-- sha256 of drizzle/0003_fluffy_kang.sql. Run this LAST, and only if steps 1 and 2
-- succeeded, so a failure leaves nothing recorded and the script safe to redo.
-- ============================================================================

INSERT INTO `__drizzle_migrations` (hash, created_at) VALUES
	('42d5bfcd834125169c2ddf49d89a8f9ba1f3700ea896c8910d4a1160ccae0f33', 1787668548822);


-- ============================================================================
-- Afterwards — paste this to confirm. Expected: 1, 1, 4
-- ============================================================================
--
-- SELECT
--   (SELECT COUNT(*) FROM information_schema.tables
--     WHERE table_schema = DATABASE() AND table_name = 'user_settings')   AS the_table,
--   (SELECT COUNT(*) FROM information_schema.table_constraints
--     WHERE table_schema = DATABASE() AND table_name = 'user_settings'
--       AND constraint_type = 'FOREIGN KEY')                              AS foreign_key,
--   (SELECT COUNT(*) FROM `__drizzle_migrations`)                         AS migrations_recorded;
