import * as m from '$lib/paraglide/messages';
import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { sendSecurityMail } from '$lib/server/notify';

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
	emailAndPassword: {
		enabled: true,
		/**
		 * An unverified address can still sign in.
		 *
		 * Verification exists to prove the address is reachable — which is what
		 * makes a reset link meaningful and what makes Google linking safe below
		 * — not to hold the door shut. Someone who signed up an hour before the
		 * mail server had a bad afternoon should not be locked out of an account
		 * they are already paying attention to, and the sign-up flow puts them
		 * on a profile step they can get on with regardless.
		 */
		requireEmailVerification: false,
		/** An hour is long enough to find the message and short enough that a
		    forwarded inbox is not a standing key to the account. */
		resetPasswordTokenExpiresIn: 3600,
		/**
		 * Off by better-auth's default, on here.
		 *
		 * A reset is what someone does when they have lost control of the
		 * password, and often of more than that. Leaving the sessions that were
		 * open before it standing would mean the reset changed nothing for
		 * whoever was already signed in.
		 */
		revokeSessionsOnPasswordReset: true,
		/**
		 * Told afterwards, always.
		 *
		 * If the person who reset the password is the owner, this is a receipt.
		 * If it is not, this is the only warning they will get, and it is the
		 * reason `notify.ts` treats security mail as something no preference can
		 * switch off.
		 */
		onPasswordReset: async ({ user }) => {
			await sendSecurityMail(user.email, {
				subject: m.mail_pwreset_done_subject(),
				body: [m.mail_reset_greeting({ name: user.name }), m.mail_pwreset_done_body()],
				footnote: m.mail_pwreset_done_footnote()
			});
		},
		/**
		 * The link goes out; nothing else about the request is disclosed.
		 *
		 * `/request-password-reset` answers the same way whether or not the
		 * address is on file, so this callback is the only place that knows the
		 * account exists — which is why it must not report failure back to the
		 * caller in a way the page could render differently.
		 */
		sendResetPassword: async ({ user, url }) => {
			await sendSecurityMail(user.email, {
				subject: m.mail_reset_subject(),
				body: [m.mail_reset_greeting({ name: user.name }), m.mail_reset_body()],
				action: { label: m.mail_reset_action(), url },
				footnote: m.mail_reset_footnote()
			});
		}
	},
	/**
	 * Confirming the address.
	 *
	 * Sent at sign-up rather than demanded before it: see `requireEmailVerification`
	 * above. What it buys is the thing the account-linking note below depends
	 * on — an address nobody but its owner can have confirmed.
	 */
	emailVerification: {
		sendOnSignUp: true,
		/** They clicked a link from their own inbox; making them type the
		    password again proves nothing further. */
		autoSignInAfterVerification: true,
		expiresIn: 86_400,
		sendVerificationEmail: async ({ user, url }) => {
			await sendSecurityMail(user.email, {
				subject: m.mail_verify_subject(),
				body: [m.mail_verify_greeting({ name: user.name }), m.mail_verify_body()],
				action: { label: m.mail_verify_action(), url },
				footnote: m.mail_verify_footnote()
			});
		}
	},
	/**
	 * Google's redirect lands on `${ORIGIN}/api/auth/callback/google` — that is
	 * the URI to register as an authorised redirect in the Google console, and
	 * `ORIGIN` has to match it exactly, scheme and port included.
	 *
	 * Account linking is left at better-auth's default, which attaches a Google
	 * identity to an existing local account only when that account's email is
	 * already verified. That condition is the whole protection, and it is what
	 * the verification step above exists to make meaningful: linking on an
	 * *unverified* local email is the account pre-hijacking attack — register a
	 * password account under someone else's address, wait for them to arrive
	 * through Google, and the two of you are now in the same account with only
	 * one of you aware of it. Having confirmed the address, the owner is the
	 * only person who could have, so the two identities are the same person.
	 *
	 * Someone who signed up with a password and never opened the confirmation
	 * mail still gets refused, and the login page turns the resulting
	 * `?error=account_not_linked` into an explanation rather than a dead end.
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
			/* Each of these puts a message in somebody else's inbox on demand,
			   so the limit is as much about not being a spam cannon aimed at a
			   third party as it is about protecting this server. The path is
			   `/request-password-reset`; `/forget-password` is the name from
			   older better-auth and matches no route here. */
			'/request-password-reset': { window: 600, max: 5 },
			'/send-verification-email': { window: 600, max: 5 },
			'/reset-password': { window: 600, max: 10 },
			'/verify-email': { window: 600, max: 10 }
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
