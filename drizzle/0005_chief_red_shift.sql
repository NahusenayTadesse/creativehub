ALTER TABLE `trending_config` ADD `country_id` int;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `local_ranking` enum('off','boost','first') DEFAULT 'off' NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `local_match` enum('country','region','city') DEFAULT 'country' NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD `local_boost` int DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `trending_config` ADD CONSTRAINT `trending_config_country_id_countries_id_fk` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE no action ON UPDATE no action;