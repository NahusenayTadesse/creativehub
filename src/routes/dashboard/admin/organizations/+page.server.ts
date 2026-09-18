import * as m from '$lib/paraglide/messages';
import { contentCrud } from '$lib/server/crud';
import { adminOnlyDelete, referenceDataGuard } from '$lib/server/guards';
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
	guard: referenceDataGuard,
	/* As on the creator listing: an encoder enters a brand, an operator is the
	   one who takes an existing one away from everything pointing at it. */
	canDelete: adminOnlyDelete
});

export const load = async (event: RequestEvent) => {
	const [base, reference] = await Promise.all([crud.load(event), getReferenceData()]);
	return { ...base, reference };
};

export const actions = crud.actions;
