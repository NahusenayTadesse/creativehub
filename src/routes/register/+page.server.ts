import * as m from '$lib/paraglide/messages';
import { redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { APIError } from 'better-auth/api';
import type { PageServerLoad, Actions } from './$types';
import { eq } from 'drizzle-orm';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
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
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		try {
			const { user } = await auth.api.signUpEmail({
				body: {
					name: form.data.name,
					email: form.data.email,
					password: form.data.password,
					/* Where the confirmation link lands. Without this better-auth
					   sends them to `/`, which verifies the address and then says
					   nothing about having done so. */
					callbackURL: '/verify-email'
				},
				headers: event.request.headers
			});

			/*
			 * The role is stamped here rather than posted with the sign-up.
			 *
			 * better-auth's admin plugin declares `role` on the user table as
			 * `input: false` — and plugin fields are merged over
			 * `user.additionalFields`, so the `input: true` in auth.ts never
			 * applied. A body carrying `role` was refused outright with "role is
			 * not allowed to be set", which failed every sign-up, brand and
			 * creator alike.
			 *
			 * Leaving the field closed is also the safer half: `input: true`
			 * would open it on `/api/auth/update-user` too, where any signed-in
			 * account could post itself `admin`. The account is created with the
			 * plugin's `defaultRole` and corrected the moment after, from a value
			 * `registerSchema` has already narrowed to creator or business —
			 * admin is assigned by an existing operator, never claimed at
			 * sign-up (PRD FR-004).
			 *
			 * There is no session cookie cache configured, so the next request
			 * reads this row and sees the role the form asked for.
			 */
			await db.update(t.user).set({ role: form.data.role }).where(eq(t.user.id, user.id));
		} catch (err) {
			if (err instanceof APIError) {
				const text =
					err.body?.code === 'USER_ALREADY_EXISTS'
						? m.srv_email_in_use()
						: (err.body?.message ?? m.srv_account_create_failed());
				return message(form, { type: 'error', text }, { status: 400 });
			}
			console.error('Sign-up failed:', err);
			return message(form, { type: 'error', text: m.srv_signup_failed() }, { status: 500 });
		}

		/* New accounts land on the step that finishes their profile. */
		redirect(
			303,
			form.data.role === 'business' ? '/dashboard/organization/create' : '/dashboard/profile/create'
		);
	}
};
