CREATE TABLE `staff_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`role` varchar(32) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`accepted_at` timestamp(3),
	`revoked_at` timestamp(3),
	`accepted_user_id` varchar(36),
	`invited_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_invites_token_idx` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE INDEX `staff_invites_email_idx` ON `staff_invites` (`email`);