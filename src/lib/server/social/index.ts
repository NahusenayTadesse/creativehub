/**
 * One door to every public-profile fetcher.
 *
 * Callers name a platform and a handle and get the common shape back. Which
 * module answers, and whether that platform can be asked at all, is decided
 * here so that nothing upstream has to hold a list of platform names.
 *
 * ## What actually answers, measured 2026-09-20
 *
 * | Platform  | Bio | Count | Notes                                          |
 * | --------- | --- | ----- | ---------------------------------------------- |
 * | YouTube   | yes | yes   | rounded; the Data API refresh corrects it      |
 * | Telegram  | yes | yes   | public channels only, not personal accounts    |
 * | Instagram | no  | no    | 401 `require_login` from every address tried   |
 * | TikTok    | no  | no    | WAF interstitial, no hydration JSON            |
 *
 * The bottom two are implemented to the brief and kept: they cost one request
 * to find out, they start working the day the platform's posture changes, and
 * until then they fail into the manual-entry fallback the flow already has.
 */
import { normaliseHandle } from '$lib/domain/social-link';
import { fetchInstagramProfile } from './instagram';
import { fetchTelegramProfile } from './telegram';
import { fetchTikTokProfile } from './tiktok-public';
import { fetchYouTubeProfile } from './youtube';
import { fetchablePlatform, type ProfileFetch, type ProfileFetcher } from './types';

export { FETCHABLE_PLATFORMS, fetchablePlatform } from './types';
export type { ProfileFetch, ProfileFetcher } from './types';

/**
 * Ask a platform about a handle.
 *
 * The handle is normalised first, with the same `normaliseHandle` the channels
 * form and the link check already share — so "@name", "name" and a pasted
 * "https://www.tiktok.com/@name" all arrive at the fetcher as `name`, and the
 * creator is never told their profile could not be found because they pasted
 * the address instead of typing the handle.
 *
 * Never throws: every failure inside a fetcher is already `{ ok: false }`, and
 * a platform with no fetcher is the same answer with `no_fetcher`. A caller
 * that wants to know whether asking is worth it calls `fetchablePlatform`
 * first; one that just asks gets a clean refusal instead of an exception.
 */
export async function fetchPublicProfile(
	platform: string,
	handle: string,
	fetchImpl: ProfileFetcher = fetch
): Promise<ProfileFetch> {
	const bare = normaliseHandle(handle);
	if (!bare) return { ok: false, reason: 'no_handle' };

	switch (fetchablePlatform(platform)) {
		case 'instagram':
			return fetchInstagramProfile(bare, fetchImpl);
		case 'tiktok':
			return fetchTikTokProfile(bare, fetchImpl);
		case 'youtube':
			return fetchYouTubeProfile(bare, fetchImpl);
		case 'telegram':
			return fetchTelegramProfile(bare, fetchImpl);
		default:
			return { ok: false, reason: 'no_fetcher' };
	}
}
