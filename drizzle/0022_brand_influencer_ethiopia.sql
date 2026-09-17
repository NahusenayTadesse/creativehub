ALTER TABLE `site_settings` MODIFY COLUMN `site_name` varchar(180) NOT NULL DEFAULT 'Influencer Ethiopia';--> statement-breakpoint
/* The platform is Influencer Ethiopia now. A site name still at the old default
   is renamed with it; one an operator chose themselves is left as they set it. */
UPDATE `site_settings` SET `site_name` = 'Influencer Ethiopia' WHERE `site_name` = 'Creator Network';
