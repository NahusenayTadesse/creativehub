/**
 * Asking a platform whether a handle is really there.
 *
 * A creator's reach is the number the whole marketplace prices against, and it
 * is typed in by hand — by the creator, by an operator working from a scrape,
 * by whoever is doing the encoding that day. Nothing here checks the follower
 * count, which cannot be had without a paid API; it checks the cheaper and more
 * basic thing, which is whether the account exists at all. A fabricated handle
 * is the failure this catches, and it is the one that makes every other figure
 * on the row meaningless.
 *
 * # What each platform will and will not tell an anonymous server
 *
 * Measured, not assumed — every row below was probed with real and fabricated
 * handles before it was written:
 *
 * | Platform  | How                                          | Reliable |
 * | --------- | -------------------------------------------- | -------- |
 * | TikTok    | its own oEmbed endpoint: 200 vs 400          | yes      |
 * | YouTube   | `youtube.com/@handle`: 200 vs 404            | yes      |
 * | X         | `x.com/handle`: 200 vs 404                   | yes      |
 * | Telegram  | `t.me/handle`, read the og:title             | yes      |
 * | Instagram | —                                            | no       |
 * | Facebook  | —                                            | no       |
 * | LinkedIn  | —                                            | no       |
 *
 * The last three answer the same way whether or not the account exists, and
 * they are the reason `unknown` is a status rather than an error. Instagram
 * serves a 620 KB Javascript shell with `<title>Instagram</title>` for a real
 * profile and for a fabricated one alike; its `web_profile_info` endpoint
 * answers 401 to a request without a session; unavatar's Instagram provider is
 * pro-only. Facebook returns 400 to anything that is not a browser it likes,
 * and LinkedIn returns its 999 bot status. Guessing between "missing" and
 * "cannot tell" would be worse than useless here: it would put a red mark
 * against a creator who has done nothing wrong.
 *
 * # The three answers
 *
 * `found` — the platform served the profile.
 * `not_found` — the platform said, unambiguously, that there is no such account.
 * `unknown` — nobody answered, or the answer does not distinguish the two. A
 * timeout, a rate limit and an unverifiable platform all land here, and none of
 * them is evidence against the creator.
 *
 * Only `not_found` is ever acted on.
 */
import { normaliseHandle, profileUrlFor, type LinkStatus } from '$lib/domain/social-link';

export type { LinkStatus };

export type LinkCheck = {
	status: LinkStatus;
	/** The address that was looked up, so a reader can go and see for themselves. */
	url: string | null;
	/**
	 * Why, in a word, for the log and the batch report — `http_404`,
	 * `no_strategy`, `timeout`. Not shown to readers, who get a sentence.
	 */
	detail: string;
};

/**
 * Long enough for a slow site on a slow morning, short enough that a form does
 * not sit there. A check that runs out of time is `unknown`, not `not_found`.
 */
const TIMEOUT_MS = 8000;

/**
 * These sites serve a different, smaller page to something that does not look
 * like a browser — and in Facebook's and LinkedIn's case refuse outright. This
 * is the ordinary desktop string, sent so the answer is the one a person would
 * get; nothing here scrapes content or works around a login.
 */
const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** A GET that never throws: any failure is a null response the caller reads as unknown. */
async function get(url: string): Promise<Response | null> {
	try {
		return await fetch(url, {
			headers: {
				'User-Agent': USER_AGENT,
				Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.9'
			},
			redirect: 'follow',
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return null;
	}
}

/** 200 means the profile is served, 404 means the platform denies it exists. */
async function byStatusCode(url: string): Promise<LinkCheck> {
	const response = await get(url);
	if (!response) return { status: 'unknown', url, detail: 'no_response' };
	if (response.status === 404) return { status: 'not_found', url, detail: 'http_404' };
	if (response.ok) return { status: 'found', url, detail: `http_${response.status}` };
	/* 403, 429, 5xx — the platform declined to answer the question asked. */
	return { status: 'unknown', url, detail: `http_${response.status}` };
}

/**
 * TikTok's own oEmbed endpoint, which is documented, needs no key, and answers
 * about profiles as well as videos. The profile page itself is useless for this:
 * signed out it serves the same 1.4 KB interstitial for a real creator and a
 * fabricated one.
 */
async function checkTikTok(handle: string, url: string): Promise<LinkCheck> {
	/*
	 * Lower-cased, because the endpoint is case-sensitive and the site is not.
	 * TikTok usernames are lower-case by construction, but people write them the
	 * way they see them on a profile card — "@KmoneyinEthiopia" — and oEmbed
	 * answers 400 to that while the browser opens the account happily. Sending it
	 * as typed marks real creators as fabricated, which is the one mistake this
	 * check must not make.
	 */
	const lookup = handle.toLowerCase();
	const oembed = `https://www.tiktok.com/oembed?url=${encodeURIComponent(`https://www.tiktok.com/@${lookup}`)}`;
	const response = await get(oembed);
	if (!response) return { status: 'unknown', url, detail: 'no_response' };
	if (response.ok) return { status: 'found', url, detail: 'oembed_200' };
	/* 400 is what it returns for a handle nobody holds. */
	if (response.status === 400) return { status: 'not_found', url, detail: 'oembed_400' };
	return { status: 'unknown', url, detail: `oembed_${response.status}` };
}

/**
 * Telegram answers 200 for every name, so the status code says nothing. The page
 * itself does: a name in use carries the channel or person's title, and a free
 * one falls back to "Telegram: Contact @handle" — the literal handle, because
 * there is nothing else to put there.
 */
async function checkTelegram(handle: string, url: string): Promise<LinkCheck> {
	const response = await get(url);
	if (!response) return { status: 'unknown', url, detail: 'no_response' };
	if (!response.ok) return { status: 'unknown', url, detail: `http_${response.status}` };

	const html = await response.text().catch(() => '');
	const title = html.match(/<meta property="og:title" content="([^"]*)"/i)?.[1];
	if (!title) return { status: 'unknown', url, detail: 'no_og_title' };

	const placeholder = `telegram: contact @${handle.toLowerCase()}`;
	if (title.trim().toLowerCase() === placeholder) {
		return { status: 'not_found', url, detail: 'og_title_placeholder' };
	}
	return { status: 'found', url, detail: 'og_title_named' };
}

/**
 * Whether this platform can be checked at all, so a caller can say "we do not
 * check Instagram" rather than running a request that proves nothing.
 */
export function isCheckablePlatform(platform: string): boolean {
	return ['tiktok', 'youtube', 'x', 'twitter', 'telegram'].includes(platform.trim().toLowerCase());
}

/**
 * Does this account exist?
 *
 * Never throws and never blocks for longer than `TIMEOUT_MS`: every caller —
 * a form action, a button, a nightly sweep — treats a failure to reach the
 * platform as "we do not know", which is what it is.
 */
export async function checkSocialAccount(platform: string, rawHandle: string): Promise<LinkCheck> {
	const handle = normaliseHandle(rawHandle);
	const url = profileUrlFor(platform, handle);

	if (!handle) return { status: 'unknown', url: null, detail: 'no_handle' };
	if (!url) return { status: 'unknown', url: null, detail: 'no_url_shape' };

	switch (platform.trim().toLowerCase()) {
		case 'tiktok':
			return checkTikTok(handle, url);
		case 'telegram':
			return checkTelegram(handle, url);
		case 'youtube':
		case 'x':
		case 'twitter':
			return byStatusCode(url);
		default:
			/* Instagram, Facebook, LinkedIn — see the table at the top. */
			return { status: 'unknown', url, detail: 'no_strategy' };
	}
}
