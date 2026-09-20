/**
 * How far a creator has got with proving a channel is theirs.
 *
 * Pure and client-safe: the channels page decides what to draw from these, and
 * the server decides what to write from the same list, so a status can never
 * mean one thing in the browser and another in the database.
 *
 * - `none` — nobody has started. No code has been issued for this channel.
 * - `pending` — a code has been issued and is waiting in the creator's hands.
 *   Pressing Verify and not finding it leaves the channel here, because not
 *   finding it usually means the bio has not been saved yet.
 * - `verified` — the code was found on the profile. The handle is theirs.
 * - `unverified` — the platform would not answer at all, so the follower count
 *   beside it was typed in by hand. This is a statement about our reach, not
 *   about the creator, and it is where every Instagram and TikTok channel lands
 *   today.
 *
 * Kept in step with `ownershipStatusEnum` in `$lib/server/db/schema.ts`.
 */
export const OWNERSHIP_STATUSES = ['none', 'pending', 'verified', 'unverified'] as const;
export type OwnershipStatus = (typeof OWNERSHIP_STATUSES)[number];

/**
 * Has the handle been proved to belong to this creator?
 *
 * The badge the reader sees is not drawn from this: a figure's standing is
 * `StatSourceNote`'s job, from `followersSource`, so that the same number reads
 * the same way on the channels page and the public profile. This answers the
 * narrower question of whether the *handle* has been proved, which is what the
 * panel switches on.
 */
export const isOwnershipProved = (status: string | null | undefined): boolean =>
	status === 'verified';
