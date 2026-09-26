/**
 * When a live post's performance is recorded.
 *
 * Three checkpoints, counted from when the post went live: 24 hours, 7 days
 * and 30 days. Each opens at its moment and stays open — a figure recorded on
 * day nine is still the week's figure, and far better than none — but none
 * can be recorded early, because a "7 day" number taken on day two is not one.
 */

export const CHECKPOINTS = ['24h', '7d', '30d'] as const;
export type Checkpoint = (typeof CHECKPOINTS)[number];

const HOURS: Record<Checkpoint, number> = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };

export const checkpointOpensAt = (postedAt: Date, checkpoint: Checkpoint) =>
	new Date(postedAt.getTime() + HOURS[checkpoint] * 3_600_000);

/** Whether this checkpoint may be recorded yet. */
export const checkpointIsOpen = (postedAt: Date, checkpoint: Checkpoint, now = new Date()) =>
	now.getTime() >= checkpointOpensAt(postedAt, checkpoint).getTime();

/** The checkpoints that are open and have no figures yet, earliest first. */
export function dueCheckpoints(
	postedAt: Date,
	recorded: Iterable<string>,
	now = new Date()
): Checkpoint[] {
	const done = new Set(recorded);
	return CHECKPOINTS.filter((cp) => !done.has(cp) && checkpointIsOpen(postedAt, cp, now));
}

/** A posted-at time the creator states: not in the future, not before the deal. */
export function postedAtProblem(
	postedAt: Date,
	dealCreatedAt: Date,
	now = new Date()
): 'future' | 'before_deal' | null {
	/* A few minutes' grace for a phone clock that runs fast. */
	if (postedAt.getTime() > now.getTime() + 10 * 60_000) return 'future';
	/* A day's grace: the database and the app may keep different clocks, and
	   the check is for a post plainly older than the deal, not for minutes. */
	if (postedAt.getTime() < dealCreatedAt.getTime() - 24 * 3_600_000) return 'before_deal';
	return null;
}
