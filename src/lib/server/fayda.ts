import {
	createHash,
	createPrivateKey,
	createPublicKey,
	randomBytes,
	sign,
	verify
} from 'node:crypto';

/**
 * National ID verification through Fayda, Ethiopia's digital ID.
 *
 * Fayda's relying-party integration is MOSIP eSignet: OpenID Connect, with
 * the person proving themselves to Fayda by an OTP sent to the phone on their
 * ID record. We never see their ID number or the OTP — they type both on
 * Fayda's own pages — and what comes back is a pseudonymous subject identifier
 * (`sub`), unique to this relying party, plus the claims we asked for.
 *
 * # Flow
 *
 *   authorizeUrl()      → the creator goes to Fayda, enters their FAN/FIN and OTP
 *   exchangeCode()      → the code that comes back becomes tokens, the client
 *                         authenticating with a signed JWT (private_key_jwt)
 *   fetchIdentity()     → the userinfo JWT, its signature checked against
 *                         Fayda's published keys, read for `sub` and `name`
 *
 * # What is kept
 *
 * `sub` as the verification reference, and the verified name to compare with
 * the profile. Nothing that is the ID number is requested, read or stored.
 *
 * Nothing here touches the database, the environment or cookies: credentials
 * and `fetch` arrive as arguments, so every branch is tested without a network.
 */

export type FaydaFetch = typeof fetch;

export type FaydaConfig = {
	clientId: string;
	/** The RSA private key registered with Fayda, as a JWK. */
	privateKeyJwk: Record<string, unknown>;
	redirectUri: string;
	authorizeEndpoint: string;
	tokenEndpoint: string;
	userinfoEndpoint: string;
	jwksEndpoint: string;
};

const TIMEOUT_MS = 15_000;

/** OTP, rather than biometrics: the one every Fayda holder with a phone can use. */
export const FAYDA_ACR = 'mosip:idp:acr:generated-code';

const base64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');

/** A fresh `state`, `nonce` and PKCE pair for one attempt. */
export function newAttempt() {
	const codeVerifier = base64url(randomBytes(32));
	return {
		state: base64url(randomBytes(16)),
		nonce: base64url(randomBytes(16)),
		codeVerifier,
		codeChallenge: base64url(createHash('sha256').update(codeVerifier).digest())
	};
}

export function authorizeUrl(
	config: FaydaConfig,
	attempt: { state: string; nonce: string; codeChallenge: string },
	uiLocales = 'en'
): string {
	const url = new URL(config.authorizeEndpoint);
	url.search = new URLSearchParams({
		response_type: 'code',
		client_id: config.clientId,
		redirect_uri: config.redirectUri,
		scope: 'openid profile',
		acr_values: FAYDA_ACR,
		state: attempt.state,
		nonce: attempt.nonce,
		code_challenge: attempt.codeChallenge,
		code_challenge_method: 'S256',
		display: 'page',
		prompt: 'login',
		ui_locales: uiLocales,
		/* The name only: enough to check the profile is the person's own. */
		claims: JSON.stringify({ userinfo: { name: { essential: true } }, id_token: {} })
	}).toString();
	return url.toString();
}

/** The client's proof of who it is, signed with its registered key. */
export function clientAssertion(config: FaydaConfig, now = Date.now()): string {
	const header = {
		alg: 'RS256',
		typ: 'JWT',
		...(config.privateKeyJwk.kid ? { kid: config.privateKeyJwk.kid } : {})
	};
	const iat = Math.floor(now / 1000);
	const payload = {
		iss: config.clientId,
		sub: config.clientId,
		aud: config.tokenEndpoint,
		iat,
		exp: iat + 300,
		jti: base64url(randomBytes(16))
	};
	const input = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
	const key = createPrivateKey({ key: config.privateKeyJwk as never, format: 'jwk' });
	return `${input}.${base64url(sign('RSA-SHA256', Buffer.from(input), key))}`;
}

export type FaydaResult<T> = { ok: true; value: T } | { ok: false; error: string };

async function post(
	url: string,
	body: URLSearchParams,
	fetchImpl: FaydaFetch
): Promise<{ status: number; json: Record<string, unknown> | null }> {
	const response = await fetchImpl(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
		body,
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});
	return {
		status: response.status,
		json: (await response.json().catch(() => null)) as Record<string, unknown> | null
	};
}

export async function exchangeCode(
	config: FaydaConfig,
	code: string,
	codeVerifier: string,
	fetchImpl: FaydaFetch = fetch
): Promise<FaydaResult<{ accessToken: string }>> {
	try {
		const { status, json } = await post(
			config.tokenEndpoint,
			new URLSearchParams({
				grant_type: 'authorization_code',
				code,
				redirect_uri: config.redirectUri,
				client_id: config.clientId,
				client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
				client_assertion: clientAssertion(config),
				code_verifier: codeVerifier
			}),
			fetchImpl
		);
		const accessToken = typeof json?.access_token === 'string' ? json.access_token : '';
		if (status !== 200 || !accessToken) {
			return { ok: false, error: String(json?.error ?? `token_http_${status}`) };
		}
		return { ok: true, value: { accessToken } };
	} catch {
		return { ok: false, error: 'token_unreachable' };
	}
}

type Jwk = Record<string, unknown> & { kid?: string; kty?: string; use?: string };

/** Checks an RS256 JWT against Fayda's published keys and returns its claims. */
export async function verifyJwt(
	token: string,
	jwksEndpoint: string,
	fetchImpl: FaydaFetch = fetch
): Promise<FaydaResult<Record<string, unknown>>> {
	const parts = token.split('.');
	if (parts.length !== 3) return { ok: false, error: 'not_a_jwt' };
	let header: { alg?: string; kid?: string };
	let claims: Record<string, unknown>;
	try {
		header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
		claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
	} catch {
		return { ok: false, error: 'unreadable_jwt' };
	}
	if (header.alg !== 'RS256') return { ok: false, error: 'unexpected_alg' };

	let keys: Jwk[];
	try {
		const response = await fetchImpl(jwksEndpoint, { signal: AbortSignal.timeout(TIMEOUT_MS) });
		keys = ((await response.json()) as { keys?: Jwk[] }).keys ?? [];
	} catch {
		return { ok: false, error: 'jwks_unreachable' };
	}
	const candidates = keys.filter(
		(key) => key.kty === 'RSA' && (!header.kid || key.kid === header.kid)
	);
	const signed = Buffer.from(`${parts[0]}.${parts[1]}`);
	const signature = Buffer.from(parts[2], 'base64url');
	const valid = candidates.some((jwk) => {
		try {
			return verify(
				'RSA-SHA256',
				signed,
				createPublicKey({ key: jwk as never, format: 'jwk' }),
				signature
			);
		} catch {
			return false;
		}
	});
	if (!valid) return { ok: false, error: 'bad_signature' };

	const exp = typeof claims.exp === 'number' ? claims.exp : null;
	if (exp !== null && exp * 1000 < Date.now() - 60_000) return { ok: false, error: 'expired' };
	return { ok: true, value: claims };
}

export type FaydaIdentity = { subject: string; name: string | null };

/**
 * The person Fayda verified. The userinfo answer is itself a signed JWT, and
 * it is only believed once that signature checks out.
 */
export async function fetchIdentity(
	config: FaydaConfig,
	accessToken: string,
	fetchImpl: FaydaFetch = fetch
): Promise<FaydaResult<FaydaIdentity>> {
	let body: string;
	try {
		const response = await fetchImpl(config.userinfoEndpoint, {
			headers: { Authorization: `Bearer ${accessToken}` },
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (response.status !== 200) return { ok: false, error: `userinfo_http_${response.status}` };
		body = (await response.text()).trim();
	} catch {
		return { ok: false, error: 'userinfo_unreachable' };
	}

	const verified = await verifyJwt(body, config.jwksEndpoint, fetchImpl);
	if (!verified.ok) return verified;

	const subject = typeof verified.value.sub === 'string' ? verified.value.sub : '';
	if (!subject) return { ok: false, error: 'no_subject' };
	const name = typeof verified.value.name === 'string' ? verified.value.name : null;
	return { ok: true, value: { subject, name } };
}
