import * as m from '$lib/paraglide/messages';
import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireRole, recordAudit } from '$lib/server/guards';
import { userRoleUpdate } from '$lib/schemas';
import { usersQuery } from '$lib/server/queries';

export const load: PageServerLoad = async ({ url }) => {
	const [users, roleCounts, form] = await Promise.all([
		usersQuery.run(url),
		usersQuery.facet(url, 'role'),
		superValidate(zod4(userRoleUpdate))
	]);

	return { users, roleCounts, form };
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
	}
};
