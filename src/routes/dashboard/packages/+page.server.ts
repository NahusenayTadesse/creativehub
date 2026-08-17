import { asc } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { contentCrud } from '$lib/server/crud';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { packageAdd, packageEdit } from '$lib/schemas';
import { requireCreator } from '$lib/server/guards';
import { refreshCreatorScore } from '$lib/server/score-service';

/**
 * The creator's own rate card. Scoped to their profile so a posted id can never
 * reach another creator's row, and the score is recalculated after every write
 * because package count feeds profile completeness.
 */
const crudFor = (creatorId: number) =>
	contentCrud({
		table: t.packages,
		label: 'Package',
		addSchema: packageAdd,
		editSchema: packageEdit,
		listFields: ['deliverables'],
		scope: { column: t.packages.creatorId, key: 'creatorId', value: creatorId },
		afterWrite: () => refreshCreatorScore(creatorId)
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
