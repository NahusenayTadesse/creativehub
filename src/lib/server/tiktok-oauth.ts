/**
 * The TikTok half of "connect this channel": the handshake and the one call
 * that answers how big the account is.
 *
 * # Why this exists
 *
 * `social-check.ts` can tell whether a TikTok handle is real, through the
 * public oEmbed endpoint, and that is the end of what TikTok says to a stranger
 * — the profile page itself serves a WAF challenge of about 1.4 KB to a real
 * handle and a fabricated one alike. Follower counts come from exactly one
 * place: an account whose owner has signed in to our app and granted
 * `user.info.stats`. That is what this module drives.
 *
 * # Flow
 *
 *   authorizeUrl()  → the creator goes to TikTok and approves
 *   exchangeCode()  → the code that comes back becomes a token pair
 *   fetchTikTokUser() → display name, handle, follower count, likes, videos
 *   refreshTokens() → an access token lasts a day; the refresh token a year
 *
 * # Shape
 *
 * Nothing here touches the database, the environment or cookies. Credentials
 * and `fetch` arrive as arguments, so every branch below is tested without a
 * network — the same arrangement as `platform-stats.ts`, and for the same
 * reason: this code runs unattended against somebody else's service, and the
 * failure paths are the part that has to be right.
 *
 * # Names
 *
 * TikTok calls the public half `client_key`, not `client_id`. The environment
 * variable is `TIKTOK_CLIENT_ID` because that is what is already in `.env`;
 * the rename happens here, at the edge, rather than everywhere else.
 */

export type OAuthFetch = typeof fetch;

/** Long enough for a slow handshake, short enough that a callback does not hang. */
const TIMEOUT_MS = 10_000;

const AUTHORIZE = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN = 'https://open.tiktokapis.com/v2/oauth/token/';
const USER_INFO = 'https://open.tiktokapis.com/v2/user/info/';

/**
 * What we ask for, and nothing beyond it.
 *
 * `user.info.basic` is mandatory — TikTok refuses an authorisation without it —
 * and carries the open id, the display name and the handle. `user.info.stats`
 * is the one that matters here: follower count, likes and video count. Neither
 * grants any access to post, to read messages, or to see anything the profile
 * does not already show a visitor.
 */
export const TIKTOK_SCOPES = 'user.info.basic,user.info.stats';

export type TikTokCredentials = {
	/** TikTok's `client_key`. */
	clientId: string;
	clientSecret: string;
	/** Must match the one registered in the TikTok app, character for character. */
	redirectUri: string;
};

export type TikTokTokens = {
	accessToken: string;
	/** Seconds from now, as TikTok reports it — turned into a date by the caller. */
	expiresIn: number;
	refreshToken: string | null;
	refreshExpiresIn: number | null;
	openId: string;
	/** What was actually granted, which can be less than what was asked for. */
	scope: string;
};

export type TikTokUser = {
	openId: string;
	username: string | null;
	displayName: string | null;
	followers: number;
	likes: number | null;
	videos: number | null;
};

export type TikTokFailure = {
	/** A word for the log and the row: `expired_code`, `scope_not_granted`. */
	detail: string;
	/** The grant is finished and no retry will help — the creator must reconnect. */
	fatal?: boolean;
};

export type TikTokResult<T> = ({ ok: true } & T) | ({ ok: false } & TikTokFailure);

/* ------------------------------------------------------------------ *
 * PKCE
 *
 * TikTok allows a confidential client to skip this, and we do it anyway: the
 * code is handed back through the creator's browser, which is a place we do not
 * control. Without a verifier, a code intercepted there is redeemable by
 * whoever holds it; with one, it is redeemable only by the request that started
 * the flow.
 * ------------------------------------------------------------------ */

const base64url = (bytes: ArrayBuffer | Uint8Array): string => {
	const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let binary = '';
	for (const byte of view) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** A fresh, unguessable value — used for both the PKCE verifier and the state. */
export function randomToken(bytes = 32): string {
	return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** The S256 challenge for a verifier. TikTok rejects the `plain` method. */
export async function codeChallenge(verifier: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
	return base64url(digest);
}

/** Where to send the creator to approve the grant. */
export function authorizeUrl(
	credentials: TikTokCredentials,
	state: string,
	challenge: string
): string {
	const query = new URLSearchParams({
		client_key: credentials.clientId,
		scope: TIKTOK_SCOPES,
		response_type: 'code',
		redirect_uri: credentials.redirectUri,
		state,
		code_challenge: challenge,
		code_challenge_method: 'S256'
	});
	return `${AUTHORIZE}?${query}`;
}

/* ------------------------------------------------------------------ *
 * Token endpoint
 * ------------------------------------------------------------------ */

type TokenReply = {
	access_token?: unknown;
	expires_in?: unknown;
	refresh_token?: unknown;
	refresh_expires_in?: unknown;
	open_id?: unknown;
	scope?: unknown;
	error?: unknown;
	error_description?: unknown;
};

/** A POST that never throws. Null is "no answer at all" — a timeout, a DNS failure. */
async function postForm(
	url: string,
	body: Record<string, string>,
	fetchImpl: OAuthFetch
): Promise<{ status: number; body: TokenReply | null } | null> {
	try {
		const response = await fetchImpl(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				/* TikTok's token endpoint answers HTML to a request that does not
				   ask for JSON, which parses to null and reads as a bad reply. */
				Accept: 'application/json',
				'Cache-Control': 'no-cache'
			},
			body: new URLSearchParams(body).toString(),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		return {
			status: response.status,
			body: (await response.json().catch(() => null)) as TokenReply
		};
	} catch {
		return null;
	}
}

const asPositive = (value: unknown): number | null => {
	const number = Number(value);
	return Number.isFinite(number) && number > 0 ? number : null;
};

/**
 * Reads a token reply, whichever endpoint produced it.
 *
 * The two grant types answer with the same body, so they are parsed in one
 * place. A reply missing the access token or the open id is a failure even if
 * the status was 200 — TikTok reports some errors that way.
 */
function readTokens(
	response: Awaited<ReturnType<typeof postForm>>,
	what: string
): TikTokResult<{ tokens: TikTokTokens }> {
	if (!response) return { ok: false, detail: 'no_response' };

	const body = response.body;
	const error = typeof body?.error === 'string' ? body.error : null;
	if (error) {
		/*
		 * `invalid_grant` is the one that is final: the code was already used, or
		 * the refresh token has expired or been revoked from the creator's TikTok
		 * settings. Everything else — a rate limit, a 5xx — may work next hour.
		 */
		return { ok: false, detail: error, fatal: error === 'invalid_grant' };
	}
	if (response.status !== 200) return { ok: false, detail: `http_${response.status}` };

	const accessToken = typeof body?.access_token === 'string' ? body.access_token : '';
	const openId = typeof body?.open_id === 'string' ? body.open_id : '';
	const expiresIn = asPositive(body?.expires_in);
	if (!accessToken || !openId || !expiresIn) return { ok: false, detail: `bad_${what}_reply` };

	return {
		ok: true,
		tokens: {
			accessToken,
			expiresIn,
			refreshToken: typeof body?.refresh_token === 'string' ? body.refresh_token : null,
			refreshExpiresIn: asPositive(body?.refresh_expires_in),
			openId,
			scope: typeof body?.scope === 'string' ? body.scope : ''
		}
	};
}

/** Turns the code TikTok sent back into a token pair. One use only. */
export async function exchangeCode(
	credentials: TikTokCredentials,
	code: string,
	verifier: string,
	fetchImpl: OAuthFetch = fetch
): Promise<TikTokResult<{ tokens: TikTokTokens }>> {
	const response = await postForm(
		TOKEN,
		{
			client_key: credentials.clientId,
			client_secret: credentials.clientSecret,
			/* TikTok percent-encodes the code it puts in the query string, and a
			   code containing `%2A` redeemed as-is is refused as invalid. */
			code: decodeURIComponent(code),
			grant_type: 'authorization_code',
			redirect_uri: credentials.redirectUri,
			code_verifier: verifier
		},
		fetchImpl
	);
	return readTokens(response, 'token');
}

/**
 * A new access token from a refresh token.
 *
 * TikTok returns a *new* refresh token each time and retires the old one, so
 * the caller must store what comes back; keeping the original would work once
 * and then stop.
 */
export async function refreshTokens(
	credentials: TikTokCredentials,
	refreshToken: string,
	fetchImpl: OAuthFetch = fetch
): Promise<TikTokResult<{ tokens: TikTokTokens }>> {
	const response = await postForm(
		TOKEN,
		{
			client_key: credentials.clientId,
			client_secret: credentials.clientSecret,
			grant_type: 'refresh_token',
			refresh_token: refreshToken
		},
		fetchImpl
	);
	return readTokens(response, 'refresh');
}

/* ------------------------------------------------------------------ *
 * User info
 * ------------------------------------------------------------------ */

type UserInfoReply = {
	data?: { user?: Record<string, unknown> };
	error?: { code?: unknown; message?: unknown };
};

/** The fields asked for. Anything not granted comes back absent, not zero. */
const USER_FIELDS = 'open_id,union_id,display_name,username,follower_count,likes_count,video_count';

/**
 * Who this is and how big they are.
 *
 * `follower_count` is the whole point, and it is the field that disappears when
 * `user.info.stats` was not granted — a creator can untick a scope on TikTok's
 * consent screen. A reply without it is reported as `scope_not_granted` rather
 * than stored as zero, because a zero here would be written into the profile as
 * a confirmed figure and wipe out whatever the creator had said.
 */
export async function fetchTikTokUser(
	accessToken: string,
	fetchImpl: OAuthFetch = fetch
): Promise<TikTokResult<{ user: TikTokUser }>> {
	let response: Response;
	try {
		response = await fetchImpl(`${USER_INFO}?fields=${encodeURIComponent(USER_FIELDS)}`, {
			headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		return { ok: false, detail: 'no_response' };
	}

	const body = (await response.json().catch(() => null)) as UserInfoReply | null;
	const code = typeof body?.error?.code === 'string' ? body.error.code : '';

	/* TikTok reports errors in the body with a 200 as often as by status. `ok`
	   is its word for "no error", so anything else is one. */
	if (code && code !== 'ok') {
		const fatal = code === 'access_token_invalid' || code === 'scope_not_authorized';
		return { ok: false, detail: code, fatal };
	}
	if (response.status === 401) return { ok: false, detail: 'unauthorised', fatal: true };
	if (response.status !== 200) return { ok: false, detail: `http_${response.status}` };

	const user = body?.data?.user;
	const openId = typeof user?.open_id === 'string' ? user.open_id : '';
	if (!openId) return { ok: false, detail: 'bad_user_reply' };

	const followers = Number(user?.follower_count);
	if (!Number.isFinite(followers)) return { ok: false, detail: 'scope_not_granted', fatal: true };

	const optionalCount = (value: unknown) => {
		const number = Number(value);
		return Number.isFinite(number) ? number : null;
	};

	return {
		ok: true,
		user: {
			openId,
			username: typeof user?.username === 'string' ? user.username : null,
			displayName: typeof user?.display_name === 'string' ? user.display_name : null,
			followers: Math.max(0, Math.round(followers)),
			likes: optionalCount(user?.likes_count),
			videos: optionalCount(user?.video_count)
		}
	};
}

/**
 * An engagement rate from what TikTok's profile scope gives.
 *
 * Total likes ÷ videos ÷ followers: the average likes a post gets, as a share
 * of the audience, which is the conventional reading of TikTok engagement and
 * the only one available without `video.list`. It is deliberately not comparable
 * with the YouTube figure, which is per view — the two platforms are scored
 * against their own kind, and `$lib/domain/stat-source` labels which platform
 * confirmed a number.
 *
 * Null whenever any part is missing or zero, so the caller leaves the stored
 * rate and its source exactly as they were rather than writing a confident 0.
 */
export function engagementFrom(user: TikTokUser): number | null {
	if (!user.likes || !user.videos || !user.followers) return null;
	const rate = (user.likes / user.videos / user.followers) * 100;
	if (!Number.isFinite(rate) || rate <= 0) return null;
	/* Two decimals, and capped: a small account whose one video went wide can
	   compute past 100%, which is arithmetic rather than engagement. */
	return Math.min(100, Math.round(rate * 100) / 100);
}
