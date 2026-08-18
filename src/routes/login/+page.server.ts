import * as m from '$lib/paraglide/messages';
import { redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { APIError } from 'better-auth/api';
import type { PageServerLoad, Actions } from './$types';
import { auth } from '$lib/server/auth';
import { loginSchema } from '$lib/schemas';
import { safeNext } from '$lib/server/guards';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
	return { form: await superValidate(zod4(loginSchema)) };
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
	}
};
