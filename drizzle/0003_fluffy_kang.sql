CREATE TABLE `user_settings` (
	`user_id` varchar(36) NOT NULL,
	`deals_email` boolean NOT NULL DEFAULT true,
	`deals_app` boolean NOT NULL DEFAULT true,
	`messages_email` boolean NOT NULL DEFAULT true,
	`messages_app` boolean NOT NULL DEFAULT true,
	`account_email` boolean NOT NULL DEFAULT true,
	`product_email` boolean NOT NULL DEFAULT false,
	`closure_requested_at` timestamp(3),
	`closure_reason` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `user_settings_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `user_settings` ADD CONSTRAINT `user_settings_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;