import { describe, expect, it } from 'vitest';
import {
	authorizeUrl,
	codeChallenge,
	engagementFrom,
	exchangeCode,
	fetchTikTokUser,
	randomToken,
	refreshTokens,
	TIKTOK_SCOPES,
	type OAuthFetch,
	type TikTokCredentials,
	type TikTokUser
} from './tiktok-oauth';

const credentials: TikTokCredentials = {
	clientId: 'awtestkey',
	clientSecret: 'shhh',
	redirectUri: 'https://example.test/dashboard/channels/connect/tiktok/callback'
};

/** A `fetch` that answers every call the same way, and records what it was sent. */
function fakeFetch(status: number, body: unknown) {
	const calls: { url: string; init?: RequestInit }[] = [];
	const impl = (async (input: string | URL | Request, init?: RequestInit) => {
		calls.push({ url: String(input), init });
		return new Response(JSON.stringify(body), { status });
	}) as OAuthFetch;
	return { impl, calls };
}

/** A `fetch` that fails the way a timeout does — by throwing. */
const deadFetch = (async () => {
	throw new Error('timeout');
}) as OAuthFetch;

const tokenBody = {
	access_token: 'at-1',
	expires_in: 86400,
	refresh_token: 'rt-1',
	refresh_expires_in: 31536000,
	open_id: 'open-1',
	scope: TIKTOK_SCOPES
};

const userBody = (user: Record<string, unknown>) => ({ data: { user }, error: { code: 'ok' } });

describe('authorizeUrl', () => {
	it('asks for the two scopes, with PKCE', () => {
		const url = new URL(authorizeUrl(credentials, 'state-1', 'challenge-1'));

		expect(url.origin + url.pathname).toBe('https://www.tiktok.com/v2/auth/authorize/');
		/* TikTok's name for the public half of the credentials, not `client_id`. */
		expect(url.searchParams.get('client_key')).toBe('awtestkey');
		expect(url.searchParams.get('scope')).toBe('user.info.basic,user.info.stats');
		expect(url.searchParams.get('response_type')).toBe('code');
		expect(url.searchParams.get('state')).toBe('state-1');
		expect(url.searchParams.get('code_challenge')).toBe('challenge-1');
		expect(url.searchParams.get('code_challenge_method')).toBe('S256');
		expect(url.searchParams.get('redirect_uri')).toBe(credentials.redirectUri);
	});
});

describe('PKCE', () => {
	it('makes a URL-safe verifier that is different every time', () => {
		const a = randomToken();
		const b = randomToken();
		expect(a).not.toBe(b);
		expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
	});

	it('hashes the verifier to a URL-safe challenge', async () => {
		/* The published RFC 7636 example, so a change to the encoding is caught
		   rather than merely noticed. */
		const challenge = await codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
		expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
	});
});

describe('exchangeCode', () => {
	it('posts the code with the verifier and reads the token pair back', async () => {
		const { impl, calls } = fakeFetch(200, tokenBody);
		const result = await exchangeCode(credentials, 'code-1', 'verifier-1', impl);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.tokens.accessToken).toBe('at-1');
		expect(result.tokens.refreshToken).toBe('rt-1');
		expect(result.tokens.openId).toBe('open-1');
		expect(result.tokens.expiresIn).toBe(86400);

		const sent = new URLSearchParams(String(calls[0].init?.body));
		expect(sent.get('grant_type')).toBe('authorization_code');
		expect(sent.get('code_verifier')).toBe('verifier-1');
		expect(sent.get('client_secret')).toBe('shhh');
	});

	it('decodes a percent-encoded code, which TikTok sends', async () => {
		const { impl, calls } = fakeFetch(200, tokenBody);
		await exchangeCode(credentials, 'abc%2A123', 'verifier-1', impl);

		expect(new URLSearchParams(String(calls[0].init?.body)).get('code')).toBe('abc*123');
	});

	it('treats invalid_grant as final — a used code is not worth retrying', async () => {
		const { impl } = fakeFetch(400, { error: 'invalid_grant', error_description: 'used' });
		const result = await exchangeCode(credentials, 'code-1', 'v', impl);

		expect(result).toMatchObject({ ok: false, detail: 'invalid_grant', fatal: true });
	});

	it('treats a rate limit as worth retrying', async () => {
		const { impl } = fakeFetch(429, { error: 'rate_limit_exceeded' });
		const result = await exchangeCode(credentials, 'code-1', 'v', impl);

		expect(result).toMatchObject({ ok: false, detail: 'rate_limit_exceeded' });
		expect(result.ok === false && result.fatal).toBeFalsy();
	});

	it('refuses a 200 that is missing the token', async () => {
		const { impl } = fakeFetch(200, { open_id: 'open-1', expires_in: 100 });
		expect(await exchangeCode(credentials, 'code-1', 'v', impl)).toMatchObject({
			ok: false,
			detail: 'bad_token_reply'
		});
	});

	it('reads a network failure as no answer, not as a refusal', async () => {
		expect(await exchangeCode(credentials, 'code-1', 'v', deadFetch)).toMatchObject({
			ok: false,
			detail: 'no_response'
		});
	});
});

describe('refreshTokens', () => {
	it('sends the refresh grant and reads the replacement pair', async () => {
		const { impl, calls } = fakeFetch(200, {
			...tokenBody,
			access_token: 'at-2',
			refresh_token: 'rt-2'
		});
		const result = await refreshTokens(credentials, 'rt-1', impl);

		expect(result.ok && result.tokens.accessToken).toBe('at-2');
		/* TikTok retires the old refresh token, so the new one must come back. */
		expect(result.ok && result.tokens.refreshToken).toBe('rt-2');

		const sent = new URLSearchParams(String(calls[0].init?.body));
		expect(sent.get('grant_type')).toBe('refresh_token');
		expect(sent.get('refresh_token')).toBe('rt-1');
	});
});

describe('fetchTikTokUser', () => {
	it('returns the handle and the counts', async () => {
		const { impl, calls } = fakeFetch(
			200,
			userBody({
				open_id: 'open-1',
				username: 'kmoney',
				display_name: 'K Money',
				follower_count: 48210,
				likes_count: 900000,
				video_count: 120
			})
		);
		const result = await fetchTikTokUser('at-1', impl);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.user).toMatchObject({ openId: 'open-1', username: 'kmoney', followers: 48210 });
		expect(calls[0].init?.headers).toMatchObject({ Authorization: 'Bearer at-1' });
	});

	it('reports a missing follower count as a scope that was not granted', async () => {
		/* A creator can untick the stats scope on the consent screen. The field is
		   then absent, and storing 0 would overwrite a real figure with a lie. */
		const { impl } = fakeFetch(200, userBody({ open_id: 'open-1', username: 'kmoney' }));
		expect(await fetchTikTokUser('at-1', impl)).toMatchObject({
			ok: false,
			detail: 'scope_not_granted',
			fatal: true
		});
	});

	it('reads an error reported in the body of a 200', async () => {
		const { impl } = fakeFetch(200, { error: { code: 'access_token_invalid', message: 'no' } });
		expect(await fetchTikTokUser('at-1', impl)).toMatchObject({
			ok: false,
			detail: 'access_token_invalid',
			fatal: true
		});
	});

	it('does not treat a 5xx as a dead grant', async () => {
		const { impl } = fakeFetch(503, {});
		const result = await fetchTikTokUser('at-1', impl);
		expect(result).toMatchObject({ ok: false, detail: 'http_503' });
		expect(result.ok === false && result.fatal).toBeFalsy();
	});
});

describe('engagementFrom', () => {
	const user = (over: Partial<TikTokUser>): TikTokUser => ({
		openId: 'open-1',
		username: 'kmoney',
		displayName: 'K Money',
		followers: 1000,
		likes: 20000,
		videos: 100,
		...over
	});

	it('is average likes per video as a share of the audience', () => {
		/* 20000 likes / 100 videos = 200 per video, against 1000 followers = 20%. */
		expect(engagementFrom(user({}))).toBe(20);
	});

	it('is null when any part is missing, so a stored rate is left alone', () => {
		expect(engagementFrom(user({ likes: null }))).toBeNull();
		expect(engagementFrom(user({ videos: null }))).toBeNull();
		expect(engagementFrom(user({ videos: 0 }))).toBeNull();
		expect(engagementFrom(user({ followers: 0 }))).toBeNull();
	});

	it('caps a tiny account whose one video went wide', () => {
		expect(engagementFrom(user({ followers: 10, likes: 500000, videos: 1 }))).toBe(100);
	});
});
