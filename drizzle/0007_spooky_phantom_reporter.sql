CREATE TABLE `trending_lane_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lane_id` int NOT NULL,
	`creator_id` int NOT NULL,
	`rank` int NOT NULL,
	`trending_score` double NOT NULL DEFAULT 0,
	`source` enum('pinned','algorithm','manual') NOT NULL DEFAULT 'algorithm',
	CONSTRAINT `trending_lane_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trending_lanes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` enum('category','country','region','city','platform','language') NOT NULL,
	`ref_id` int,
	`ref_key` varchar(160),
	`label` varchar(180) NOT NULL,
	`position` int NOT NULL,
	`size` int NOT NULL,
	`top_score` double NOT NULL DEFAULT 0,
	`run_id` int,
	`computed_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `trending_lanes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `trending_config` ADD `lane_slots` int DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `lane_min_size` int DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `lane_pool_size` int DEFAULT 120 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `max_category_lanes` int DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `max_country_lanes` int DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `max_region_lanes` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `max_city_lanes` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `max_platform_lanes` int DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `max_language_lanes` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `lane_local_first` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_lane_entries` ADD CONSTRAINT `trending_lane_entries_lane_id_trending_lanes_id_fk` FOREIGN KEY (`lane_id`) REFERENCES `trending_lanes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trending_lane_entries` ADD CONSTRAINT `trending_lane_entries_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `trending_lane_entry_idx` ON `trending_lane_entries` (`lane_id`,`rank`);--> statement-breakpoint
CREATE INDEX `trending_lane_position_idx` ON `trending_lanes` (`position`);