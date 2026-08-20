import * as m from '$lib/paraglide/messages';
import { contentCrud } from '$lib/server/crud';
import { requireRole } from '$lib/server/guards';
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
	label: () => m.ac_label(),
	addSchema: creatorAdd,
	editSchema: creatorEdit,
	listFields: ['topCountries'],
	excludeDeleted: true,
	/* Actions run before any `load`, so the admin layout guard cannot cover them. */
	guard: (event) => requireRole(event, 'admin')
});

export const load = async (event: RequestEvent) => {
	const [base, reference] = await Promise.all([crud.load(event), getReferenceData()]);
	return { ...base, reference };
};

export const actions = crud.actions;
