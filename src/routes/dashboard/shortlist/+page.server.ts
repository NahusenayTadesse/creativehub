import * as m from '$lib/paraglide/messages';
import { fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireOrganization } from '$lib/server/guards';
import { savedCreatorsQuery } from '$lib/server/queries';

export const load: PageServerLoad = async (event) => {
	const { organization } = await requireOrganization(event);

	const saved = await savedCreatorsQuery.run(event.url, {
		where: [eq(t.savedCreators.organizationId, organization.id)]
	});

	return { saved };
};

export const actions: Actions = {
	remove: async (event) => {
		const { organization } = await requireOrganization(event);
		const form = await event.request.formData();
		const creatorId = Number(form.get('creatorId'));
		if (!creatorId) return fail(400, { message: m.srv_unknown_creator() });

		await db
			.delete(t.savedCreators)
			.where(
				and(
					eq(t.savedCreators.organizationId, organization.id),
					eq(t.savedCreators.creatorId, creatorId)
				)
			);

		return { removed: true };
	}
};
