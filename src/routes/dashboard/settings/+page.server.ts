import * as m from '$lib/paraglide/messages';
import { fail } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq, ne } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { auth } from '$lib/server/auth';
import { requireUser, recordAudit } from '$lib/server/guards';
import {
	getUserSettings,
	hasPasswordLogin,
	listAdminIds,
	listSessionsFor
} from '$lib/server/queries';
import { DEFAULT_PREFERENCES } from '$lib/domain/notify';
import {
	accountDetails,
	closureRequest,
	notificationPreferences,
	passwordChange
} from '$lib/schemas';

/**
 * Everything about the account itself, as opposed to the profile it acts
 * through. A creator edits their public page at /dashboard/profile; this is
 * where they change their password, decide what reaches them, see where they
 * are signed in, and ask to leave.
 */
export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);

	const [settings, sessions, hasPassword] = await Promise.all([
		getUserSettings(user.id),
		listSessionsFor(user.id),
		hasPasswordLogin(user.id)
	]);

	const [detailsForm, passwordForm, notifyForm, closureForm] = await Promise.all([
		superValidate({ name: user.name, phone: user.phone ?? '' }, zod4(accountDetails)),
		superValidate(zod4(passwordChange)),
		/* An absent row is not an empty form — it is the defaults, and the page
		   has to show what would actually happen rather than everything off. */
		superValidate(settings ?? DEFAULT_PREFERENCES, zod4(notificationPreferences)),
		superValidate(zod4(closureRequest))
	]);

	return {
		detailsForm,
		passwordForm,
		notifyForm,
		closureForm,
		email: user.email,
		emailVerified: user.emailVerified,
		hasPassword,
		sessions,
		currentSessionId: event.locals.session?.id ?? null,
		closureRequestedAt: settings?.closureRequestedAt ?? null
	};
};

export const actions: Actions = {
	details: async (event) => {
		const user = requireUser(event);
		const form = await superValidate(event.request, zod4(accountDetails));
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		await db
			.update(t.user)
			.set({ name: form.data.name, phone: form.data.phone || null })
			.where(eq(t.user.id, user.id));

		return message(form, { type: 'success', text: m.set_saved() });
	},

	password: async (event) => {
		const user = requireUser(event);
		const form = await superValidate(event.request, zod4(passwordChange));
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		/* An account created through Google has no password to change, and
		   better-auth would refuse in a way that reads as a server fault. */
		if (!(await hasPasswordLogin(user.id))) {
			return message(form, { type: 'error', text: m.set_pw_google_only() }, { status: 400 });
		}

		try {
			/*
			 * Through better-auth rather than a direct write: it owns the hashing
			 * parameters, and it verifies the current password as part of the same
			 * call rather than leaving that to the caller to remember.
			 */
			await auth.api.changePassword({
				body: {
					currentPassword: form.data.currentPassword,
					newPassword: form.data.newPassword,
					revokeOtherSessions: form.data.signOutOthers
				},
				headers: event.request.headers
			});
		} catch {
			/* The only failure a reader can act on is the wrong current password,
			   and saying more would help someone who is not the owner. */
			return message(form, { type: 'error', text: m.set_pw_wrong() }, { status: 400 });
		}

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'account',
			action: 'password_changed',
			reason: form.data.signOutOthers ? 'other sessions revoked' : undefined
		});

		return message(form, { type: 'success', text: m.set_pw_changed() });
	},

	notifications: async (event) => {
		const user = requireUser(event);
		const form = await superValidate(event.request, zod4(notificationPreferences));
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		await db
			.insert(t.userSettings)
			.values({ userId: user.id, ...form.data })
			.onDuplicateKeyUpdate({ set: { ...form.data } });

		return { saved: true };
	},

	revokeOthers: async (event) => {
		const user = requireUser(event);
		const current = event.locals.session?.id;
		if (!current) return fail(400, { message: m.srv_invalid_request() });

		/* Everything except the session doing the asking — signing yourself out
		   while trying to secure the account is not what anyone means by this. */
		await db.delete(t.session).where(and(eq(t.session.userId, user.id), ne(t.session.id, current)));

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'account',
			action: 'sessions_revoked'
		});

		return { revoked: true };
	},

	requestClosure: async (event) => {
		const user = requireUser(event);
		const form = await superValidate(event.request, zod4(closureRequest));
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		/* Typed back rather than a checkbox: this is the one control on the page
		   whose result somebody else has to undo. */
		if (form.data.confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
			return message(form, { type: 'error', text: m.set_close_email_mismatch() }, { status: 400 });
		}

		const existing = await getUserSettings(user.id);
		if (existing?.closureRequestedAt) {
			return message(form, { type: 'error', text: m.set_close_already() }, { status: 409 });
		}

		const requestedAt = new Date();
		await db
			.insert(t.userSettings)
			.values({
				userId: user.id,
				closureRequestedAt: requestedAt,
				closureReason: form.data.reason || null
			})
			.onDuplicateKeyUpdate({
				set: { closureRequestedAt: requestedAt, closureReason: form.data.reason || null }
			});

		/*
		 * There is no mail yet, so the request has to reach an operator through
		 * the one channel that exists. Every admin is told rather than one, since
		 * "assigned to nobody" and "assigned to whoever is away" look identical
		 * from here.
		 */
		const admins = await listAdminIds();
		if (admins.length) {
			await db.insert(t.notifications).values(
				admins.map((id) => ({
					userId: id,
					title: m.set_close_notify_title(),
					body: m.set_close_notify_body({ name: user.name, email: user.email }),
					link: '/dashboard/admin/users',
					kind: 'account'
				}))
			);
		}

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'account',
			action: 'closure_requested',
			reason: form.data.reason || undefined
		});

		return message(form, { type: 'success', text: m.set_close_sent() });
	},

	cancelClosure: async (event) => {
		const user = requireUser(event);

		await db
			.update(t.userSettings)
			.set({ closureRequestedAt: null, closureReason: null })
			.where(eq(t.userSettings.userId, user.id));

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'account',
			action: 'closure_cancelled'
		});

		return { cancelled: true };
	}
};
