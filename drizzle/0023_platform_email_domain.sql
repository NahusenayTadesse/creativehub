/* The platform's own addresses move from creatornetwork.et to
   influencerethiopia.com with the rename to Influencer Ethiopia.

   Only the old platform domain is touched: creators' and organisations' own
   addresses are theirs. A login email can change safely — password sign-ins
   are keyed by the user's id, not the address — so the same password keeps
   working and no session is ended. */
UPDATE `user`
SET `email` = CONCAT(SUBSTRING_INDEX(`email`, '@', 1), '@influencerethiopia.com')
WHERE `email` LIKE '%@creatornetwork.et';
--> statement-breakpoint
UPDATE `site_settings`
SET `support_email` = CONCAT(SUBSTRING_INDEX(`support_email`, '@', 1), '@influencerethiopia.com')
WHERE `support_email` LIKE '%@creatornetwork.et';
