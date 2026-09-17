ALTER TABLE `site_settings` MODIFY COLUMN `hero_title` varchar(250) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `categories` ADD `image` varchar(500) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `hero_accent` varchar(250) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `hero_image` varchar(500) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `gallery_interval_seconds` int DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `landing_sections` json;--> statement-breakpoint
/* The headline and subtitle a fresh install was seeded with are the English
   copy of the translated text the page falls back to. Left in place, the page
   would start showing that English to Amharic readers the moment it began
   reading these columns — so a value still exactly as seeded is emptied, and
   only something an operator actually typed survives as an override. */
UPDATE `site_settings` SET `hero_title` = '' WHERE `hero_title` = 'Find the right creator. Build the right campaign.';
--> statement-breakpoint
UPDATE `site_settings` SET `hero_subtitle` = NULL WHERE `hero_subtitle` IN (
	'Ethiopia’s managed creator marketplace. Work with verified creators across TikTok, Telegram, YouTube and Instagram, agree terms that are recorded, and track delivery through to completion.',
	'Ethiopia''s managed creator marketplace. Work with verified creators across TikTok, Telegram, YouTube and Instagram, agree terms that are recorded, and track delivery through to completion.'
);
