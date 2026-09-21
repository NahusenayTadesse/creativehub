import * as m from '$lib/paraglide/messages';
import { error, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { APIError } from 'better-auth/api';
import type { PageServerLoad, Actions } from './$types';
import { eq } from 'drizzle-orm';
import { auth, googleEnabled } from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { registerSchema } from '$lib/schemas';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) redirect(303, '/dashboard');

	const requested = url.searchParams.get('role');
	const form = await superValidate(zod4(registerSchema));
	if (requested === 'business' || requested === 'creator') form.data.role = requested;

	return { form, google: googleEnabled };
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
				/*
				 * An address that is already registered is the one failure with a
				 * way forward, so it is tagged rather than just worded: the page
				 * answers it with the two doors out — sign in, or sign in and
				 * claim the profile that was imported before the creator arrived
				 * — instead of a toast that tells them to work it out themselves.
				 *
				 * Nothing is disclosed by saying so. /register already refuses a
				 * taken address, and this only changes what the refusal offers.
				 *
				 * Both codes are named because better-auth uses two: sign-up
				 * raises USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL, while the admin
				 * plugin's own create-user route raises the bare
				 * USER_ALREADY_EXISTS. Matching only the short one — as this did
				 * — let better-auth's untranslated English fall through to the
				 * reader, which is how an Amharic sign-up came back in English.
				 */
				if (
					err.body?.code === 'USER_ALREADY_EXISTS' ||
					err.body?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
				) {
					return message(
						form,
						{ type: 'error', code: 'email_in_use', text: m.srv_email_in_use() },
						{ status: 400 }
					);
				}
				const text = err.body?.message ?? m.srv_account_create_failed();
				return message(form, { type: 'error', text }, { status: 400 });
			}
			console.error('Sign-up failed:', err);
			return message(form, { type: 'error', text: m.srv_signup_failed() }, { status: 500 });
		}

		/* New accounts land on the step that finishes their profile. */
		redirect(303, firstStep(form.data.role));
	},

	/**
	 * Signing up through Google, as the side of the market the page has
	 * selected.
	 *
	 * The role goes into the OAuth state and is stamped on the account as
	 * better-auth creates it — see `signupRole` in `$lib/server/auth`. Anything
	 * but `business` is a creator, the same default the password form has.
	 *
	 * An address that already has an account is simply signed in, keeping the
	 * role it has, and lands on the dashboard like any other returning user.
	 * One whose password account was never confirmed is refused by Google
	 * linking, and /login explains that, which is why failures go there.
	 *
	 * `redirect()` throws, so it sits outside the `try`, as on /login.
	 */
	google: async (event) => {
		if (!googleEnabled) error(503, m.srv_google_unavailable());

		const data = await event.request.formData();
		const role = data.get('role') === 'business' ? 'business' : 'creator';
		let url: string | undefined;

		try {
			const result = await auth.api.signInSocial({
				body: {
					provider: 'google',
					callbackURL: '/dashboard',
					newUserCallbackURL: firstStep(role),
					errorCallbackURL: '/login',
					additionalData: { signupRole: role }
				},
				headers: event.request.headers
			});
			url = result.url;
		} catch (err) {
			console.error('Google sign-up failed to start:', err);
			redirect(303, '/login?error=start_failed');
		}

		if (!url) redirect(303, '/login?error=start_failed');
		redirect(303, url);
	}
};

/** Where a new account finishes setting itself up. */
function firstStep(role: 'creator' | 'business') {
	return role === 'business' ? '/dashboard/organization/create' : '/dashboard/profile/create';
}
