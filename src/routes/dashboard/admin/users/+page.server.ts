import * as m from '$lib/paraglide/messages';
import { fail } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireRole, recordAudit } from '$lib/server/guards';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { BAN_DURATION_SECONDS } from '$lib/bans';
import { staffInvite, staffInviteRevoke, userBan, userRoleUpdate, userUnban } from '$lib/schemas';
import { usersQuery } from '$lib/server/queries';
import {
	createInvite,
	listLiveInvites,
	normaliseEmail,
	revokeInvite,
	sendInviteMail,
	staffRoleLabel
} from '$lib/server/invites';

export const load: PageServerLoad = async ({ url }) => {
	const [users, roleCounts, form, inviteForm, invites] = await Promise.all([
		usersQuery.run(url),
		usersQuery.facet(url, 'role'),
		superValidate(zod4(userRoleUpdate)),
		superValidate(zod4(staffInvite), { id: 'invite' }),
		listLiveInvites()
	]);

	return { users, roleCounts, form, inviteForm, invites };
};

export const actions: Actions = {
	setRole: async (event) => {
		const operator = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(userRoleUpdate));
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		/* An operator cannot demote themselves and lock everyone out. */
		if (form.data.userId === operator.id && form.data.role !== 'admin') {
			return fail(400, { message: m.srv_cannot_remove_own_access() });
		}

		const rows = await db.select().from(t.user).where(eq(t.user.id, form.data.userId)).limit(1);
		const target = rows.at(0);
		if (!target) return fail(404, { message: m.srv_user_not_found() });

		await db.update(t.user).set({ role: form.data.role }).where(eq(t.user.id, target.id));

		await recordAudit({
			actorId: operator.id,
			actorLabel: operator.name,
			entity: 'user',
			action: 'role_change',
			fromState: target.role ?? 'creator',
			toState: form.data.role,
			reason: `Changed role for ${target.email}`
		});

		return { updated: true };
	},

	/**
	 * Offers somebody an operator or data-encoder account.
	 *
	 * Nothing is created here but a pending row and a link: the name, the
	 * password and therefore the account itself come from the person who opens
	 * the mail. Re-inviting an address that already has a live invitation
	 * replaces it — see `createInvite` — which is what "resend" means here.
	 */
	invite: async (event) => {
		const operator = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(staffInvite), { id: 'invite' });
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		const email = normaliseEmail(form.data.email);

		/* An address that already has an account is a role change, not an
		   invitation — the table below is where that is done, and an invite
		   whose link could never produce an account would be a link that fails
		   a week from now in somebody else's inbox. */
		const existing = await db.select().from(t.user).where(eq(t.user.email, email)).limit(1);
		if (existing.length) {
			return message(form, { type: 'error', text: m.si_error_has_account() }, { status: 400 });
		}

		const { token } = await createInvite({ email, role: form.data.role, invitedBy: operator.id });

		const sent = await sendInviteMail({
			email,
			role: form.data.role,
			token,
			invitedByName: operator.name
		});

		await recordAudit({
			actorId: operator.id,
			actorLabel: operator.name,
			entity: 'staff_invite',
			action: 'invited',
			toState: form.data.role,
			reason: `Invited ${email} as ${form.data.role}`
		});

		/* The row stands either way — the invitation was issued, and an operator
		   can withdraw it. What changes is what the page says: a link nobody
		   received is worth knowing about immediately. */
		return message(
			form,
			sent
				? { type: 'success', text: m.si_sent({ email }) }
				: { type: 'error', text: m.si_mail_failed({ email }) }
		);
	},

	/**
	 * Bars an account.
	 *
	 * The work is better-auth's: `banUser` writes the three ban columns and
	 * then deletes every session the account has, which is what turns "cannot
	 * sign in again" into "is signed out now". Refusing the next sign-in is the
	 * plugin's too — it hooks session creation — so nothing on this side has to
	 * remember to check a flag.
	 *
	 * `headers` carries the operator's own session, because the endpoint checks
	 * the caller's permission itself. `requireRole` above is not redundant: it
	 * is what makes a non-operator reaching this action get the same 403 page as
	 * everywhere else, rather than an APIError translated into a toast.
	 */
	ban: async (event) => {
		const operator = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(userBan));
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		/* better-auth refuses this too. Doing it here as well is what gets the
		   operator a sentence in their own language instead of an error code. */
		if (form.data.userId === operator.id) {
			return fail(400, { message: m.au_ban_self() });
		}

		const rows = await db.select().from(t.user).where(eq(t.user.id, form.data.userId)).limit(1);
		const target = rows.at(0);
		if (!target) return fail(404, { message: m.srv_user_not_found() });

		/* A ban laid over a ban would inherit the old expiry: `banUser` leaves
		   `banExpires` alone when it is given no `banExpiresIn`, so making a
		   week-long ban permanent would leave it ending on the original date.
		   Lifting the old one first means every ban starts from nothing. */
		if (target.banned) {
			await auth.api.unbanUser({
				body: { userId: target.id },
				headers: event.request.headers
			});
		}

		const seconds = BAN_DURATION_SECONDS[form.data.duration];
		const reason = form.data.reason?.trim() || undefined;

		try {
			await auth.api.banUser({
				body: {
					userId: target.id,
					...(reason ? { banReason: reason } : {}),
					...(seconds ? { banExpiresIn: seconds } : {})
				},
				headers: event.request.headers
			});
		} catch (err) {
			if (err instanceof APIError) {
				console.error('Ban refused by better-auth:', err.body?.code);
				return fail(400, { message: m.au_ban_failed() });
			}
			throw err;
		}

		await recordAudit({
			actorId: operator.id,
			actorLabel: operator.name,
			entity: 'user',
			action: 'banned',
			fromState: 'active',
			toState: form.data.duration,
			reason: `Banned ${target.email}${reason ? `: ${reason}` : ''}`
		});

		return { banned: true };
	},

	/** Lifts one. The account can sign in again from the next request; the
	    sessions it had before the ban are gone for good. */
	unban: async (event) => {
		const operator = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(userUnban));
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		const rows = await db.select().from(t.user).where(eq(t.user.id, form.data.userId)).limit(1);
		const target = rows.at(0);
		if (!target) return fail(404, { message: m.srv_user_not_found() });

		try {
			await auth.api.unbanUser({
				body: { userId: target.id },
				headers: event.request.headers
			});
		} catch (err) {
			if (err instanceof APIError) {
				console.error('Unban refused by better-auth:', err.body?.code);
				return fail(400, { message: m.au_ban_failed() });
			}
			throw err;
		}

		await recordAudit({
			actorId: operator.id,
			actorLabel: operator.name,
			entity: 'user',
			action: 'unbanned',
			fromState: target.banReason ?? 'banned',
			toState: 'active',
			reason: `Lifted the ban on ${target.email}`
		});

		return { unbanned: true };
	},

	/** Withdraws a pending invitation. The link stops working at once. */
	revokeInvite: async (event) => {
		const operator = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(staffInviteRevoke));
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		const invite = await revokeInvite(form.data.inviteId);
		if (!invite) return fail(404, { message: m.si_error_gone() });

		await recordAudit({
			actorId: operator.id,
			actorLabel: operator.name,
			entity: 'staff_invite',
			entityId: invite.id,
			action: 'revoked',
			fromState: invite.role,
			reason: `Withdrew the invitation to ${invite.email} (${staffRoleLabel(invite.role)})`
		});

		return { revoked: true };
	}
};
