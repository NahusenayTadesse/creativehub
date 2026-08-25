/**
 * Claiming an imported profile.
 *
 * Supply is imported before anyone signs up, so a profile can carry a real
 * person's name, handle and audience while `userId` is still null. This is how
 * that person takes it over: they ask, an operator checks, and approval is the
 * single write that attaches the account.
 *
 * It is deliberately not self-serve. An imported profile holds follower counts,
 * a score and any deals opened against it, so claiming one is an identity
 * claim — the same class of assertion as verification, and it goes through the
 * same shape of queue.
 */

export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

/**
 * Which states may follow which. Every closed state is terminal: a decision is
 * a record of what an operator checked at a moment, and re-opening it in place
 * would leave the audit log describing something that no longer happened. A
 * claimant who was turned down asks again, which is a new row.
 */
const CLAIM_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
	pending: ['approved', 'rejected', 'withdrawn'],
	approved: [],
	rejected: [],
	withdrawn: []
};

/**
 * Whether `to` may follow `from`.
 *
 * `Object.hasOwn` for the same reason as the booking lifecycle: a plain object
 * literal answers to `constructor` and `toString`, and neither is a state this
 * table ever declared.
 */
export const canDecideClaim = (from: ClaimStatus, to: ClaimStatus) =>
	Object.hasOwn(CLAIM_TRANSITIONS, from) && CLAIM_TRANSITIONS[from].includes(to);

/** A claim still waiting on somebody. */
export const claimIsOpen = (status: ClaimStatus) => status === 'pending';

/**
 * Comparable form of a name or handle: case, spacing, dots and underscores all
 * vary between an import and the account someone later signs up with.
 */
const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The local part of an email address, in comparable form. */
export const handleFromEmail = (email: string) => normalise(email.split('@')[0] ?? '');

/**
 * Whether an account plausibly belongs to the person an imported profile
 * describes.
 *
 * Exact after normalising, never fuzzy. This decides what to *offer* someone on
 * the create-profile page — "is one of these you?" — and a near-miss there
 * shows one stranger another stranger's audience figures and asking price. A
 * creator whose name we do not guess can still claim from their own profile
 * page, so the cost of missing a match is a longer route, while the cost of a
 * loose one is a privacy leak. Nothing here grants anything: approval is an
 * operator's, and this only ever narrows what they are asked about.
 */
export function looksLikeSamePerson(
	account: { name: string; email: string },
	creator: { fullName: string; username: string }
): boolean {
	const handle = handleFromEmail(account.email);
	const username = normalise(creator.username);

	if (normalise(account.name) && normalise(account.name) === normalise(creator.fullName)) {
		return true;
	}
	/* An empty local part would otherwise match an empty username. */
	return Boolean(handle) && handle === username;
}
