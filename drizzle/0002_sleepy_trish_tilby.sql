CREATE TABLE `creator_claims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creator_id` int NOT NULL,
	`claimant_id` varchar(36) NOT NULL,
	`status` enum('pending','approved','rejected','withdrawn') NOT NULL DEFAULT 'pending',
	`evidence` text,
	`proof_url` varchar(500),
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
	CONSTRAINT `creator_claims_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `creator_claims` ADD CONSTRAINT `creator_claims_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creator_claims` ADD CONSTRAINT `creator_claims_claimant_id_user_id_fk` FOREIGN KEY (`claimant_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creator_claims` ADD CONSTRAINT `creator_claims_reviewed_by_user_id_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `claim_status_idx` ON `creator_claims` (`status`);--> statement-breakpoint
CREATE INDEX `claim_creator_idx` ON `creator_claims` (`creator_id`);