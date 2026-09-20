/**
 * The one outbound request the fetchers are allowed to make.
 *
 * Every rule the brief sets for talking to these sites lives here rather than
 * being repeated in four modules that could drift apart: one attempt, a hard
 * ten-second ceiling, a browser User-Agent, and no exception ever reaching the
 * caller. A fetcher that wants to be careful about something has one place to
 * look to see what it already gets for free.
 */
import type { ProfileFetcher } from './types';

/** Ten seconds, per the brief. A creator is watching a spinner while this runs. */
export const TIMEOUT_MS = 10_000;

/**
 * The ordinary desktop string.
 *
 * Instagram and TikTok both serve something smaller and emptier to a client
 * that does not look like a browser. Sending this asks for the page a person
 * would be shown; nothing here works around a login or reads anything a signed
 * -out visitor could not read for themselves.
 */
export const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export type Fetched =
	{ ok: true; status: number; body: string } | { ok: false; reason: string; status?: number };

/**
 * A single GET that never throws and never retries.
 *
 * No retry loop on purpose: the failures these endpoints actually produce —
 * 401 `require_login`, a WAF interstitial, a 429 — are all decisions about who
 * is asking, and asking again immediately changes none of them while doubling
 * the time the creator waits and the rate we are judged on.
 */
export async function getText(
	url: string,
	headers: Record<string, string>,
	fetchImpl: ProfileFetcher = fetch
): Promise<Fetched> {
	try {
		const response = await fetchImpl(url, {
			headers: {
				'User-Agent': USER_AGENT,
				'Accept-Language': 'en-US,en;q=0.9',
				...headers
			},
			redirect: 'follow',
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});

		if (!response.ok)
			return { ok: false, reason: `http_${response.status}`, status: response.status };

		return { ok: true, status: response.status, body: await response.text() };
	} catch (err) {
		/* `AbortSignal.timeout` rejects with a TimeoutError; everything else here
		   is DNS, TLS or a socket dying. Both are "nobody answered". */
		const timedOut = err instanceof Error && err.name === 'TimeoutError';
		return { ok: false, reason: timedOut ? 'timeout' : 'network_error' };
	}
}

/**
 * What went wrong, on the server's log and nowhere else.
 *
 * Deliberately the reason and the handle, never the response body: these
 * endpoints answer with hundreds of kilobytes of markup, and a log that
 * swallows a 620 KB Instagram shell on every failed check is a log nobody will
 * read and a disk nobody expected to fill.
 */
export function logFailure(platform: string, handle: string, reason: string) {
	console.warn(`[social] ${platform} lookup failed for @${handle}: ${reason}`);
}
