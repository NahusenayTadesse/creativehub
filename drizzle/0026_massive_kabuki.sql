ALTER TABLE `social_account_snapshots` MODIFY COLUMN `followers_source` enum('self_reported','imported','proof','bio_code','platform') NOT NULL;--> statement-breakpoint
ALTER TABLE `social_accounts` MODIFY COLUMN `followers_source` enum('self_reported','imported','proof','bio_code','platform') NOT NULL DEFAULT 'self_reported';--> statement-breakpoint
ALTER TABLE `social_accounts` MODIFY COLUMN `engagement_source` enum('self_reported','imported','proof','bio_code','platform') NOT NULL DEFAULT 'self_reported';--> statement-breakpoint
ALTER TABLE `social_accounts` ADD `ownership_code` varchar(16);--> statement-breakpoint
ALTER TABLE `social_accounts` ADD `ownership_status` enum('none','pending','verified','unverified') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `social_accounts` ADD `ownership_checked_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `social_accounts` ADD `ownership_detail` varchar(80);--> statement-breakpoint
ALTER TABLE `social_accounts` ADD `ownership_verified_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `social_accounts` ADD `verified_handle` varchar(160);--> statement-breakpoint
ALTER TABLE `social_accounts` ADD CONSTRAINT `social_verified_handle_idx` UNIQUE(`platform_id`,`verified_handle`);