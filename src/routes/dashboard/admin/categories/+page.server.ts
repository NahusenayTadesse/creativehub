import * as m from '$lib/paraglide/messages';
import { contentCrud } from '$lib/server/crud';
import { requireRole } from '$lib/server/guards';
import * as t from '$lib/server/db/schema';
import { categoryAdd, categoryEdit } from '$lib/schemas';

export const { load, actions } = contentCrud({
	table: t.categories,
	label: () => m.ca_label(),
	addSchema: categoryAdd,
	editSchema: categoryEdit,
	/* Actions run before any `load`, so the admin layout guard cannot cover them. */
	guard: (event) => requireRole(event, 'admin')
});
