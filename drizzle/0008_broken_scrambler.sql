CREATE TABLE `payout_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creator_id` int NOT NULL,
	`bank_code` int NOT NULL,
	`bank_name` varchar(160) NOT NULL,
	`account_name` varchar(180) NOT NULL,
	`account_number` varchar(60) NOT NULL,
	`currency_code` varchar(8) NOT NULL DEFAULT 'ETB',
	`is_verified` boolean NOT NULL DEFAULT false,
	`verified_by` varchar(36),
	`verified_at` timestamp(3),
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `payout_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `payout_accounts_creator_idx` UNIQUE(`creator_id`)
);
--> statement-breakpoint
CREATE TABLE `payouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`booking_id` int NOT NULL,
	`creator_id` int NOT NULL,
	`payout_account_id` int,
	`reference` varchar(100) NOT NULL,
	`provider` varchar(30) NOT NULL DEFAULT 'chapa',
	`status` enum('pending','queued','success','failed','cancelled') NOT NULL DEFAULT 'pending',
	`amount` int NOT NULL DEFAULT 0,
	`currency_code` varchar(8) NOT NULL DEFAULT 'ETB',
	`bank_code` int NOT NULL,
	`bank_name` varchar(160) NOT NULL,
	`account_name` varchar(180) NOT NULL,
	`account_number` varchar(60) NOT NULL,
	`provider_ref` varchar(120),
	`mode` varchar(10),
	`failure_reason` varchar(300),
	`verified_at` timestamp(3),
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `payouts_id` PRIMARY KEY(`id`),
	CONSTRAINT `payouts_reference_idx` UNIQUE(`reference`)
);
--> statement-breakpoint
ALTER TABLE `payout_accounts` ADD CONSTRAINT `payout_accounts_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payout_accounts` ADD CONSTRAINT `payout_accounts_verified_by_user_id_fk` FOREIGN KEY (`verified_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payouts` ADD CONSTRAINT `payouts_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payouts` ADD CONSTRAINT `payouts_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payouts` ADD CONSTRAINT `payouts_payout_account_id_payout_accounts_id_fk` FOREIGN KEY (`payout_account_id`) REFERENCES `payout_accounts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `payouts_booking_idx` ON `payouts` (`booking_id`);--> statement-breakpoint
CREATE INDEX `payouts_creator_idx` ON `payouts` (`creator_id`);--> statement-breakpoint
CREATE INDEX `payouts_status_idx` ON `payouts` (`status`);