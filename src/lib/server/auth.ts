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

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'mysql' }),
	emailAndPassword: { enabled: true },
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
