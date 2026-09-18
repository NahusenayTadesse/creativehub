/* Creators and brands can write for the blog, and nothing they write goes live
   on its own.

   `pending` joins the status vocabulary between `draft` and `published`: it is
   what a finished piece sits in while an operator decides. Every public query
   already tests `status = 'published'`, so the new state is invisible to
   readers without a single one of them being touched.

   `creator_id` / `organization_id` are the profile a piece is published under —
   which is not `author_id`, the account that typed it. Both are nullable and at
   most one is ever set; an operator's own article leaves both empty. Existing
   rows are exactly that case, so no backfill is needed.

   The review columns are the decision itself: when it was handed over, when it
   was answered, by whom, and the note the author is shown when it comes back. */
ALTER TABLE `blog_posts` MODIFY COLUMN `status` enum('draft','pending','published','archived') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `creator_id` int;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `organization_id` int;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `submitted_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `reviewed_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `reviewed_by` varchar(36);--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `review_note` varchar(500);--> statement-breakpoint
ALTER TABLE `blog_posts` ADD CONSTRAINT `blog_posts_creator_id_creators_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD CONSTRAINT `blog_posts_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD CONSTRAINT `blog_posts_reviewed_by_user_id_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `blog_posts_creator_idx` ON `blog_posts` (`creator_id`,`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `blog_posts_organization_idx` ON `blog_posts` (`organization_id`,`status`,`published_at`);