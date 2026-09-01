CREATE TABLE `blog_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(140) NOT NULL,
	`description` varchar(300),
	`accent` varchar(40) NOT NULL DEFAULT 'mint',
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `blog_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `blog_categories_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `blog_post_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`post_id` int NOT NULL,
	`image` varchar(500) NOT NULL,
	`caption` varchar(300),
	`alt` varchar(250),
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `blog_post_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blog_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(250) NOT NULL,
	`slug` varchar(280) NOT NULL,
	`excerpt` varchar(500) NOT NULL DEFAULT '',
	`body` mediumtext,
	`search_text` mediumtext,
	`reading_minutes` int NOT NULL DEFAULT 0,
	`featured_image` varchar(500) NOT NULL DEFAULT '',
	`featured_image_alt` varchar(250),
	`category_id` int,
	`tags` json NOT NULL DEFAULT ('[]'),
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`published_at` timestamp(3),
	`is_featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`meta_title` varchar(250),
	`meta_description` varchar(320),
	`og_image` varchar(500),
	`no_index` boolean NOT NULL DEFAULT false,
	`author_id` varchar(36),
	`author_name` varchar(180),
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `blog_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `blog_posts_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `blog_post_images` ADD CONSTRAINT `blog_post_images_post_id_blog_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `blog_posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD CONSTRAINT `blog_posts_category_id_blog_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `blog_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD CONSTRAINT `blog_posts_author_id_user_id_fk` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `blog_post_images_post_idx` ON `blog_post_images` (`post_id`);--> statement-breakpoint
CREATE INDEX `blog_posts_status_idx` ON `blog_posts` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `blog_posts_category_idx` ON `blog_posts` (`category_id`);