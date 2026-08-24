import * as m from '$lib/paraglide/messages';
import { error, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { APIError } from 'better-auth/api';
import type { PageServerLoad, Actions } from './$types';
import { auth, googleEnabled } from '$lib/server/auth';
import { loginSchema } from '$lib/schemas';
import { safeNext } from '$lib/server/guards';

/**
 * What to say about a failed Google handshake.
 *
 * better-auth sends its OAuth failures back to `errorCallbackURL` as
 * `?error=<code>`, so the codes arrive here in the query string. Only the one
 * a reader can actually do something about is named; everything else — a
 * cancelled consent screen, an expired state, a provider outage — is the same
 * "try again" as far as the person in front of the browser is concerned.
 */
function oauthErrorText(code: string | null) {
	if (!code) return null;
	return code === 'account_not_linked' ? m.srv_google_not_linked() : m.srv_google_failed();
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
	return {
		form: await superValidate(zod4(loginSchema)),
		google: googleEnabled,
		oauthError: oauthErrorText(url.searchParams.get('error'))
	};
};

export const actions: Actions = {
	login: async (event) => {
		const form = await superValidate(event.request, zod4(loginSchema));
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		try {
			await auth.api.signInEmail({
				body: { email: form.data.email, password: form.data.password },
				headers: event.request.headers
			});
		} catch (err) {
			// Deliberately vague: a precise error tells an attacker which half was right.
			if (err instanceof APIError) {
				return message(form, { type: 'error', text: m.srv_bad_credentials() }, { status: 401 });
			}
			console.error('Sign-in failed:', err);
			return message(form, { type: 'error', text: m.srv_signin_failed() }, { status: 500 });
		}

		redirect(303, safeNext(event.url.searchParams.get('next')));
	},

	/**
	 * Hands the browser to Google.
	 *
	 * This is a plain form post rather than a client-side call so the button
	 * works with scripting off, like every other form on the site. better-auth
	 * builds the authorisation URL and — through the `sveltekitCookies` plugin —
	 * sets the state and PKCE cookies on *this* response, which is why the
	 * redirect has to be the thing that carries them; returning the URL to the
	 * page and navigating from there would drop them.
	 *
	 * Note that `redirect()` throws, so it sits outside the `try`: catching it
	 * would turn a successful hand-off into a 500.
	 */
	google: async (event) => {
		if (!googleEnabled) error(503, m.srv_google_unavailable());

		const next = safeNext(event.url.searchParams.get('next'));
		let url: string | undefined;

		try {
			const result = await auth.api.signInSocial({
				body: {
					provider: 'google',
					/* Where a returning user lands: the same `?next=` the password
					   form honours, already checked for off-site destinations. */
					callbackURL: next,
					/* A brand-new account has role `creator` — the field's default,
					   since Google tells us nothing about which side of the market
					   someone is on — so it lands on the step the creator sign-up
					   ends at. A brand joins through /register, where the role is
					   asked for. */
					newUserCallbackURL: '/dashboard/profile/create',
					errorCallbackURL: '/login'
				},
				headers: event.request.headers
			});
			url = result.url;
		} catch (err) {
			console.error('Google sign-in failed to start:', err);
			redirect(303, '/login?error=start_failed');
		}

		if (!url) redirect(303, '/login?error=start_failed');
		redirect(303, url);
	}
};
