ALTER TABLE `contracts` ADD `platform_signer_name` varchar(200);--> statement-breakpoint
ALTER TABLE `contracts` ADD `platform_signed_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `creators` ADD `tin` varchar(40);--> statement-breakpoint
ALTER TABLE `organizations` ADD `tin` varchar(40);--> statement-breakpoint
ALTER TABLE `site_settings` ADD `invoice_payment_instructions` text;