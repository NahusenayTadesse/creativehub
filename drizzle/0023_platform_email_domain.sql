/* The site's support address moves from creatornetwork.et to
   influencerethiopia.com with the rename to Influencer Ethiopia.

   Login addresses are deliberately left as they are: existing operators keep
   signing in exactly as before, and a new @influencerethiopia.com admin is
   added alongside with `scripts/create-admin.ts` rather than by renaming one. */
UPDATE `site_settings`
SET `support_email` = CONCAT(SUBSTRING_INDEX(`support_email`, '@', 1), '@influencerethiopia.com')
WHERE `support_email` LIKE '%@creatornetwork.et';
