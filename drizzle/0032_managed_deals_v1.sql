CREATE TABLE `concepts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`booking_id` int NOT NULL,
	`body` text NOT NULL,
	`attachment` varchar(500),
	`status` enum('submitted','approved','changes_requested') NOT NULL DEFAULT 'submitted',
	`review_note` text,
	`reviewed_by` varchar(36),
	`reviewed_at` timestamp(3),
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `concepts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`booking_id` int NOT NULL,
	`reference` varchar(40) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`body` mediumtext NOT NULL,
	`body_hash` varchar(64) NOT NULL,
	`status` enum('awaiting_signatures','signed','void') NOT NULL DEFAULT 'awaiting_signatures',
	`brand_signer_id` varchar(36),
	`brand_signer_name` varchar(180),
	`brand_signed_at` timestamp(3),
	`brand_signer_ip` varchar(64),
	`creator_signer_id` varchar(36),
	`creator_signer_name` varchar(180),
	`creator_signed_at` timestamp(3),
	`creator_signer_ip` varchar(64),
	`signed_at` timestamp(3),
	`voided_at` timestamp(3),
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `contracts_id` PRIMARY KEY(`id`),
	CONSTRAINT `contracts_reference_idx` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`booking_id` int NOT NULL,
	`kind` enum('brand_invoice','creator_statement','withholding_certificate') NOT NULL,
	`number` varchar(40) NOT NULL,
	`year` int NOT NULL,
	`sequence` int NOT NULL,
	`organization_id` int,
	`creator_id` int,
	`data` json NOT NULL,
	`total` int NOT NULL DEFAULT 0,
	`currency_code` varchar(8) NOT NULL DEFAULT 'ETB',
	`issued_at` timestamp(3) NOT NULL DEFAULT (now()),
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `documents_number_idx` UNIQUE(`number`),
	CONSTRAINT `documents_sequence_idx` UNIQUE(`kind`,`year`,`sequence`),
	CONSTRAINT `documents_booking_kind_idx` UNIQUE(`booking_id`,`kind`)
);
--> statement-breakpoint
CREATE TABLE `identity_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`creator_id` int,
	`provider` varchar(20) NOT NULL DEFAULT 'fayda',
	`status` enum('pending','verified','failed') NOT NULL DEFAULT 'pending',
	`reference` varchar(255),
	`verified_name` varchar(180),
	`failure_reason` varchar(250),
	`verified_at` timestamp(3),
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `identity_checks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nda_acceptances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`organization_id` int NOT NULL,
	`subject_type` enum('campaign','booking') NOT NULL,
	`subject_id` int NOT NULL,
	`nda_version` varchar(20) NOT NULL,
	`ip` varchar(64),
	`accepted_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `nda_acceptances_id` PRIMARY KEY(`id`),
	CONSTRAINT `nda_subject_idx` UNIQUE(`user_id`,`subject_type`,`subject_id`)
);
--> statement-breakpoint
CREATE TABLE `post_proofs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`booking_id` int NOT NULL,
	`live_url` varchar(500) NOT NULL,
	`screenshot` varchar(500) NOT NULL,
	`posted_at` timestamp(3) NOT NULL,
	`notes` text,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `post_proofs_id` PRIMARY KEY(`id`),
	CONSTRAINT `post_proofs_booking_idx` UNIQUE(`booking_id`)
);
--> statement-breakpoint
CREATE TABLE `proof_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proof_id` int NOT NULL,
	`booking_id` int NOT NULL,
	`checkpoint` enum('24h','7d','30d') NOT NULL,
	`views` int,
	`likes` int,
	`comments` int,
	`shares` int,
	`saves` int,
	`reach` int,
	`screenshot` varchar(500) NOT NULL,
	`captured_at` timestamp(3) NOT NULL DEFAULT (now()),
	`reminded_at` timestamp(3),
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `proof_metrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `proof_metrics_checkpoint_idx` UNIQUE(`proof_id`,`checkpoint`)
);
--> statement-breakpoint
ALTER TABLE `bookings` MODIFY COLUMN `status` enum('proposed','negotiating','contracting','booked','concept','in_production','submitted','revision','approved','awaiting_settlement','completed','cancelled','disputed') NOT NULL DEFAULT 'proposed';--> statement-breakpoint
ALTER TABLE `bookings` ADD `commission_percent` double DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `brand_service_fee` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `brand_service_fee_vat` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `brand_total` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `confidential` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `industry` varchar(120);--> statement-breakpoint
ALTER TABLE `organizations` ADD `average_rating` double DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `reviews_count` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `commission_tiers` json;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `min_commission` int DEFAULT 1500 NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `min_project_size` int DEFAULT 5000 NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `brand_service_fee_percent` double DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `vat_registered` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `vat_percent` double DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `withholding_percent` double DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `invoice_legal_name` varchar(200) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `invoice_tin` varchar(40) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `invoice_vat_number` varchar(40) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `invoice_address` text;--> statement-breakpoint
ALTER TABLE `concepts` ADD CONSTRAINT `concepts_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `concepts` ADD CONSTRAINT `concepts_reviewed_by_user_id_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_brand_signer_id_user_id_fk` FOREIGN KEY (`brand_signer_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_creator_signer_id_user_id_fk` FOREIGN KEY (`creator_signer_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `identity_checks` ADD CONSTRAINT `identity_checks_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `identity_checks` ADD CONSTRAINT `identity_checks_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `nda_acceptances` ADD CONSTRAINT `nda_acceptances_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `nda_acceptances` ADD CONSTRAINT `nda_acceptances_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_proofs` ADD CONSTRAINT `post_proofs_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proof_metrics` ADD CONSTRAINT `proof_metrics_proof_id_post_proofs_id_fk` FOREIGN KEY (`proof_id`) REFERENCES `post_proofs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proof_metrics` ADD CONSTRAINT `proof_metrics_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `concepts_booking_idx` ON `concepts` (`booking_id`);--> statement-breakpoint
CREATE INDEX `contracts_booking_idx` ON `contracts` (`booking_id`);--> statement-breakpoint
CREATE INDEX `documents_org_idx` ON `documents` (`organization_id`);--> statement-breakpoint
CREATE INDEX `documents_creator_idx` ON `documents` (`creator_id`);--> statement-breakpoint
CREATE INDEX `identity_checks_user_idx` ON `identity_checks` (`user_id`);--> statement-breakpoint
CREATE INDEX `identity_checks_reference_idx` ON `identity_checks` (`reference`);--> statement-breakpoint
CREATE INDEX `proof_metrics_booking_idx` ON `proof_metrics` (`booking_id`);--> statement-breakpoint
/* Deals written before the rate card: the brand paid the price and nothing on
   top, and the commission they carry is the flat fee they were agreed at. */
UPDATE `bookings` SET `brand_total` = `price`, `commission_percent` = IF(`price` > 0, ROUND(`platform_fee` * 100 / `price`, 2), 0) WHERE `brand_total` = 0;