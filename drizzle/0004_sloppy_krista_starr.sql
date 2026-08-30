CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`booking_id` int NOT NULL,
	`tx_ref` varchar(100) NOT NULL,
	`provider` varchar(30) NOT NULL DEFAULT 'chapa',
	`status` enum('pending','success','failed','cancelled') NOT NULL DEFAULT 'pending',
	`amount` int NOT NULL DEFAULT 0,
	`currency_code` varchar(8) NOT NULL DEFAULT 'ETB',
	`method` varchar(40),
	`provider_ref` varchar(120),
	`mode` varchar(10),
	`failure_reason` varchar(300),
	`verified_at` timestamp(3),
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_tx_ref_idx` UNIQUE(`tx_ref`)
);
--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `payments_booking_idx` ON `payments` (`booking_id`);