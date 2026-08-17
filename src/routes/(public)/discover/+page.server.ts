import { fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { listCreators, listCampaigns } from '$lib/server/queries';
import { getOrganizationFor } from '$lib/server/guards';

export const load: PageServerLoad = async ({ locals }) => {
	const [creators, campaigns] = await Promise.all([
		listCreators(),
		listCampaigns({ publicOnly: true })
	]);

	/* A business sees which creators are already on its shortlist. */
	let savedIds: number[] = [];
	if (locals.user) {
		const organization = await getOrganizationFor(locals.user.id);
		if (organization) {
			const rows = await db
				.select({ creatorId: t.savedCreators.creatorId })
				.from(t.savedCreators)
				.where(eq(t.savedCreators.organizationId, organization.id));
			savedIds = rows.map((row) => row.creatorId);
		}
	}

	return { creators, campaigns, savedIds };
};

export const actions: Actions = {
	/** Adds or removes a creator from the acting organisation's shortlist. */
	toggleSave: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Sign in to save creators' });

		const organization = await getOrganizationFor(locals.user.id);
		if (!organization) return fail(403, { message: 'Only brand accounts keep shortlists' });

		const form = await request.formData();
		const creatorId = Number(form.get('creatorId'));
		if (!creatorId) return fail(400, { message: 'Unknown creator' });

		const existing = await db
			.select({ id: t.savedCreators.id })
			.from(t.savedCreators)
			.where(
				and(
					eq(t.savedCreators.organizationId, organization.id),
					eq(t.savedCreators.creatorId, creatorId)
				)
			)
			.limit(1);

		if (existing.length) {
			await db.delete(t.savedCreators).where(eq(t.savedCreators.id, existing[0].id));
			return { saved: false };
		}

		await db.insert(t.savedCreators).values({
			organizationId: organization.id,
			creatorId,
			createdBy: locals.user.id
		});
		return { saved: true };
	}
};
