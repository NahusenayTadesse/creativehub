import { contentCrud } from '$lib/server/crud';
import * as t from '$lib/server/db/schema';
import { platformAdd, platformEdit } from '$lib/schemas';

export const { load, actions } = contentCrud({
	table: t.platforms,
	label: 'Platform',
	addSchema: platformAdd,
	editSchema: platformEdit
});
