import * as m from '$lib/paraglide/messages';
import { contentCrud } from '$lib/server/crud';
import { referenceDataGuard, adminOnlyDelete } from '$lib/server/guards';
import * as t from '$lib/server/db/schema';
import { languageAdd, languageEdit } from '$lib/schemas';

export const { load, actions } = contentCrud({
	table: t.languages,
	label: () => m.la_label(),
	addSchema: languageAdd,
	editSchema: languageEdit,
	/* Actions run before any `load`, so the admin layout guard cannot cover them. */
	guard: referenceDataGuard,
	/* An encoder writes here; only an operator removes a row. */
	canDelete: adminOnlyDelete
});
