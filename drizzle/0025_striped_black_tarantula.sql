CREATE TABLE `platform_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`social_account_id` int NOT NULL,
	`creator_id` int NOT NULL,
	`provider` enum('tiktok') NOT NULL,
	`external_id` varchar(191) NOT NULL,
	`external_username` varchar(191),
	`access_token` text NOT NULL,
	`access_token_expires_at` timestamp(3) NOT NULL,
	`refresh_token` text,
	`refresh_token_expires_at` timestamp(3),
	`scope` varchar(500),
	`connected_at` timestamp(3) NOT NULL DEFAULT (now()),
	`last_synced_at` timestamp(3),
	`last_sync_detail` varchar(80),
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `platform_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `connection_account_idx` UNIQUE(`social_account_id`)
);
--> statement-breakpoint
ALTER TABLE `platform_connections` ADD CONSTRAINT `platform_connections_social_account_id_social_accounts_id_fk` FOREIGN KEY (`social_account_id`) REFERENCES `social_accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `platform_connections` ADD CONSTRAINT `platform_connections_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `connection_creator_idx` ON `platform_connections` (`creator_id`);