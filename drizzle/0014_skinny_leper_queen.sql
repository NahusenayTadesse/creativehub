CREATE TABLE `stat_proofs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creator_id` int NOT NULL,
	`social_account_id` int NOT NULL,
	`screenshot` varchar(500) NOT NULL,
	`followers` int NOT NULL,
	`engagement_rate` double,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`admin_notes` text,
	`reviewed_by` varchar(36),
	`reviewed_at` timestamp(3),
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `stat_proofs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `creators` ADD `response_rate` int;--> statement-breakpoint
ALTER TABLE `creators` ADD `response_sample` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `creators` ADD `median_response_minutes` int;--> statement-breakpoint
ALTER TABLE `creators` ADD `on_time_rate` int;--> statement-breakpoint
ALTER TABLE `creators` ADD `on_time_sample` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `creators` ADD `metrics_measured_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `social_accounts` ADD `followers_source` enum('self_reported','imported','proof','platform') DEFAULT 'self_reported' NOT NULL;--> statement-breakpoint
ALTER TABLE `social_accounts` ADD `followers_updated_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `social_accounts` ADD `engagement_source` enum('self_reported','imported','proof','platform') DEFAULT 'self_reported' NOT NULL;--> statement-breakpoint
ALTER TABLE `social_accounts` ADD `engagement_updated_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `social_accounts` ADD `stats_fetched_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `social_accounts` ADD `stats_fetch_detail` varchar(80);--> statement-breakpoint
ALTER TABLE `stat_proofs` ADD CONSTRAINT `stat_proofs_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stat_proofs` ADD CONSTRAINT `stat_proofs_social_account_id_social_accounts_id_fk` FOREIGN KEY (`social_account_id`) REFERENCES `social_accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stat_proofs` ADD CONSTRAINT `stat_proofs_reviewed_by_user_id_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `stat_proof_status_idx` ON `stat_proofs` (`status`);--> statement-breakpoint
CREATE INDEX `stat_proof_social_idx` ON `stat_proofs` (`social_account_id`);--> statement-breakpoint
/* Backfill. Channels on a profile nobody has claimed came in through the
   research import, not from the creator; everything else was typed in on the
   channels form. */
UPDATE `social_accounts` sa
	JOIN `creators` c ON c.`id` = sa.`creator_id`
	SET sa.`followers_source` = 'imported', sa.`engagement_source` = 'imported'
	WHERE c.`user_id` IS NULL;--> statement-breakpoint
/* The row's last write is the best record there is of when a figure was set.
   An engagement rate of 0 is "none on file", so it gets no date. */
UPDATE `social_accounts`
	SET `followers_updated_at` = `updated_at`,
		`engagement_updated_at` = IF(`engagement_rate` > 0, `updated_at`, NULL);
