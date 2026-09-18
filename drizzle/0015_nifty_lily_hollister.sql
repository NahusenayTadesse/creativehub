CREATE TABLE `social_account_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`social_account_id` int NOT NULL,
	`creator_id` int NOT NULL,
	`followers` int NOT NULL,
	`engagement_rate` double NOT NULL DEFAULT 0,
	`followers_source` enum('self_reported','imported','proof','platform') NOT NULL,
	`recorded_on` date NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `social_account_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `snapshot_account_day_idx` UNIQUE(`social_account_id`,`recorded_on`)
);
--> statement-breakpoint
CREATE TABLE `trending_presets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`description` varchar(200),
	`weights` json NOT NULL,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `trending_presets_id` PRIMARY KEY(`id`),
	CONSTRAINT `trending_preset_name_idx` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `trending_config` MODIFY COLUMN `normalization` enum('percentile','minmax','log') NOT NULL DEFAULT 'percentile';--> statement-breakpoint
ALTER TABLE `trending_lanes` MODIFY COLUMN `kind` enum('category','country','region','city','platform','language','tier') NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `weight_engaged_audience` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `weight_growth` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `weight_confirmed` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `weight_momentum` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `weight_responsiveness` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `weight_reliability` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `reach_mode` enum('total','primary','largest') DEFAULT 'total' NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `engagement_mode` enum('average','weighted','best') DEFAULT 'average' NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `audience_platform_ids` json DEFAULT ('[]') NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `engagement_cap` double DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `unconfirmed_discount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `growth_confirmed_only` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `rating_prior_reviews` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `max_followers` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `follower_tiers` json DEFAULT ('[]') NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `min_channel_followers` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `min_engagement_rate` double DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `max_engagement_rate` double DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `require_platform_ids` json DEFAULT ('[]') NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `require_confirmed_stats` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `max_stats_age_days` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `require_claimed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `min_completed_bookings` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `min_response_rate` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `min_profile_age_days` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `max_profile_age_days` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `include_category_ids` json DEFAULT ('[]') NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `exclude_category_ids` json DEFAULT ('[]') NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `max_per_city` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `max_per_tier` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `max_per_platform` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `incumbent_bonus` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `max_new_per_run` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `newcomer_slots` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `newcomer_max_age_days` int DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `max_tier_lanes` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_overrides` ADD `starts_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `social_account_snapshots` ADD CONSTRAINT `social_account_snapshots_social_account_id_social_accounts_id_fk` FOREIGN KEY (`social_account_id`) REFERENCES `social_accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `social_account_snapshots` ADD CONSTRAINT `social_account_snapshots_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `snapshot_creator_day_idx` ON `social_account_snapshots` (`creator_id`,`recorded_on`);--> statement-breakpoint
/* Backfill: one snapshot per live channel, dated when its follower figure was
   last set, so growth has a starting point from the day this ships rather than
   from the first write after it. */
INSERT INTO `social_account_snapshots`
	(`social_account_id`, `creator_id`, `followers`, `engagement_rate`, `followers_source`, `recorded_on`)
SELECT `id`, `creator_id`, `followers`, `engagement_rate`, `followers_source`,
	DATE(COALESCE(`followers_updated_at`, `updated_at`))
FROM `social_accounts`
WHERE `deleted_at` IS NULL;
