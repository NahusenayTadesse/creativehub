/**
 * A creator's verification level, derived from the channels an operator has
 * confirmed.
 *
 * Until now `social_accounts.is_verified` was a checkbox on the creator's own
 * form — "An operator has confirmed I own this channel", ticked by the creator,
 * about the operator. It is now what its name always said: a mark an operator
 * or an encoder puts on a channel after looking at it, or one the bio-code
 * proof earns outright. This is what that mark is worth on the creator's row.
 *
 * ## The one rung this owns
 *
 * `verification_level` has four values and this function is responsible for
 * exactly one boundary of them:
 *
 *   unverified  ←→  social_verified     this function
 *   social_verified → identity_verified this function, once Fayda has checked them
 *   identity_verified, cn_verified      the verification queue, from documents
 *
 * A creator sitting at `identity_verified` or `cn_verified` has had a person
 * look at their papers, and nothing about a channel being confirmed or
 * un-confirmed should disturb that. So those two are left exactly where they
 * are — this only ever moves a creator between the bottom two rungs.
 *
 * ## Why it is derived rather than stored twice
 *
 * Discovery hides unverified creators and trending refuses them outright, so
 * the level is now load-bearing on the public site. Deriving it from the
 * channels means there is no second place to forget to update: confirm a
 * channel and the creator appears, un-confirm the last one and they go again.
 */
import { and, eq, isNull } from 'drizzle-orm';
import * as t from './schema';
import type { Database } from './rollups';

/**
 * Re-reads one creator's channels and settles the bottom rung.
 *
 * Called after anything that can change whether a confirmed channel exists: an
 * operator's decision on the ownership queue, a bio-code proof succeeding, and
 * a channel being added, edited or deleted.
 */
export async function recalcCreatorVerification(db: Database, creatorId: number) {
	const current = (
		await db
			.select({ level: t.creators.verificationLevel })
			.from(t.creators)
			.where(eq(t.creators.id, creatorId))
			.limit(1)
	).at(0);

	/* A creator with papers on file, or none at all. Neither is this to decide. */
	if (!current) return;
	if (current.level !== 'unverified' && current.level !== 'social_verified') return;

	const confirmed = await db
		.select({ id: t.socialAccounts.id })
		.from(t.socialAccounts)
		.where(
			and(
				eq(t.socialAccounts.creatorId, creatorId),
				eq(t.socialAccounts.isVerified, true),
				isNull(t.socialAccounts.deletedAt)
			)
		)
		.limit(1);

	/*
	 * A Fayda check lifts a creator with a confirmed channel to the identity
	 * rung: their reach is real and so are they. Without a confirmed channel
	 * the check is kept and waits — identity alone says nothing about reach,
	 * and the public listing is about reach.
	 */
	const identity = confirmed.length
		? await db
				.select({ id: t.identityChecks.id })
				.from(t.identityChecks)
				.where(
					and(
						eq(t.identityChecks.creatorId, creatorId),
						eq(t.identityChecks.status, 'verified'),
						isNull(t.identityChecks.deletedAt)
					)
				)
				.limit(1)
		: [];

	const next = confirmed.length
		? identity.length
			? 'identity_verified'
			: 'social_verified'
		: 'unverified';
	if (next === current.level) return;

	await db.update(t.creators).set({ verificationLevel: next }).where(eq(t.creators.id, creatorId));
}
