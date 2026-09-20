/**
 * Instagram's follower count and bio, from the endpoint its own web client uses.
 *
 * ## This is expected to fail
 *
 * `web_profile_info` is the call instagram.com makes to draw a profile header,
 * and `x-ig-app-id: 936619743392459` is the web app's public id, sent by every
 * visitor's browser. Signed out it used to answer; measured again on 2026-09-20
 * from this network it answers:
 *
 *     401 {"message":"Please wait a few minutes before you try again.",
 *          "require_login":true,"igweb_rollout":true,"status":"fail"}
 *
 * — the same body from `i.instagram.com` and `www.instagram.com` alike, on the
 * first request of the day, so the "wait a few minutes" is a fiction and
 * `require_login` is the real answer. The profile page is no better: 628 KB of
 * Javascript shell with no `og:description` to read a bio out of.
 *
 * The module is written as specified anyway, and kept, for two reasons. It
 * costs one request to find out — Instagram's posture has flipped more than
 * once and may flip again, and if it does this starts working with no further
 * change. And every path out of here is `{ ok: false }`, which the ownership
 * check already handles by offering the creator manual entry; a fetcher that
 * cannot reach its platform degrades into exactly the fallback the brief asks
 * for, rather than into an error.
 *
 * Until it answers, Instagram figures are confirmed the way they always have
 * been here: a screenshot of the creator's own analytics, approved by an
 * operator. See `stat_proofs`.
 */
import { getText, logFailure } from './http';
import type { ProfileFetch, ProfileFetcher } from './types';

/**
 * The shape read out of the response. Every field optional: the body is not
 * trusted to be the shape it was last time, and a missing field is a failed
 * parse rather than a thrown `TypeError`.
 */
type WebProfileInfo = {
	data?: {
		user?: {
			edge_followed_by?: { count?: unknown };
			biography?: unknown;
			is_private?: unknown;
		} | null;
	};
};

export async function fetchInstagramProfile(
	username: string,
	fetchImpl: ProfileFetcher = fetch
): Promise<ProfileFetch> {
	const handle = username.trim().toLowerCase();
	if (!handle) return { ok: false, reason: 'no_handle' };

	const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`;
	const fetched = await getText(
		url,
		{
			'x-ig-app-id': '936619743392459',
			Accept: '*/*',
			Referer: 'https://www.instagram.com/'
		},
		fetchImpl
	);

	if (!fetched.ok) {
		/* 401 and 429 are both "not from this address, not today" rather than
		   anything about the creator, and are named so the log says which. */
		logFailure('instagram', handle, fetched.reason);
		return { ok: false, reason: fetched.reason };
	}

	let payload: WebProfileInfo;
	try {
		payload = JSON.parse(fetched.body) as WebProfileInfo;
	} catch {
		/* A 200 that is not JSON is the login wall served as HTML. */
		logFailure('instagram', handle, 'not_json');
		return { ok: false, reason: 'not_json' };
	}

	const user = payload.data?.user;
	if (!user) {
		logFailure('instagram', handle, 'no_user');
		return { ok: false, reason: 'no_user' };
	}

	/*
	 * A private account still reports its follower count and bio, so it is not
	 * refused — the bio is exactly what this needs to read, and its owner is the
	 * person asking us to read it.
	 */
	const followers = Number(user.edge_followed_by?.count);
	if (!Number.isFinite(followers) || followers < 0) {
		logFailure('instagram', handle, 'no_follower_count');
		return { ok: false, reason: 'no_follower_count' };
	}

	return {
		ok: true,
		followers: Math.floor(followers),
		bio: typeof user.biography === 'string' ? user.biography : ''
	};
}
