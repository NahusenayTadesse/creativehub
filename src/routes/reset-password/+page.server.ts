import * as m from '$lib/paraglide/messages';
import { redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { APIError } from 'better-auth/api';
import type { PageServerLoad, Actions } from './$types';
import { auth } from '$lib/server/auth';
import { resetPassword } from '$lib/schemas';

/**
 * The far end of the link in the reset email.
 *
 * The reader does not arrive here from the message directly: the link points at
 * better-auth's `/api/auth/reset-password/:token`, which checks the token has
 * the right shape, then redirects here with it in the query string. So `?token=`
 * being present means only that *a* token was carried this far — whether it is
 * live, expired, or already spent is not known until it is used, which is why
 * that failure is handled at submit rather than on load.
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	if (locals.user) redirect(303, '/dashboard/settings');

	const token = url.searchParams.get('token') ?? '';
	const form = await superValidate(zod4(resetPassword));
	form.data.token = token;

	return { form, hasToken: Boolean(token) };
};

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod4(resetPassword));
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		try {
			await auth.api.resetPassword({
				body: { newPassword: form.data.password, token: form.data.token },
				headers: event.request.headers
			});
		} catch (err) {
			/* An expired or spent token is the expected failure here, not a fault:
			   these links are one hour and one use, and a reader who opened the
			   message twice will meet this. The page offers a fresh one. */
			if (err instanceof APIError) {
				return message(form, { type: 'error', text: m.srv_reset_invalid() }, { status: 400 });
			}
			console.error('Password reset failed:', err);
			return message(form, { type: 'error', text: m.srv_reset_failed() }, { status: 500 });
		}

		/*
		 * To the login page rather than into the account.
		 *
		 * The reset revokes every session the account had — see
		 * `revokeSessionsOnPasswordReset` — and opens none, which is the point:
		 * whoever prompted this is signed out too. Typing the new password once,
		 * here, is also the cheapest confirmation that it is the password they
		 * think it is, rather than finding out days later with no link left.
		 */
		redirect(303, '/login?reset=1');
	}
};
