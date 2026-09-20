/**
 * A Telegram channel's description and member count, from its public t.me page.
 *
 * The second platform where the bio-code proof closes today. `t.me/name` is
 * served to anyone, and for a channel it carries both halves: the description
 * in `og:description`, which only the channel's owner can edit, and the member
 * count in the page's own `tgme_page_extra` line.
 *
 * ## Channels only, and why that is not a gap
 *
 * A personal Telegram account has no public bio on this page. `t.me/someone`
 * for a person answers with a generated line — "You can contact @someone right
 * away." — and puts the handle where a channel puts its member count. There is
 * nothing there an owner can write a code into, so this refuses with
 * `not_a_channel` rather than checking a string Telegram wrote itself. A
 * creator's *channel* is what this marketplace prices anyway; their personal
 * account has no audience to sell.
 */
import { getText, logFailure } from './http';
import type { ProfileFetch, ProfileFetcher } from './types';

const OG_DESCRIPTION = /<meta property="og:description" content="([^"]*)"/i;
/** The line under the title: "10 694 677 subscribers" on a channel, "@name" on a person. */
const PAGE_EXTRA = /tgme_page_extra">([^<]*)</i;

/**
 * "10 694 677 subscribers" → 10694677.
 *
 * Telegram groups digits with spaces, and not always ASCII ones, so every kind
 * of space is removed before the digits are read. Null for anything that is not
 * a count, which is how a personal account is told from a channel.
 */
export function parseMemberCount(text: string): number | null {
	const cleaned = text.replace(/[\s,\u00a0\u202f]/g, '');
	const match = cleaned.match(/^([\d]+)(?:subscribers?|members?)$/i);
	if (!match) return null;

	const value = Number(match[1]);
	return Number.isFinite(value) ? value : null;
}

/**
 * `og:description` arrives HTML-escaped, and a bio is exactly the place people
 * put `&` and quotation marks. Only the five entities the escaper produces are
 * reversed; nothing here is rendered, so there is no wider unescaping to do.
 */
function unescapeHtml(value: string): string {
	return (
		value
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			/* Last, so an escaped "&amp;lt;" does not become a tag. */
			.replace(/&amp;/g, '&')
	);
}

export async function fetchTelegramProfile(
	username: string,
	fetchImpl: ProfileFetcher = fetch
): Promise<ProfileFetch> {
	const handle = username.trim().replace(/^@/, '');
	if (!handle) return { ok: false, reason: 'no_handle' };

	const url = `https://t.me/${encodeURIComponent(handle)}`;
	const fetched = await getText(
		url,
		{ Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
		fetchImpl
	);

	if (!fetched.ok) {
		logFailure('telegram', handle, fetched.reason);
		return { ok: false, reason: fetched.reason };
	}

	const extra = fetched.body.match(PAGE_EXTRA)?.[1];
	if (extra === undefined) {
		/* No such name: t.me still answers 200, with the generic landing page. */
		logFailure('telegram', handle, 'no_page_extra');
		return { ok: false, reason: 'no_page_extra' };
	}

	const followers = parseMemberCount(extra);
	if (followers === null) {
		logFailure('telegram', handle, 'not_a_channel');
		return { ok: false, reason: 'not_a_channel' };
	}

	const description = fetched.body.match(OG_DESCRIPTION)?.[1];
	if (description === undefined) {
		logFailure('telegram', handle, 'no_description');
		return { ok: false, reason: 'no_description' };
	}

	return { ok: true, followers, bio: unescapeHtml(description) };
}
