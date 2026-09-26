import { env } from '$env/dynamic/private';
import type { FaydaConfig } from '$lib/server/fayda';

/** Where one Fayda attempt's state, nonce and PKCE verifier wait for the callback. */
export const FAYDA_COOKIE = 'fayda_attempt';

/**
 * Fayda's settings, from the environment. Null until the platform has been
 * registered as a relying party and given a client id and a key — until then
 * the verification page says the check is not available yet rather than
 * offering a button that cannot work.
 *
 *   FAYDA_CLIENT_ID          the relying party's client id
 *   FAYDA_PRIVATE_KEY_JWK    its RSA private key as a JWK — JSON, or base64 of it
 *   FAYDA_ISSUER             https://esignet.ida.fayda.et unless told otherwise
 *   FAYDA_REDIRECT_URI       defaults to <ORIGIN>/dashboard/verification/fayda/callback
 *
 * The four endpoints follow eSignet's standard paths under the issuer and
 * may each be overridden (FAYDA_AUTHORIZE_URL, FAYDA_TOKEN_URL,
 * FAYDA_USERINFO_URL, FAYDA_JWKS_URL) if the registration says otherwise.
 */
export function faydaConfig(): FaydaConfig | null {
	const clientId = (env.FAYDA_CLIENT_ID ?? '').trim();
	const rawKey = (env.FAYDA_PRIVATE_KEY_JWK ?? '').trim();
	if (!clientId || !rawKey) return null;

	let privateKeyJwk: Record<string, unknown>;
	try {
		const text = rawKey.startsWith('{') ? rawKey : Buffer.from(rawKey, 'base64').toString('utf8');
		privateKeyJwk = JSON.parse(text);
	} catch {
		console.error('FAYDA_PRIVATE_KEY_JWK is not a JWK; Fayda verification is off.');
		return null;
	}

	const issuer = (env.FAYDA_ISSUER ?? 'https://esignet.ida.fayda.et').replace(/\/+$/, '');
	const origin = (env.ORIGIN ?? '').replace(/\/+$/, '');
	return {
		clientId,
		privateKeyJwk,
		redirectUri: env.FAYDA_REDIRECT_URI || `${origin}/dashboard/verification/fayda/callback`,
		authorizeEndpoint: env.FAYDA_AUTHORIZE_URL || `${issuer}/authorize`,
		tokenEndpoint: env.FAYDA_TOKEN_URL || `${issuer}/v1/esignet/oauth/v2/token`,
		userinfoEndpoint: env.FAYDA_USERINFO_URL || `${issuer}/v1/esignet/oidc/userinfo`,
		jwksEndpoint: env.FAYDA_JWKS_URL || `${issuer}/v1/esignet/oauth/.well-known/jwks.json`
	};
}
