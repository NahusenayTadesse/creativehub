import { contentCrud } from '$lib/server/crud';
import * as t from '$lib/server/db/schema';
import { creatorAdd, creatorEdit } from '$lib/schemas';
import { getReferenceData } from '$lib/server/queries';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Operator view of creator supply. Imported profiles arrive unpublished, so
 * this is also where a bulk import gets released to discovery.
 */
const crud = contentCrud({
	table: t.creators,
	label: 'Creator',
	addSchema: creatorAdd,
	editSchema: creatorEdit,
	listFields: ['topCountries'],
	excludeDeleted: true
});

export const load = async () => {
	const [base, reference] = await Promise.all([crud.load(), getReferenceData()]);
	return { ...base, reference };
};

export const actions = crud.actions;
