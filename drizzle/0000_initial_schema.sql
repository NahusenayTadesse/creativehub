CREATE TABLE `applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaign_id` int NOT NULL,
	`creator_id` int NOT NULL,
	`pitch` text NOT NULL,
	`proposed_price` int NOT NULL DEFAULT 0,
	`currency_code` varchar(8) NOT NULL DEFAULT 'ETB',
	`status` enum('applied','shortlisted','selected','rejected','withdrawn') NOT NULL DEFAULT 'applied',
	`decision_note` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `applications_id` PRIMARY KEY(`id`),
	CONSTRAINT `application_unique` UNIQUE(`campaign_id`,`creator_id`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actor_id` varchar(36),
	`actor_label` varchar(180),
	`entity` varchar(80) NOT NULL,
	`entity_id` int,
	`action` varchar(80) NOT NULL,
	`from_state` varchar(80),
	`to_state` varchar(80),
	`reason` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(32) NOT NULL,
	`campaign_id` int,
	`application_id` int,
	`creator_id` int NOT NULL,
	`organization_id` int NOT NULL,
	`package_id` int,
	`title` varchar(250) NOT NULL,
	`deliverables` json NOT NULL DEFAULT ('[]'),
	`compensation_type` enum('paid','barter','event_pass') NOT NULL DEFAULT 'paid',
	`price` int NOT NULL DEFAULT 0,
	`currency_code` varchar(8) NOT NULL DEFAULT 'ETB',
	`platform_fee` int NOT NULL DEFAULT 0,
	`creator_payout` int NOT NULL DEFAULT 0,
	`status` enum('proposed','negotiating','booked','in_production','submitted','revision','approved','awaiting_settlement','completed','cancelled','disputed') NOT NULL DEFAULT 'proposed',
	`escrow_status` enum('unfunded','pending','held','released','refunded') NOT NULL DEFAULT 'unfunded',
	`payment_method` enum('telebirr','chapa','cbe_birr','bank_transfer'),
	`payment_ref` varchar(120),
	`deadline` date,
	`revisions_used` int NOT NULL DEFAULT 0,
	`revisions_allowed` int NOT NULL DEFAULT 2,
	`terms_snapshot` json,
	`terms_frozen_at` timestamp(3),
	`completed_at` timestamp(3),
	`cancel_reason` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`),
	CONSTRAINT `bookings_reference_idx` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`title` varchar(250) NOT NULL,
	`slug` varchar(280) NOT NULL,
	`description` text,
	`objective` text,
	`compensation_type` enum('paid','barter','event_pass') NOT NULL DEFAULT 'paid',
	`category_id` int,
	`platform_ids` json NOT NULL DEFAULT ('[]'),
	`creators_needed` int NOT NULL DEFAULT 1,
	`follower_min` int NOT NULL DEFAULT 0,
	`follower_max` int NOT NULL DEFAULT 0,
	`budget_min` int NOT NULL DEFAULT 0,
	`budget_max` int NOT NULL DEFAULT 0,
	`currency_code` varchar(8) NOT NULL DEFAULT 'ETB',
	`country_id` int,
	`target_regions` json NOT NULL DEFAULT ('[]'),
	`barter_details` text,
	`event_name` varchar(250),
	`event_date` date,
	`event_location` varchar(250),
	`pass_type` varchar(250),
	`deliverables` json NOT NULL DEFAULT ('[]'),
	`deadline` date,
	`language` varchar(80) NOT NULL DEFAULT 'Amharic & English',
	`tags` json NOT NULL DEFAULT ('[]'),
	`status` enum('draft','published','closed','cancelled','completed') NOT NULL DEFAULT 'draft',
	`applications_count` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`),
	CONSTRAINT `campaigns_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(140) NOT NULL,
	`description` text,
	`icon` varchar(60) NOT NULL DEFAULT 'Sparkles',
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `countries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`code` varchar(8) NOT NULL,
	`flag` varchar(16) NOT NULL DEFAULT '🌍',
	`currency_code` varchar(8) NOT NULL DEFAULT 'USD',
	`currency_symbol` varchar(12) NOT NULL DEFAULT '$',
	`usd_rate` double NOT NULL DEFAULT 1,
	`payment_rails` json NOT NULL DEFAULT ('[]'),
	`description` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `countries_id` PRIMARY KEY(`id`),
	CONSTRAINT `countries_code_idx` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `creator_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creator_id` int NOT NULL,
	`category_id` int NOT NULL,
	CONSTRAINT `creator_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `creator_category_unique` UNIQUE(`creator_id`,`category_id`)
);
--> statement-breakpoint
CREATE TABLE `creator_languages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creator_id` int NOT NULL,
	`language_id` int NOT NULL,
	CONSTRAINT `creator_languages_id` PRIMARY KEY(`id`),
	CONSTRAINT `creator_language_unique` UNIQUE(`creator_id`,`language_id`)
);
--> statement-breakpoint
CREATE TABLE `creators` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(36),
	`username` varchar(120) NOT NULL,
	`full_name` varchar(180) NOT NULL,
	`avatar` varchar(500),
	`cover` varchar(500),
	`bio` text,
	`country_id` int,
	`region_id` int,
	`city` varchar(120),
	`primary_platform_id` int,
	`total_reach` int NOT NULL DEFAULT 0,
	`starting_price` int NOT NULL DEFAULT 0,
	`currency_code` varchar(8) NOT NULL DEFAULT 'ETB',
	`score` int NOT NULL DEFAULT 10,
	`verification_level` enum('unverified','social_verified','identity_verified','cn_verified') NOT NULL DEFAULT 'unverified',
	`availability` enum('available','busy','away') NOT NULL DEFAULT 'available',
	`is_featured` boolean NOT NULL DEFAULT false,
	`is_trending` boolean NOT NULL DEFAULT false,
	`overseas_percentage` int NOT NULL DEFAULT 0,
	`top_countries` json NOT NULL DEFAULT ('[]'),
	`reviews_count` int NOT NULL DEFAULT 0,
	`average_rating` double NOT NULL DEFAULT 0,
	`completed_bookings` int NOT NULL DEFAULT 0,
	`is_published` boolean NOT NULL DEFAULT false,
	`is_claimed` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `creators_id` PRIMARY KEY(`id`),
	CONSTRAINT `creators_username_idx` UNIQUE(`username`),
	CONSTRAINT `creators_user_idx` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `gallery_slides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(180) NOT NULL,
	`subtitle` text,
	`image` varchar(500) NOT NULL DEFAULT '',
	`link_url` varchar(500),
	`link_label` varchar(80),
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `gallery_slides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `languages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`code` varchar(8) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `languages_id` PRIMARY KEY(`id`),
	CONSTRAINT `languages_code_idx` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`booking_id` int,
	`application_id` int,
	`sender_id` varchar(36) NOT NULL,
	`body` text NOT NULL,
	`is_masked` boolean NOT NULL DEFAULT false,
	`read_at` timestamp(3),
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`title` varchar(250) NOT NULL,
	`body` text,
	`link` varchar(300),
	`kind` varchar(60) NOT NULL DEFAULT 'info',
	`read_at` timestamp(3),
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organization_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`role` enum('owner','admin','member') NOT NULL DEFAULT 'member',
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `organization_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_member_unique` UNIQUE(`organization_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_id` varchar(36) NOT NULL,
	`name` varchar(180) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`org_type` enum('company','startup','agency','ngo','government','event_organizer') NOT NULL DEFAULT 'company',
	`logo` varchar(500),
	`website` varchar(300),
	`bio` text,
	`country_id` int,
	`city` varchar(120),
	`verification_level` enum('unverified','social_verified','identity_verified','cn_verified') NOT NULL DEFAULT 'unverified',
	`monthly_budget_cap` int,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creator_id` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`platform_id` int,
	`description` text,
	`deliverables` json NOT NULL DEFAULT ('[]'),
	`price` int NOT NULL DEFAULT 0,
	`currency_code` varchar(8) NOT NULL DEFAULT 'ETB',
	`delivery_days` int NOT NULL DEFAULT 3,
	`revisions` int NOT NULL DEFAULT 2,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platforms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(60) NOT NULL,
	`color` varchar(16) NOT NULL DEFAULT '#0f172a',
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `platforms_id` PRIMARY KEY(`id`),
	CONSTRAINT `platforms_name_idx` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `portfolio_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creator_id` int NOT NULL,
	`media_type` enum('image','video') NOT NULL DEFAULT 'image',
	`url` varchar(500) NOT NULL,
	`caption` varchar(300),
	`platform_id` int,
	`views` int NOT NULL DEFAULT 0,
	`likes` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `portfolio_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `regions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`country_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`major_cities` json NOT NULL DEFAULT ('[]'),
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `regions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`booking_id` int NOT NULL,
	`creator_id` int NOT NULL,
	`organization_id` int NOT NULL,
	`author_id` varchar(36),
	`direction` enum('brand_to_creator','creator_to_brand') NOT NULL DEFAULT 'brand_to_creator',
	`rating` int NOT NULL,
	`communication` int NOT NULL DEFAULT 5,
	`professionalism` int NOT NULL DEFAULT 5,
	`timeliness` int NOT NULL DEFAULT 5,
	`quality` int NOT NULL DEFAULT 5,
	`body` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_unique` UNIQUE(`booking_id`,`direction`)
);
--> statement-breakpoint
CREATE TABLE `saved_creators` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`creator_id` int NOT NULL,
	`note` varchar(300),
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `saved_creators_id` PRIMARY KEY(`id`),
	CONSTRAINT `saved_creator_unique` UNIQUE(`organization_id`,`creator_id`)
);
--> statement-breakpoint
CREATE TABLE `site_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`site_name` varchar(180) NOT NULL DEFAULT 'Creator Network',
	`tagline` varchar(250) NOT NULL DEFAULT 'Connecting Ethiopia''s digital influence.',
	`hero_title` varchar(250) NOT NULL DEFAULT 'Find the right creator. Build the right campaign.',
	`hero_subtitle` text,
	`platform_fee_percent` int NOT NULL DEFAULT 15,
	`support_email` varchar(200),
	`support_phone` varchar(60),
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `site_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creator_id` int NOT NULL,
	`platform_id` int NOT NULL,
	`handle` varchar(160) NOT NULL,
	`followers` int NOT NULL DEFAULT 0,
	`engagement_rate` double NOT NULL DEFAULT 0,
	`profile_url` varchar(500),
	`is_verified` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `social_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`booking_id` int NOT NULL,
	`content_url` varchar(500) NOT NULL,
	`notes` text,
	`status` enum('submitted','approved','revision_requested') NOT NULL DEFAULT 'submitted',
	`review_note` text,
	`reviewed_by` varchar(36),
	`reviewed_at` timestamp(3),
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `term_proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`booking_id` int NOT NULL,
	`proposed_by` enum('organization','creator') NOT NULL,
	`price` int NOT NULL DEFAULT 0,
	`currency_code` varchar(8) NOT NULL DEFAULT 'ETB',
	`deliverables` json NOT NULL DEFAULT ('[]'),
	`deadline` date,
	`revisions_allowed` int NOT NULL DEFAULT 2,
	`note` text,
	`status` enum('pending','accepted','countered','declined') NOT NULL DEFAULT 'pending',
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `term_proposals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trending_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mode` enum('manual','automatic','hybrid') NOT NULL DEFAULT 'hybrid',
	`slots` int NOT NULL DEFAULT 12,
	`window_days` int NOT NULL DEFAULT 30,
	`half_life_days` int NOT NULL DEFAULT 7,
	`normalization` enum('percentile','minmax') NOT NULL DEFAULT 'percentile',
	`weight_score` int NOT NULL DEFAULT 20,
	`weight_reach` int NOT NULL DEFAULT 10,
	`weight_engagement` int NOT NULL DEFAULT 15,
	`weight_bookings` int NOT NULL DEFAULT 15,
	`weight_applications` int NOT NULL DEFAULT 5,
	`weight_reviews` int NOT NULL DEFAULT 5,
	`weight_rating` int NOT NULL DEFAULT 10,
	`weight_saves` int NOT NULL DEFAULT 5,
	`weight_newcomer` int NOT NULL DEFAULT 5,
	`weight_verification` int NOT NULL DEFAULT 10,
	`min_score` int NOT NULL DEFAULT 0,
	`min_followers` int NOT NULL DEFAULT 0,
	`min_rating` double NOT NULL DEFAULT 0,
	`min_verification` enum('unverified','social_verified','identity_verified','cn_verified') NOT NULL DEFAULT 'unverified',
	`require_available` boolean NOT NULL DEFAULT false,
	`require_channel` boolean NOT NULL DEFAULT true,
	`require_activity` boolean NOT NULL DEFAULT false,
	`max_per_category` int NOT NULL DEFAULT 0,
	`max_per_country` int NOT NULL DEFAULT 0,
	`max_tenure_days` int NOT NULL DEFAULT 0,
	`cooldown_days` int NOT NULL DEFAULT 0,
	`pinned_first` boolean NOT NULL DEFAULT true,
	`auto_refresh` boolean NOT NULL DEFAULT false,
	`refresh_interval_minutes` int NOT NULL DEFAULT 360,
	`is_frozen` boolean NOT NULL DEFAULT false,
	`last_run_at` timestamp(3),
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `trending_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trending_cooldowns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creator_id` int NOT NULL,
	`resting_until` timestamp(3) NOT NULL,
	`reason` varchar(200),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `trending_cooldowns_id` PRIMARY KEY(`id`),
	CONSTRAINT `trending_cooldown_creator_idx` UNIQUE(`creator_id`)
);
--> statement-breakpoint
CREATE TABLE `trending_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creator_id` int NOT NULL,
	`rank` int NOT NULL,
	`trending_score` double NOT NULL DEFAULT 0,
	`source` enum('pinned','algorithm','manual') NOT NULL DEFAULT 'algorithm',
	`breakdown` json,
	`run_id` int,
	`first_ranked_at` timestamp(3) NOT NULL DEFAULT (now()),
	`computed_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `trending_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `trending_entry_creator_idx` UNIQUE(`creator_id`)
);
--> statement-breakpoint
CREATE TABLE `trending_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creator_id` int NOT NULL,
	`kind` enum('pin','boost','block') NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`multiplier` double NOT NULL DEFAULT 1,
	`note` varchar(300),
	`expires_at` timestamp(3),
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `trending_overrides_id` PRIMARY KEY(`id`),
	CONSTRAINT `trending_override_creator_idx` UNIQUE(`creator_id`)
);
--> statement-breakpoint
CREATE TABLE `trending_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mode` enum('manual','automatic','hybrid') NOT NULL,
	`trigger` enum('manual','auto','settings') NOT NULL DEFAULT 'manual',
	`actor_id` varchar(36),
	`actor_label` varchar(180),
	`candidate_count` int NOT NULL DEFAULT 0,
	`entry_count` int NOT NULL DEFAULT 0,
	`changed_count` int NOT NULL DEFAULT 0,
	`duration_ms` int NOT NULL DEFAULT 0,
	`note` text,
	`config_snapshot` json,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `trending_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `verification_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subject_type` enum('creator','organization') NOT NULL DEFAULT 'creator',
	`creator_id` int,
	`organization_id` int,
	`requested_level` enum('unverified','social_verified','identity_verified','cn_verified') NOT NULL DEFAULT 'identity_verified',
	`document_url` varchar(500),
	`social_proofs` json NOT NULL DEFAULT ('[]'),
	`status` enum('pending','under_review','more_info','approved','rejected') NOT NULL DEFAULT 'pending',
	`admin_notes` text,
	`reviewed_by` varchar(36),
	`reviewed_at` timestamp(3),
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	CONSTRAINT `verification_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` varchar(36) NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` timestamp(3),
	`refresh_token_expires_at` timestamp(3),
	`scope` text,
	`password` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `account_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` varchar(36) NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`token` varchar(255) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` varchar(36) NOT NULL,
	CONSTRAINT `session_id` PRIMARY KEY(`id`),
	CONSTRAINT `session_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`image` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`role` text DEFAULT ('creator'),
	`phone` text,
	CONSTRAINT `user_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` varchar(36) NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `verification_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `applications` ADD CONSTRAINT `applications_campaign_id_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `applications` ADD CONSTRAINT `applications_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_campaign_id_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_package_id_packages_id_fk` FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_country_id_countries_id_fk` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creator_categories` ADD CONSTRAINT `creator_categories_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creator_categories` ADD CONSTRAINT `creator_categories_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creator_languages` ADD CONSTRAINT `creator_languages_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creator_languages` ADD CONSTRAINT `creator_languages_language_id_languages_id_fk` FOREIGN KEY (`language_id`) REFERENCES `languages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creators` ADD CONSTRAINT `creators_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creators` ADD CONSTRAINT `creators_country_id_countries_id_fk` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creators` ADD CONSTRAINT `creators_region_id_regions_id_fk` FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creators` ADD CONSTRAINT `creators_primary_platform_id_platforms_id_fk` FOREIGN KEY (`primary_platform_id`) REFERENCES `platforms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_sender_id_user_id_fk` FOREIGN KEY (`sender_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organization_members` ADD CONSTRAINT `organization_members_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organization_members` ADD CONSTRAINT `organization_members_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organizations` ADD CONSTRAINT `organizations_owner_id_user_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organizations` ADD CONSTRAINT `organizations_country_id_countries_id_fk` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `packages` ADD CONSTRAINT `packages_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `packages` ADD CONSTRAINT `packages_platform_id_platforms_id_fk` FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portfolio_items` ADD CONSTRAINT `portfolio_items_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portfolio_items` ADD CONSTRAINT `portfolio_items_platform_id_platforms_id_fk` FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `regions` ADD CONSTRAINT `regions_country_id_countries_id_fk` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_author_id_user_id_fk` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saved_creators` ADD CONSTRAINT `saved_creators_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saved_creators` ADD CONSTRAINT `saved_creators_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `social_accounts` ADD CONSTRAINT `social_accounts_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `social_accounts` ADD CONSTRAINT `social_accounts_platform_id_platforms_id_fk` FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_reviewed_by_user_id_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `term_proposals` ADD CONSTRAINT `term_proposals_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trending_cooldowns` ADD CONSTRAINT `trending_cooldowns_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trending_entries` ADD CONSTRAINT `trending_entries_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trending_overrides` ADD CONSTRAINT `trending_overrides_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `verification_requests` ADD CONSTRAINT `verification_requests_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `verification_requests` ADD CONSTRAINT `verification_requests_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `verification_requests` ADD CONSTRAINT `verification_requests_reviewed_by_user_id_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `account` ADD CONSTRAINT `account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_log` (`entity`,`entity_id`);--> statement-breakpoint
CREATE INDEX `bookings_creator_idx` ON `bookings` (`creator_id`);--> statement-breakpoint
CREATE INDEX `bookings_org_idx` ON `bookings` (`organization_id`);--> statement-breakpoint
CREATE INDEX `bookings_status_idx` ON `bookings` (`status`);--> statement-breakpoint
CREATE INDEX `campaigns_org_idx` ON `campaigns` (`organization_id`);--> statement-breakpoint
CREATE INDEX `campaigns_status_idx` ON `campaigns` (`status`);--> statement-breakpoint
CREATE INDEX `creators_country_idx` ON `creators` (`country_id`);--> statement-breakpoint
CREATE INDEX `creators_reach_idx` ON `creators` (`total_reach`);--> statement-breakpoint
CREATE INDEX `creators_price_idx` ON `creators` (`starting_price`);--> statement-breakpoint
CREATE INDEX `messages_booking_idx` ON `messages` (`booking_id`);--> statement-breakpoint
CREATE INDEX `messages_app_idx` ON `messages` (`application_id`);--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `organizations_owner_idx` ON `organizations` (`owner_id`);--> statement-breakpoint
CREATE INDEX `packages_creator_idx` ON `packages` (`creator_id`);--> statement-breakpoint
CREATE INDEX `portfolio_creator_idx` ON `portfolio_items` (`creator_id`);--> statement-breakpoint
CREATE INDEX `regions_country_idx` ON `regions` (`country_id`);--> statement-breakpoint
CREATE INDEX `social_creator_idx` ON `social_accounts` (`creator_id`);--> statement-breakpoint
CREATE INDEX `submissions_booking_idx` ON `submissions` (`booking_id`);--> statement-breakpoint
CREATE INDEX `proposals_booking_idx` ON `term_proposals` (`booking_id`);--> statement-breakpoint
CREATE INDEX `trending_rank_idx` ON `trending_entries` (`rank`);--> statement-breakpoint
CREATE INDEX `verification_status_idx` ON `verification_requests` (`status`);--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);