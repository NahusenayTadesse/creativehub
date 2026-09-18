/**
 * Who may move an article into which state.
 *
 * The blog has two kinds of writer and they are trusted differently. An
 * operator owns the section: they set any state on any post, exactly as they
 * always have. A creator or a brand owns only the writing — they draft, they
 * hand a finished piece over, and an operator decides. Nothing they write
 * reaches a reader without that decision.
 *
 * The rules live here, apart from the routes, because the same three questions
 * are asked in four places — the author's editor draws its buttons from them,
 * the author's actions refuse on them, the approval queue refuses on them, and
 * the tests below are the only place they are stated once and checked. A
 * predicate duplicated into a `.svelte` file is how a button appears for a
 * state the action then rejects.
 */

export type BlogStatus = 'draft' | 'pending' | 'published' | 'archived';

/**
 * Whether an author may still open the editor on their own post.
 *
 * Everything but `archived`, which is an operator's decision to take a piece
 * out of circulation; editing one would be arguing with that decision through
 * the back door. A `pending` post stays editable on purpose — an author who
 * spots a mistake the moment after submitting should fix it, not wait to be
 * turned down for it.
 */
export const authorMayEdit = (status: BlogStatus): boolean => status !== 'archived';

/**
 * What an author's save leaves the post in.
 *
 * The rule the whole feature rests on: no text a creator or a brand wrote is
 * public until an operator has read *that* text. So editing a live article
 * sends it back to the queue, and it leaves the site until the edit is
 * approved. That is a real cost — a typo fix takes the page down — and the
 * editor says so plainly before the save rather than surprising anyone with
 * it. The alternative is an approval that means "somebody once read an earlier
 * version of this", which is not an approval.
 *
 * A draft stays a draft; submitting is a separate, deliberate act.
 */
export const statusAfterAuthorSave = (status: BlogStatus): BlogStatus =>
	status === 'published' ? 'pending' : status;

/** Whether saving in this state takes the article off the site. */
export const authorSaveUnpublishes = (status: BlogStatus): boolean =>
	statusAfterAuthorSave(status) !== status;

/** Whether an author may hand this post over for a decision. */
export const authorMaySubmit = (status: BlogStatus): boolean => status === 'draft';

/**
 * Whether an author may pull a submission back.
 *
 * Only while nobody has answered it. Once a piece is published or archived the
 * state is an operator's record of a decision, and taking it back would be the
 * author overwriting it.
 */
export const authorMayWithdraw = (status: BlogStatus): boolean => status === 'pending';

/** Whether an operator has a decision to make on this post. */
export const awaitingReview = (status: BlogStatus): boolean => status === 'pending';

/**
 * Whether a post belongs to somebody other than the operator who is looking at
 * it — which is what makes it queue work rather than editorial work.
 */
export const isAuthoredExternally = (post: {
	creatorId?: number | null;
	organizationId?: number | null;
}): boolean => Boolean(post.creatorId || post.organizationId);

/**
 * The profile a post is published under.
 *
 * At most one of the two columns is ever set — see the note on the schema — so
 * this is the single place that decides which, and everything that renders a
 * byline or a "back to profile" link reads it rather than testing the columns
 * itself.
 */
export function authorProfile(post: {
	creatorId?: number | null;
	creatorUsername?: string | null;
	organizationId?: number | null;
	organizationSlug?: string | null;
}):
	| { kind: 'creator'; href: `/creators/${string}` }
	| { kind: 'organization'; href: `/brands/${string}` }
	| null {
	if (post.creatorId && post.creatorUsername) {
		return { kind: 'creator', href: `/creators/${post.creatorUsername}` };
	}
	if (post.organizationId && post.organizationSlug) {
		return { kind: 'organization', href: `/brands/${post.organizationSlug}` };
	}
	return null;
}
