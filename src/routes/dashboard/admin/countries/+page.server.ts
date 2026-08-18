import * as m from '$lib/paraglide/messages';
import { contentCrud } from '$lib/server/crud';
import { requireRole } from '$lib/server/guards';
import * as t from '$lib/server/db/schema';
import { countryAdd, countryEdit } from '$lib/schemas';

export const { load, actions } = contentCrud({
	table: t.countries,
	label: () => m.co_label(),
	addSchema: countryAdd,
	editSchema: countryEdit,
	listFields: ['paymentRails'],
	/* Actions run before any `load`, so the admin layout guard cannot cover them. */
	guard: (event) => requireRole(event, 'admin')
});
