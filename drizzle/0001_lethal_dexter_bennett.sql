ALTER TABLE `bookings` ADD `introduction_status` enum('none','pending','contacted','connected','declined') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `introduction_note` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `introduced_by` varchar(36);--> statement-breakpoint
ALTER TABLE `bookings` ADD `introduced_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_introduced_by_user_id_fk` FOREIGN KEY (`introduced_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `bookings_introduction_idx` ON `bookings` (`introduction_status`);--> statement-breakpoint
-- Deals already opened against a profile nobody has claimed. They were written
-- before the guard existed and are still waiting on a creator who cannot answer,
-- so they belong in the operator queue rather than sitting invisible at 'none'.
-- Settled deals are left alone: there is nothing left to introduce.
UPDATE `bookings` b
	JOIN `creators` c ON c.`id` = b.`creator_id`
	SET b.`introduction_status` = 'pending'
	WHERE c.`is_claimed` = 0
		AND c.`user_id` IS NULL
		AND b.`status` IN ('proposed', 'negotiating');
