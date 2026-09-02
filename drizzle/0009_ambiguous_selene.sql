CREATE TABLE `disputes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`booking_id` int NOT NULL,
	`raised_by` varchar(36),
	`raised_by_side` enum('creator','organization') NOT NULL,
	`reason` text NOT NULL,
	`evidence_url` varchar(500),
	`responded_by` varchar(36),
	`response_text` text,
	`response_evidence_url` varchar(500),
	`responded_at` timestamp(3),
	`status` enum('open','resolved','withdrawn') NOT NULL DEFAULT 'open',
	`resolution` enum('released','refunded','split'),
	`refund_amount` int NOT NULL DEFAULT 0,
	`payout_amount` int NOT NULL DEFAULT 0,
	`resolution_note` text,
	`resolved_by` varchar(36),
	`resolved_at` timestamp(3),
	`after_payout` boolean NOT NULL DEFAULT false,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `disputes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`booking_id` int NOT NULL,
	`payment_id` int,
	`tx_ref` varchar(100) NOT NULL,
	`dispute_id` int,
	`reference` varchar(100) NOT NULL,
	`provider` varchar(30) NOT NULL DEFAULT 'chapa',
	`status` enum('pending','queued','success','failed','cancelled') NOT NULL DEFAULT 'pending',
	`amount` int NOT NULL DEFAULT 0,
	`currency_code` varchar(8) NOT NULL DEFAULT 'ETB',
	`reason` varchar(300),
	`provider_ref` varchar(120),
	`mode` varchar(10),
	`failure_reason` varchar(300),
	`verified_at` timestamp(3),
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `refunds_id` PRIMARY KEY(`id`),
	CONSTRAINT `refunds_reference_idx` UNIQUE(`reference`)
);
--> statement-breakpoint
ALTER TABLE `bookings` ADD `cancel_requested_by` varchar(36);--> statement-breakpoint
ALTER TABLE `bookings` ADD `cancel_requested_side` enum('creator','organization');--> statement-breakpoint
ALTER TABLE `bookings` ADD `cancel_requested_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `bookings` ADD `cancel_request_reason` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `dispute_window_days` int DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE `disputes` ADD CONSTRAINT `disputes_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `disputes` ADD CONSTRAINT `disputes_raised_by_user_id_fk` FOREIGN KEY (`raised_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `disputes` ADD CONSTRAINT `disputes_responded_by_user_id_fk` FOREIGN KEY (`responded_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `disputes` ADD CONSTRAINT `disputes_resolved_by_user_id_fk` FOREIGN KEY (`resolved_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_payment_id_payments_id_fk` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `disputes_booking_idx` ON `disputes` (`booking_id`);--> statement-breakpoint
CREATE INDEX `disputes_status_idx` ON `disputes` (`status`);--> statement-breakpoint
CREATE INDEX `refunds_booking_idx` ON `refunds` (`booking_id`);--> statement-breakpoint
CREATE INDEX `refunds_status_idx` ON `refunds` (`status`);--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_cancel_requested_by_user_id_fk` FOREIGN KEY (`cancel_requested_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;