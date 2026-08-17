import { contentCrud } from '$lib/server/crud';
import * as t from '$lib/server/db/schema';
import { languageAdd, languageEdit } from '$lib/schemas';

export const { load, actions } = contentCrud({
	table: t.languages,
	label: 'Language',
	addSchema: languageAdd,
	editSchema: languageEdit
});
