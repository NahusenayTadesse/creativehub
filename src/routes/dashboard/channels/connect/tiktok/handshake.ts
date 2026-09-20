import type { CookieSerializeOptions } from 'cookie';

/**
 * What the two halves of the TikTok handshake agree on.
 *
 * The creator's browser is the only thing that travels between them, so the
 * three values the callback must not take on trust from TikTok's query string
 * ride in a cookie instead: the state it will be compared against, the PKCE
 * verifier that proves this request started the flow, and which channel is
 * being connected.
 */
export const TIKTOK_HANDSHAKE_COOKIE = 'tiktok_connect';

export type TikTokHandshake = {
	state: string;
	verifier: string;
	socialAccountId: number;
};

/**
 * Short-lived, unreadable to scripts, and not sent on cross-site navigations.
 *
 * `lax` rather than `strict` on purpose: `strict` would withhold the cookie on
 * the top-level GET that TikTok redirects the creator back with, and the
 * callback would have nothing to compare the state against. Lax still covers
 * the case this is here for, since the cookie is never sent on a cross-site
 * POST or subresource request.
 *
 * `secure` follows the scheme actually in use so the handshake works over
 * `http://localhost` in development and is https-only everywhere else.
 */
export function handshakeCookieOptions(url: URL): CookieSerializeOptions & { path: string } {
	return {
		path: '/dashboard/channels/connect/tiktok',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		/* Long enough to read a consent screen, short enough that an abandoned
		   attempt does not sit in the browser. */
		maxAge: 10 * 60
	};
}

/** Reads the cookie back, or null if it is missing or not what we wrote. */
export function readHandshake(raw: string | undefined): TikTokHandshake | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Partial<TikTokHandshake>;
		if (typeof parsed.state !== 'string' || !parsed.state) return null;
		if (typeof parsed.verifier !== 'string' || !parsed.verifier) return null;
		if (!Number.isInteger(parsed.socialAccountId) || (parsed.socialAccountId ?? 0) <= 0) {
			return null;
		}
		return parsed as TikTokHandshake;
	} catch {
		return null;
	}
}
