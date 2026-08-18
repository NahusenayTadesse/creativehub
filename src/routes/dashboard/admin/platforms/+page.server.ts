import * as m from '$lib/paraglide/messages';
import { contentCrud } from '$lib/server/crud';
import { requireRole } from '$lib/server/guards';
import * as t from '$lib/server/db/schema';
import { platformAdd, platformEdit } from '$lib/schemas';

export const { load, actions } = contentCrud({
	table: t.platforms,
	label: () => m.pl_label(),
	addSchema: platformAdd,
	editSchema: platformEdit,
	/* Actions run before any `load`, so the admin layout guard cannot cover them. */
	guard: (event) => requireRole(event, 'admin')
});
