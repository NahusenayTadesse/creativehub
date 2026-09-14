import { db } from '$lib/server/db';
import { recalcCreatorCompletedBookings, recalcCreatorRatings } from '$lib/server/db/rollups';
import {
	measureCreatorMetrics,
	recalcCreatorReach,
	recalcCreatorScore
} from '$lib/server/db/creator-score';

/**
 * Recomputes the derived fields on a creator row from the evidence the platform
 * holds. Called after any write that could change them — never exposed as a
 * field a creator can set.
 *
 * The arithmetic lives in `$lib/server/db/creator-score`, which takes `db` as an
 * argument so the scheduled refresh and the CLI script share it; these are the
 * app's names for it.
 */
export async function refreshCreatorScore(creatorId: number) {
	await recalcCreatorScore(db, creatorId);
}

/** Total reach is the sum of linked channels — the discovery filters sort on it. */
export async function refreshCreatorReach(creatorId: number) {
	await recalcCreatorReach(db, creatorId);
	await refreshCreatorScore(creatorId);
}

/** Recomputes a creator's rating and review count from published reviews. */
export async function refreshCreatorRating(creatorId: number) {
	await recalcCreatorRatings(db, creatorId);
	await refreshCreatorScore(creatorId);
}

/**
 * Recounts a creator's delivered bookings. Recount, never increment.
 *
 * Re-measures delivery and responsiveness too: a booking reaching `completed`
 * is exactly when a deadline stops being open, so waiting for the nightly pass
 * would leave the figure a day behind the event that settled it.
 */
export async function refreshCreatorCompletedBookings(creatorId: number) {
	await recalcCreatorCompletedBookings(db, creatorId);
	await measureCreatorMetrics(db, creatorId);
	await refreshCreatorScore(creatorId);
}
