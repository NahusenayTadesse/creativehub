import { contentCrud } from '$lib/server/crud';
import * as t from '$lib/server/db/schema';
import { organizationAdd, organizationEdit } from '$lib/schemas';
import { getReferenceData } from '$lib/server/queries';

const crud = contentCrud({
	table: t.organizations,
	label: 'Organisation',
	addSchema: organizationAdd,
	editSchema: organizationEdit,
	excludeDeleted: true
});

export const load = async () => {
	const [base, reference] = await Promise.all([crud.load(), getReferenceData()]);
	return { ...base, reference };
};

export const actions = crud.actions;
