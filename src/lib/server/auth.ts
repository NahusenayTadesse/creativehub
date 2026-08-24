import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';

/**
 * Access roles. A user holds exactly one at a time; organisation permissions are
 * layered on top through `organizationMembers`, never through this field alone.
 */
export const ROLES = ['creator', 'business', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Whether "Continue with Google" is on.
 *
 * The credentials are read once, at start-up, and a provider is only registered
 * when both halves are present: a provider configured with `undefined` still
 * produces a button, and that button fails at Google with an error the reader
 * cannot act on. The login page asks this flag before drawing anything, so an
 * environment without the pair simply has no Google button.
 */
const googleClientId = env.GOOGLE_CLIENT_ID;
const googleClientSecret = env.GOOGLE_SECRET;
export const googleEnabled = Boolean(googleClientId && googleClientSecret);

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'mysql' }),
	emailAndPassword: { enabled: true },
	/**
	 * Google's redirect lands on `${ORIGIN}/api/auth/callback/google` — that is
	 * the URI to register as an authorised redirect in the Google console, and
	 * `ORIGIN` has to match it exactly, scheme and port included.
	 *
	 * Account linking is left at better-auth's default, which refuses to attach
	 * a Google identity to an existing local account whose email is unverified.
	 * This app has no email-verification step, so in practice *every* local
	 * account is unverified and the refusal always applies: someone who signed
	 * up with a password keeps signing in with that password. That is the safe
	 * direction. Linking on an unverified local email is the account
	 * pre-hijacking attack — register a password account under someone else's
	 * address, wait for them to arrive through Google, and the two of you are
	 * now in the same account with only one of you aware of it. The login page
	 * turns the resulting `?error=account_not_linked` into an explanation.
	 */
	socialProviders:
		googleClientId && googleClientSecret
			? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
			: {},
	/**
	 * Where an OAuth callback goes when it fails.
	 *
	 * `signInSocial` already asks for `/login` per handshake, but that choice is
	 * carried *inside* the state, so a callback that fails before the state is
	 * read — tampered, replayed, or simply arriving ten minutes late — cannot
	 * reach it. Those land here instead of on better-auth's bare error page, and
	 * the login page turns the `?error=` into a sentence like any other.
	 */
	onAPIError: { errorURL: '/login' },
	/**
	 * A ceiling on how fast anyone can talk to the auth endpoints.
	 *
	 * Login errors here are deliberately vague, which stops an attacker
	 * *reading* answers out of one response — it does nothing about asking a
	 * hundred thousand times. The sign-in and sign-up rules are the ones that
	 * matter: password guessing and account-farming are both volume attacks.
	 *
	 * `enabled` is normally production-only in better-auth; it is set explicitly
	 * so the setting is a decision rather than an accident of NODE_ENV.
	 *
	 * The counters live in memory, which means per process. That is the right
	 * shape for the single-node deployment this runs on; behind more than one
	 * instance, move it to `storage: 'database'` so the limit is shared.
	 */
	rateLimit: {
		enabled: true,
		/* Everything not named below: generous, since normal use touches these. */
		window: 60,
		max: 60,
		customRules: {
			/* Password guessing. Ten attempts a minute is far more than a person
			   who has forgotten which password they used, and far less than a
			   dictionary. */
			'/sign-in/email': { window: 60, max: 10 },
			/* Starting an OAuth handshake is cheap here and expensive at Google;
			   ten a minute is well past a person retrying a cancelled consent. */
			'/sign-in/social': { window: 60, max: 10 },
			/* Account farming, and the cost of hashing a password on every call. */
			'/sign-up/email': { window: 600, max: 5 },
			'/forget-password': { window: 600, max: 5 },
			'/reset-password': { window: 600, max: 10 }
		}
	},
	user: {
		additionalFields: {
			role: {
				type: 'string',
				required: false,
				defaultValue: 'creator',
				// Sign-up may propose a role, but never `admin` — see routes/register.
				input: true
			},
			phone: { type: 'string', required: false, input: true }
		}
	},
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
