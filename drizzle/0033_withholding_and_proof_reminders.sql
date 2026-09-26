ALTER TABLE `bookings` ADD `withholding_tax` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `post_proofs` ADD `reminded_checkpoints` json DEFAULT ('[]') NOT NULL;--> statement-breakpoint
ALTER TABLE `proof_metrics` DROP COLUMN `reminded_at`;