/**
 * TikTok's follower count and bio, from the JSON the profile page hydrates from.
 *
 * Named `tiktok-public` to keep it apart from `$lib/server/tiktok.ts`, which is
 * the same platform reached the opposite way — through a grant the creator
 * signs in to give. That one is authoritative and this one is a guess made from
 * a public page; where both exist, the grant wins.
 *
 * ## This is expected to fail
 *
 * A signed-out `GET https://www.tiktok.com/@handle` measured on 2026-09-20 from
 * this network answers 200 with 1,462 bytes: a Slardar WAF interstitial that
 * loads a challenge script. `__UNIVERSAL_DATA_FOR_REHYDRATION__` does not
 * appear in it, for a real creator or a fabricated one. The parsing below is
 * correct for the page TikTok serves a browser it trusts, and returns
 * `no_embedded_json` for the page it serves us.
 *
 * Kept for the same reasons as `instagram.ts`: it costs one request to find
 * out, and failing lands the creator in the manual-entry fallback rather than
 * in an error. `tiktok.ts` is the path that works today.
 *
 * What *does* answer anonymously is TikTok's oEmbed endpoint, which
 * `social-check.ts` already uses — but it gives a display name and an embed
 * blockquote, and neither a bio nor a follower count, so it cannot serve this.
 */
import { getText, logFailure } from './http';
import type { ProfileFetch, ProfileFetcher } from './types';

/** Only the two leaves that are read. Everything optional; nothing trusted. */
type UniversalData = {
	__DEFAULT_SCOPE__?: {
		'webapp.user-detail'?: {
			userInfo?: {
				stats?: { followerCount?: unknown };
				user?: { signature?: unknown };
			};
			/* Set when the handle names nobody. TikTok still serves 200. */
			statusCode?: unknown;
		};
	};
};

/**
 * The script tag's contents.
 *
 * Matched rather than parsed with a DOM, because the payload is a single JSON
 * string in a `type="application/json"` tag — there is no markup inside it to
 * get wrong, and the alternative is a 2 MB HTML parser on the server for one
 * substring. Non-greedy to the first closing tag so a `</script>` later in the
 * page cannot extend the match.
 */
const SCRIPT = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/;

export async function fetchTikTokProfile(
	username: string,
	fetchImpl: ProfileFetcher = fetch
): Promise<ProfileFetch> {
	/* Lower-cased: TikTok handles are lower-case by construction, but people
	   write them as they see them on a profile card. */
	const handle = username.trim().toLowerCase();
	if (!handle) return { ok: false, reason: 'no_handle' };

	const url = `https://www.tiktok.com/@${encodeURIComponent(handle)}`;
	const fetched = await getText(
		url,
		{ Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
		fetchImpl
	);

	if (!fetched.ok) {
		logFailure('tiktok', handle, fetched.reason);
		return { ok: false, reason: fetched.reason };
	}

	const raw = fetched.body.match(SCRIPT)?.[1];
	if (!raw) {
		/* The WAF interstitial, today and by default. */
		logFailure('tiktok', handle, 'no_embedded_json');
		return { ok: false, reason: 'no_embedded_json' };
	}

	let payload: UniversalData;
	try {
		payload = JSON.parse(raw) as UniversalData;
	} catch {
		logFailure('tiktok', handle, 'bad_embedded_json');
		return { ok: false, reason: 'bad_embedded_json' };
	}

	const detail = payload.__DEFAULT_SCOPE__?.['webapp.user-detail'];
	if (!detail) {
		/* The shape changed — the page rendered, but not this scope. */
		logFailure('tiktok', handle, 'no_user_detail');
		return { ok: false, reason: 'no_user_detail' };
	}

	/* 10221 is "user not found"; anything non-zero is TikTok declining. */
	if (detail.statusCode !== undefined && Number(detail.statusCode) !== 0) {
		logFailure('tiktok', handle, `status_${detail.statusCode}`);
		return { ok: false, reason: `status_${detail.statusCode}` };
	}

	const followers = Number(detail.userInfo?.stats?.followerCount);
	if (!Number.isFinite(followers) || followers < 0) {
		logFailure('tiktok', handle, 'no_follower_count');
		return { ok: false, reason: 'no_follower_count' };
	}

	const signature = detail.userInfo?.user?.signature;

	return {
		ok: true,
		followers: Math.floor(followers),
		bio: typeof signature === 'string' ? signature : ''
	};
}
