CREATE TABLE `booking_reads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`booking_id` int NOT NULL,
	`last_read_at` timestamp(3) NOT NULL,
	CONSTRAINT `booking_reads_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_read_user_booking_idx` UNIQUE(`user_id`,`booking_id`)
);
--> statement-breakpoint
ALTER TABLE `booking_reads` ADD CONSTRAINT `booking_reads_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_reads` ADD CONSTRAINT `booking_reads_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `notifications_unread_idx` ON `notifications` (`user_id`,`read_at`);