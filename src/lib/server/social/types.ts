/**
 * What every public-profile fetcher answers, and the one way it is allowed to fail.
 *
 * One shape for every platform so the ownership check does not have to know
 * which one it is talking to: it asks for a profile, and gets either the two
 * facts it needs or a word explaining why not. There is no third answer and
 * nothing throws — a platform that will not talk to us is an ordinary outcome
 * here, not an exception, and every caller has to handle it anyway.
 */
export type ProfileFetch =
	| {
			ok: true;
			/**
			 * Followers, subscribers, members — whatever the platform counts.
			 *
			 * Some platforms round in public (YouTube shows "1.15M" to anyone who is
			 * not the channel's owner), so this is what the profile *says*, which is
			 * not always what the platform's API would say. The scheduled refresh in
			 * `platform-stats.ts` replaces it with the exact figure wherever there is
			 * a key to ask with.
			 *
			 * Null when the platform serves a bio but hides the count — a YouTube
			 * channel with subscribers switched off. That is a success, not a
			 * failure: the code was found, so ownership is settled, and only the
			 * number still has to be typed in by hand. This is the one place the
			 * shape in the brief is widened, and it is widened so that a creator who
			 * has proved who they are is never sent down the "we could not reach the
			 * platform" path.
			 */
			followers: number | null;
			/** The profile's bio, description or signature — where the code is looked for. */
			bio: string;
	  }
	| {
			ok: false;
			/**
			 * A word for the server log and the row: `http_401`, `timeout`,
			 * `no_embedded_json`, `private_account`. Never shown to a creator, who
			 * gets a sentence and the manual-entry fallback instead.
			 */
			reason: string;
	  };

/** Injectable so every fetcher can be tested against a fixture without a network. */
export type ProfileFetcher = typeof fetch;

/** The platforms that have a fetcher. `platforms.name`, lower-cased. */
export const FETCHABLE_PLATFORMS = ['instagram', 'tiktok', 'youtube', 'telegram'] as const;
export type FetchablePlatform = (typeof FETCHABLE_PLATFORMS)[number];

export function fetchablePlatform(platform: string): FetchablePlatform | null {
	const name = platform.trim().toLowerCase();
	return (FETCHABLE_PLATFORMS as readonly string[]).includes(name)
		? (name as FetchablePlatform)
		: null;
}
