import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireOrganization, recordAudit } from '$lib/server/guards';
import { organizationSelfEdit } from '$lib/schemas';
import { getReferenceData } from '$lib/server/queries';

export const load: PageServerLoad = async (event) => {
	const { organization } = await requireOrganization(event);

	const [reference, members] = await Promise.all([
		getReferenceData(),
		db
			.select({
				id: t.organizationMembers.id,
				role: t.organizationMembers.role,
				name: t.user.name,
				email: t.user.email
			})
			.from(t.organizationMembers)
			.innerJoin(t.user, eq(t.user.id, t.organizationMembers.userId))
			.where(eq(t.organizationMembers.organizationId, organization.id))
	]);

	const form = await superValidate(zod4(organizationSelfEdit));
	Object.assign(form.data, {
		id: organization.id,
		name: organization.name,
		orgType: organization.orgType,
		countryId: organization.countryId ?? undefined,
		city: organization.city ?? '',
		website: organization.website ?? '',
		bio: organization.bio ?? '',
		logo: organization.logo ?? '',
		monthlyBudgetCap: organization.monthlyBudgetCap ?? undefined
	});

	return { organization, members, reference, form };
};

export const actions: Actions = {
	default: async (event) => {
		const { user, organization } = await requireOrganization(event);
		const form = await superValidate(event.request, zod4(organizationSelfEdit));
		if (!form.valid) {
			return message(form, { type: 'error', text: 'Check the form for errors' }, { status: 400 });
		}

		await db
			.update(t.organizations)
			.set({
				name: form.data.name,
				orgType: form.data.orgType,
				countryId: form.data.countryId,
				city: form.data.city,
				website: form.data.website || null,
				bio: form.data.bio || null,
				logo: form.data.logo || null,
				monthlyBudgetCap: form.data.monthlyBudgetCap ?? null,
				updatedBy: user.id
			})
			// Scoped to the organisation this user actually acts for.
			.where(eq(t.organizations.id, organization.id));

		await recordAudit({
			actorId: user.id,
			actorLabel: form.data.name,
			entity: 'organization',
			entityId: organization.id,
			action: 'updated'
		});

		return message(form, { type: 'success', text: 'Organisation updated' });
	}
};
