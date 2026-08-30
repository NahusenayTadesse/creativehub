import * as m from '$lib/paraglide/messages';
import { redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { APIError } from 'better-auth/api';
import type { PageServerLoad, Actions } from './$types';
import { auth } from '$lib/server/auth';
import { forgotPassword } from '$lib/schemas';

export const load: PageServerLoad = async ({ locals }) => {
	/* Somebody already signed in wants the password *change* on the settings
	   page, which asks for the current one. Sending a link to their inbox to do
	   what they can do in front of us is a worse version of the same thing. */
	if (locals.user) redirect(303, '/dashboard/settings');

	return { form: await superValidate(zod4(forgotPassword)) };
};

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod4(forgotPassword));
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		try {
			await auth.api.requestPasswordReset({
				body: {
					email: form.data.email,
					/* Where better-auth sends them after it has exchanged the token
					   in the link for one in the query string. Same-origin, which
					   its `originCheck` requires. */
					redirectTo: '/reset-password'
				},
				headers: event.request.headers
			});
		} catch (err) {
			/*
			 * The endpoint answers the same way for an address on file and one
			 * that is not — it is written that way deliberately, down to a dummy
			 * token lookup so the two take the same time. So the only errors that
			 * reach here are ours: rate limiting, or a mail server that is down.
			 *
			 * Rate limiting still has to look like everything else. Saying "too
			 * many requests for this address" would answer the question the
			 * silence exists to avoid.
			 */
			if (err instanceof APIError && err.status === 429) {
				return { form, sent: true, email: form.data.email };
			}
			console.error('Password reset request failed:', err);
			return message(form, { type: 'error', text: m.srv_reset_failed() }, { status: 500 });
		}

		return { form, sent: true, email: form.data.email };
	}
};
