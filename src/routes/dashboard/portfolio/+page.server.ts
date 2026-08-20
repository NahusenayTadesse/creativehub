import * as m from '$lib/paraglide/messages';
import { asc } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { contentCrud } from '$lib/server/crud';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { portfolioAdd, portfolioEdit } from '$lib/schemas';
import { requireCreator } from '$lib/server/guards';
import { refreshCreatorScore } from '$lib/server/score-service';

const crudFor = (creatorId: number) =>
	contentCrud({
		table: t.portfolioItems,
		label: () => m.po_label(),
		addSchema: portfolioAdd,
		editSchema: portfolioEdit,
		scope: { column: t.portfolioItems.creatorId, key: 'creatorId', value: creatorId },
		afterWrite: () => refreshCreatorScore(creatorId)
	});

export const load = async (event: RequestEvent) => {
	const { creator } = await requireCreator(event);
	const [base, platforms] = await Promise.all([
		crudFor(creator.id).load(event),
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
