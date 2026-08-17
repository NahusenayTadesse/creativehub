import { redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { APIError } from 'better-auth/api';
import type { PageServerLoad, Actions } from './$types';
import { auth } from '$lib/server/auth';
import { registerSchema } from '$lib/schemas';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) redirect(303, '/dashboard');

	const requested = url.searchParams.get('role');
	const form = await superValidate(zod4(registerSchema));
	if (requested === 'business' || requested === 'creator') form.data.role = requested;

	return { form };
};

export const actions: Actions = {
	register: async (event) => {
		const form = await superValidate(event.request, zod4(registerSchema));
		if (!form.valid) {
			return message(form, { type: 'error', text: 'Check the form for errors' }, { status: 400 });
		}

		try {
			await auth.api.signUpEmail({
				body: {
					name: form.data.name,
					email: form.data.email,
					password: form.data.password,
					// The schema only permits creator or business; admin is assigned by an
					// existing operator, never claimed at sign-up (PRD FR-004).
					role: form.data.role
				},
				headers: event.request.headers
			});
		} catch (err) {
			if (err instanceof APIError) {
				const text =
					err.body?.code === 'USER_ALREADY_EXISTS'
						? 'An account already uses that email. Sign in instead.'
						: (err.body?.message ?? 'Could not create the account.');
				return message(form, { type: 'error', text }, { status: 400 });
			}
			console.error('Sign-up failed:', err);
			return message(
				form,
				{ type: 'error', text: 'Something went wrong creating your account.' },
				{ status: 500 }
			);
		}

		/* New accounts land on the step that finishes their profile. */
		redirect(
			303,
			form.data.role === 'business' ? '/dashboard/organization/create' : '/dashboard/profile/create'
		);
	}
};
