ALTER TABLE `campaigns` ADD `match_notified_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `user_settings` ADD `opportunities_email` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `opportunities_app` boolean DEFAULT true NOT NULL;--> statement-breakpoint
/* Briefs already live were published before anyone could be told about them.
   Marking them as told means editing one after this ships changes nothing for
   creators, rather than sending a burst of "new" campaigns that are not new. */
UPDATE `campaigns` SET `match_notified_at` = COALESCE(`updated_at`, NOW(3))
WHERE `status` = 'published' AND `match_notified_at` IS NULL;
