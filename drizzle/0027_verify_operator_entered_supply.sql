-- Everything on the platform up to this point was entered by an operator.
--
-- Channel ownership used to be a checkbox on the creator's own form, reading
-- "An operator has confirmed I own this channel" and ticked by the creator. It
-- is now a decision somebody actually makes, on
-- /dashboard/admin/channel-ownership, and a creator with no confirmed channel
-- is hidden from the directory and refused by the trending board.
--
-- Applied to the existing table that rule would hide almost the whole
-- marketplace, and it would be wrong to: every creator on it was entered by an
-- admin or an encoder — 132 imported from the research CSV with no user account
-- behind them, the rest created from the admin listing and claimed afterwards.
-- Operator data entry is exactly what the new queue asks somebody to do, so
-- these rows have already had it done to them.
--
-- So the backfill says so, once, for the rows that exist now. Everything
-- created after this migration goes through the queue.

-- 1. Channels. `is_verified` is the operator's mark; these carry an operator's
--    data entry, which is the same thing. Soft-deleted rows are left alone:
--    nothing reads them, and resurrecting one should not resurrect a
--    confirmation nobody made.
UPDATE `social_accounts`
SET `is_verified` = 1
WHERE `is_verified` = 0
  AND `deleted_at` IS NULL;
--> statement-breakpoint

-- 2. Creators. Only the bottom rung is touched: `identity_verified` and
--    `cn_verified` were decided from documents by the verification queue and
--    must not be disturbed, and the derivation in
--    `$lib/server/db/creator-verification.ts` honours the same boundary.
--
--    Scoped to creators that actually have a live confirmed channel, so that
--    the level and the channels behind it agree from the first moment — a
--    creator raised to `social_verified` with nothing to derive it from would
--    drop back the next time anything recomputed them.
UPDATE `creators`
SET `verification_level` = 'social_verified'
WHERE `verification_level` = 'unverified'
  AND `deleted_at` IS NULL
  AND EXISTS (
    SELECT 1 FROM `social_accounts` sa
    WHERE sa.`creator_id` = `creators`.`id`
      AND sa.`deleted_at` IS NULL
      AND sa.`is_verified` = 1
  );
