-- The operator-entered profiles that have a reach figure but no channel rows.
--
-- 0027 lifted the existing supply off `unverified` by asking whether it had a
-- confirmed channel. That is the right question for a profile with channels,
-- and it has no answer at all for a profile without any: production carries
-- fifty-one published creators entered by an operator who recorded
-- `total_reach` on the creator row and never broke it out per platform. They
-- came through 0027 untouched and so would have dropped out of the directory
-- the moment the gate went live — about a third of published supply, and forty
-- million followers between them, disappearing on a technicality.
--
-- Being published is itself the operator's decision. Imported supply arrives
-- `is_published = 0` and stays there until somebody releases it, so a published
-- profile has already had a person look at it and say yes — the same act the
-- ownership queue asks for, which is exactly the reasoning 0027 was written on.
-- This applies it to the rows 0027 could not reach.
--
-- Scoped to profiles with no live channel at all, so it cannot quietly approve
-- a handle somebody is actually claiming: a creator with channels still needs
-- one of them confirmed, and this leaves every one of those alone.
--
-- One-time, like 0027. A creator who signs up after this goes through the
-- queue, and if a channel is ever added to one of these profiles the derivation
-- in `$lib/server/db/creator-verification.ts` takes over from here.
UPDATE `creators`
SET `verification_level` = 'social_verified'
WHERE `verification_level` = 'unverified'
  AND `deleted_at` IS NULL
  AND `is_published` = 1
  AND NOT EXISTS (
    SELECT 1 FROM `social_accounts` sa
    WHERE sa.`creator_id` = `creators`.`id`
      AND sa.`deleted_at` IS NULL
  );
