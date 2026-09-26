CREATE TABLE `hero_slides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`image` varchar(500) NOT NULL DEFAULT '',
	`alt` varchar(250) NOT NULL DEFAULT '',
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `hero_slides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `site_settings` ADD `home_market_code` varchar(2) DEFAULT 'ET' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `public_requires_price` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `hero_interval_seconds` int DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `social_instagram_url` varchar(300) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `social_instagram_followers` int;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `social_tiktok_url` varchar(300) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `social_tiktok_followers` int;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `social_facebook_url` varchar(300) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `social_facebook_followers` int;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `social_youtube_url` varchar(300) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `social_youtube_followers` int;