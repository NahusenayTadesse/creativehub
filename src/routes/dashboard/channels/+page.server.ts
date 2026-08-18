import * as m from '$lib/paraglide/messages';
import { asc } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { contentCrud } from '$lib/server/crud';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { socialAdd, socialEdit } from '$lib/schemas';
import { requireCreator } from '$lib/server/guards';
import { refreshCreatorReach } from '$lib/server/score-service';

/** Linked social accounts. Total reach is recomputed from them after each write. */
const crudFor = (creatorId: number) =>
	contentCrud({
		table: t.socialAccounts,
		label: () => m.ch_label(),
		addSchema: socialAdd,
		editSchema: socialEdit,
		scope: { column: t.socialAccounts.creatorId, key: 'creatorId', value: creatorId },
		afterWrite: () => refreshCreatorReach(creatorId)
	});

export const load = async (event: RequestEvent) => {
	const { creator } = await requireCreator(event);
	const [base, platforms] = await Promise.all([
		crudFor(creator.id).load(),
		db.select().from(t.platforms).orderBy(asc(t.platforms.sortOrder))
	]);
	return { ...base, platforms };
};

export const actions = {
	add: async (event: RequestEvent) => {
		const { creator } = await requireCreator(event);
		return crudFor(creator.id).actions.add(event);
	},
	edit: async (event: RequestEvent) => {
		const { creator } = await requireCreator(event);
		return crudFor(creator.id).actions.edit(event);
	},
	delete: async (event: RequestEvent) => {
		const { creator } = await requireCreator(event);
		return crudFor(creator.id).actions.delete(event);
	}
};
