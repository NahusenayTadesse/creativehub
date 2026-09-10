import * as m from '$lib/paraglide/messages';
import { redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import type { PageServerLoad, Actions } from './$types';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { recordAudit } from '$lib/server/guards';
import { inviteAccept } from '$lib/schemas';
import {
	attachInviteUser,
	claimInvite,
	clearInviteSignUp,
	findLiveInvite,
	markInviteSignUp,
	releaseInvite,
	staffRoleLabel
} from '$lib/server/invites';
import type { StaffRole } from '$lib/roles';

/**
 * The far end of a staff invitation.
 *
 * The token is the path rather than a query parameter, so the form posts back
 * to the address it was opened at and there is no hidden field to keep in step
 * with the URL. What the page can say about it is deliberately thin: a token
 * that is wrong, spent, withdrawn or a week old all produce the same "this link
 * no longer works", because telling a stranger which of the four they have
 * found is telling them something about somebody else's invitation.
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	/* Somebody already signed in cannot become a second account by opening a
	   link; the invitation is still there when they sign out. */
	if (locals.user) redirect(303, '/dashboard');

	const invite = await findLiveInvite(params.token);

	/* The form is built either way. It is the only superform on the page, and a
	   component cannot create one conditionally — the markup simply does not
	   reach it when there is no invitation to accept. */
	return {
		form: await superValidate(zod4(inviteAccept)),
		invite: invite
			? { email: invite.email, role: invite.role, roleLabel: staffRoleLabel(invite.role) }
			: null
	};
};

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod4(inviteAccept));
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		/* Re-read rather than trust the load: the invitation may have been
		   withdrawn, or accepted in another tab, while this form sat open. */
		const invite = await findLiveInvite(event.params.token);
		if (!invite) {
			return message(form, { type: 'error', text: m.iv_dead_link() }, { status: 400 });
		}

		/* Spend it before creating anything. Two submissions race here, and the
		   one whose UPDATE changes a row is the one allowed to make an account —
		   the read above cannot decide that, because both reads succeed. */
		if (!(await claimInvite(invite.id))) {
			return message(form, { type: 'error', text: m.iv_dead_link() }, { status: 400 });
		}

		let userId: string;
		try {
			/* The invitee reached this page through their own inbox, so the
			   ordinary "confirm your address" mail has nothing left to prove —
			   see the note in auth.ts. */
			markInviteSignUp(invite.email);

			const created = await auth.api.signUpEmail({
				body: {
					name: form.data.name,
					email: invite.email,
					password: form.data.password,
					/* The role is the invitation's, never the form's: this page is
					   the one place an admin account can come into existence, and
					   what it creates was decided by an operator. */
					role: invite.role as StaffRole
				},
				headers: event.request.headers
			});
			userId = created.user.id;
		} catch (err) {
			/* Nothing was created, so the invitation goes back on the shelf —
			   otherwise a mistyped password would burn a colleague's only link. */
			clearInviteSignUp(invite.email);
			await releaseInvite(invite.id);

			if (err instanceof APIError) {
				/* An account claimed the address between the invitation and this
				   submission. There is nothing to create; an operator changes the
				   role of the account that exists. */
				const text =
					err.body?.code === 'USER_ALREADY_EXISTS'
						? m.iv_error_has_account()
						: (err.body?.message ?? m.srv_account_create_failed());
				return message(form, { type: 'error', text }, { status: 400 });
			}
			console.error('Invite acceptance failed:', err);
			return message(form, { type: 'error', text: m.srv_signup_failed() }, { status: 500 });
		}

		/*
		 * Confirmed, because opening the link proved it.
		 *
		 * The token went to this address and nowhere else, and it is what got
		 * them here. That is the same evidence the confirmation mail collects,
		 * which is why the confirmation mail was skipped — and it matters beyond
		 * the nag: linking a Google identity to this account later depends on the
		 * address having been proven (see the note in auth.ts).
		 */
		await db.update(t.user).set({ emailVerified: true }).where(eq(t.user.id, userId));
		await attachInviteUser(invite.id, userId);

		await recordAudit({
			actorId: userId,
			actorLabel: form.data.name,
			entity: 'staff_invite',
			entityId: invite.id,
			action: 'accepted',
			toState: invite.role,
			reason: `${invite.email} accepted the invitation as ${invite.role}`
		});

		/* `signUpEmail` opened the session, so this lands inside the app. The
		   dashboard sends an encoder on to the reference tables. */
		redirect(303, '/dashboard');
	}
};
