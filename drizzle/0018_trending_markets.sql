CREATE TABLE `trending_market_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`country_id` int NOT NULL,
	`creator_id` int NOT NULL,
	`rank` int NOT NULL,
	`trending_score` double NOT NULL DEFAULT 0,
	`source` enum('pinned','algorithm','manual') NOT NULL DEFAULT 'algorithm',
	`run_id` int,
	`computed_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `trending_market_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `trending_market_entry_idx` UNIQUE(`country_id`,`creator_id`)
);
--> statement-breakpoint
ALTER TABLE `trending_config` MODIFY COLUMN `local_ranking` enum('off','boost','first','only') NOT NULL DEFAULT 'off';--> statement-breakpoint
ALTER TABLE `trending_lanes` ADD `market_country_id` int;--> statement-breakpoint
ALTER TABLE `trending_market_entries` ADD CONSTRAINT `trending_market_entries_country_id_countries_id_fk` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trending_market_entries` ADD CONSTRAINT `trending_market_entries_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `trending_market_rank_idx` ON `trending_market_entries` (`country_id`,`rank`);--> statement-breakpoint
ALTER TABLE `trending_lanes` ADD CONSTRAINT `trending_lanes_market_country_id_countries_id_fk` FOREIGN KEY (`market_country_id`) REFERENCES `countries`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `trending_lane_market_idx` ON `trending_lanes` (`market_country_id`,`position`);