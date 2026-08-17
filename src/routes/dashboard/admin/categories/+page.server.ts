import { contentCrud } from '$lib/server/crud';
import * as t from '$lib/server/db/schema';
import { categoryAdd, categoryEdit } from '$lib/schemas';

export const { load, actions } = contentCrud({
	table: t.categories,
	label: 'Category',
	addSchema: categoryAdd,
	editSchema: categoryEdit
});
