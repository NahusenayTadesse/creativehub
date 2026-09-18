import * as m from '$lib/paraglide/messages';
import { contentCrud } from '$lib/server/crud';
import { adminOnlyDelete, requireRole } from '$lib/server/guards';
import * as t from '$lib/server/db/schema';
import { partnerAdd, partnerEdit } from '$lib/schemas';

/*
 * Operators only, unlike the gallery: a partner logo on the homepage is a public
 * claim about who the platform works with. `requireAdminArea` already keeps
 * encoders off this page; the guard covers the actions, which it cannot.
 */
export const { load, actions } = contentCrud({
	table: t.partners,
	label: () => m.pt_label(),
	addSchema: partnerAdd,
	editSchema: partnerEdit,
	/* The logo is stored on disk and the row keeps the file name it was given. */
	fileFields: ['logo'],
	guard: (event) => requireRole(event, 'admin'),
	canDelete: adminOnlyDelete
});
