import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
	authorizeUrl,
	clientAssertion,
	exchangeCode,
	fetchIdentity,
	newAttempt,
	type FaydaConfig
} from './fayda';

const client = generateKeyPairSync('rsa', { modulusLength: 2048 });
const fayda = generateKeyPairSync('rsa', { modulusLength: 2048 });
const faydaJwk = { ...fayda.publicKey.export({ format: 'jwk' }), kid: 'fayda-1', use: 'sig' };

const config: FaydaConfig = {
	clientId: 'ie-client',
	privateKeyJwk: client.privateKey.export({ format: 'jwk' }) as Record<string, unknown>,
	redirectUri: 'https://influencerethiopia.com/dashboard/verification/fayda/callback',
	authorizeEndpoint: 'https://fayda.test/authorize',
	tokenEndpoint: 'https://fayda.test/token',
	userinfoEndpoint: 'https://fayda.test/userinfo',
	jwksEndpoint: 'https://fayda.test/jwks'
};

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const faydaJwt = (claims: Record<string, unknown>, key = fayda.privateKey) => {
	const input = `${b64({ alg: 'RS256', kid: 'fayda-1' })}.${b64(claims)}`;
	return `${input}.${sign('RSA-SHA256', Buffer.from(input), key).toString('base64url')}`;
};

/** A stand-in for Fayda's three endpoints. */
const fakeFayda = (userinfo: string, tokenStatus = 200) =>
	(async (input: RequestInfo | URL) => {
		const url = String(input);
		if (url.endsWith('/token')) {
			return new Response(
				JSON.stringify(tokenStatus === 200 ? { access_token: 'at' } : { error: 'invalid_grant' }),
				{
					status: tokenStatus
				}
			);
		}
		if (url.endsWith('/jwks')) return new Response(JSON.stringify({ keys: [faydaJwk] }));
		if (url.endsWith('/userinfo')) return new Response(userinfo, { status: 200 });
		return new Response('', { status: 404 });
	}) as unknown as typeof fetch;

describe('Fayda', () => {
	it('sends the person to Fayda for an OTP, with PKCE, asking only for the name', () => {
		const attempt = newAttempt();
		const url = new URL(authorizeUrl(config, attempt));
		expect(url.searchParams.get('acr_values')).toBe('mosip:idp:acr:generated-code');
		expect(url.searchParams.get('code_challenge_method')).toBe('S256');
		expect(url.searchParams.get('state')).toBe(attempt.state);
		expect(JSON.parse(url.searchParams.get('claims')!)).toEqual({
			userinfo: { name: { essential: true } },
			id_token: {}
		});
	});

	it('signs its client assertion with the registered key', () => {
		const [, payload] = clientAssertion(config).split('.');
		const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
		expect(claims.iss).toBe('ie-client');
		expect(claims.aud).toBe('https://fayda.test/token');
	});

	it('keeps the pseudonymous subject and the name, from a signed answer only', async () => {
		const token = await exchangeCode(config, 'code', 'verifier', fakeFayda(''));
		expect(token).toEqual({ ok: true, value: { accessToken: 'at' } });

		const good = await fetchIdentity(
			config,
			'at',
			fakeFayda(faydaJwt({ sub: 'psut-123', name: 'Selam Tesfaye' }))
		);
		expect(good).toEqual({ ok: true, value: { subject: 'psut-123', name: 'Selam Tesfaye' } });

		const forged = await fetchIdentity(
			config,
			'at',
			fakeFayda(faydaJwt({ sub: 'psut-123', name: 'Someone' }, client.privateKey))
		);
		expect(forged).toEqual({ ok: false, error: 'bad_signature' });
	});

	it('reports a refused code rather than throwing', async () => {
		expect(await exchangeCode(config, 'code', 'verifier', fakeFayda('', 400))).toEqual({
			ok: false,
			error: 'invalid_grant'
		});
	});
});
