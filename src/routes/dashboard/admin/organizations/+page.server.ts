import * as m from '$lib/paraglide/messages';
import { contentCrud } from '$lib/server/crud';
import { requireRole } from '$lib/server/guards';
import * as t from '$lib/server/db/schema';
import { organizationAdd, organizationEdit } from '$lib/schemas';
import { getReferenceData } from '$lib/server/queries';
import type { RequestEvent } from '@sveltejs/kit';

const crud = contentCrud({
	table: t.organizations,
	label: () => m.ao_label(),
	addSchema: organizationAdd,
	editSchema: organizationEdit,
	excludeDeleted: true,
	/* Actions run before any `load`, so the admin layout guard cannot cover them. */
	guard: (event) => requireRole(event, 'admin')
});

export const load = async (event: RequestEvent) => {
	const [base, reference] = await Promise.all([crud.load(event), getReferenceData()]);
	return { ...base, reference };
};

export const actions = crud.actions;
