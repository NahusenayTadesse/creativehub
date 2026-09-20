/**
 * Names for the elements that should morph rather than cross-fade.
 *
 * A view transition animates the whole page by default. Where the same thing
 * appears on both sides of a navigation — a creator's picture on their card in
 * the directory, and the same picture on their profile — giving both copies one
 * `view-transition-name` makes the browser tween that element between its two
 * positions instead, so the card appears to open into the page.
 *
 * Pure, and used on both sides of the wire: the card and the profile have to
 * agree on the name exactly, and the only way to guarantee that is for both to
 * call the same function.
 */

/**
 * A username, as a name the CSS parser will accept.
 *
 * `view-transition-name` takes a custom ident, which cannot begin with a digit
 * and cannot contain a dot — and usernames here are `[a-z0-9_.]`, so
 * "24.karat" is both. The prefix fixes the first problem and the replacement
 * the second; two distinct usernames cannot collide afterwards because only
 * `.` is rewritten, and it is rewritten to a character usernames cannot hold.
 */
export const creatorTransitionName = (username: string): string =>
	`creator-${username.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

/**
 * The style attribute for one such element, or nothing at all.
 *
 * Empty when there is no username, because a `view-transition-name` of
 * `creator-` on several elements at once is a duplicate name, and a duplicate
 * name makes the browser abandon the whole transition rather than that one
 * element's part of it.
 */
export const creatorTransitionStyle = (username: string | null | undefined): string =>
	username ? `view-transition-name: ${creatorTransitionName(username)}` : '';
