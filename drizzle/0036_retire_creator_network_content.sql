/* The platform was renamed to Influencer Ethiopia in 0022, which rewrote the
   site name but not the prose written under the old one. The house articles
   and their bylines still said "Creator Network" on the public blog. */
UPDATE `blog_posts`
SET `author_name` = 'Influencer Ethiopia'
WHERE `author_name` IN ('Creator Network', 'CreatorNetwork');--> statement-breakpoint
UPDATE `blog_posts`
SET `title` = REPLACE(`title`, 'Creator Network', 'Influencer Ethiopia'),
	`excerpt` = REPLACE(`excerpt`, 'Creator Network', 'Influencer Ethiopia'),
	`body` = REPLACE(`body`, 'Creator Network', 'Influencer Ethiopia'),
	`search_text` = REPLACE(`search_text`, 'Creator Network', 'Influencer Ethiopia'),
	`featured_image_alt` = REPLACE(`featured_image_alt`, 'Creator Network', 'Influencer Ethiopia'),
	`meta_title` = REPLACE(`meta_title`, 'Creator Network', 'Influencer Ethiopia'),
	`meta_description` = REPLACE(`meta_description`, 'Creator Network', 'Influencer Ethiopia')
WHERE CONCAT_WS(' ', `title`, `excerpt`, `body`, `featured_image_alt`, `meta_title`, `meta_description`)
	LIKE '%Creator Network%';--> statement-breakpoint
UPDATE `blog_categories`
SET `name` = REPLACE(`name`, 'Creator Network', 'Influencer Ethiopia'),
	`description` = REPLACE(`description`, 'Creator Network', 'Influencer Ethiopia')
WHERE CONCAT_WS(' ', `name`, `description`) LIKE '%Creator Network%';--> statement-breakpoint
UPDATE `site_settings`
SET `tagline` = REPLACE(`tagline`, 'Creator Network', 'Influencer Ethiopia'),
	`hero_title` = REPLACE(`hero_title`, 'Creator Network', 'Influencer Ethiopia'),
	`hero_subtitle` = REPLACE(`hero_subtitle`, 'Creator Network', 'Influencer Ethiopia')
WHERE CONCAT_WS(' ', `tagline`, `hero_title`, `hero_subtitle`) LIKE '%Creator Network%';
