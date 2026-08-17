import { contentCrud } from '$lib/server/crud';
import * as t from '$lib/server/db/schema';
import { countryAdd, countryEdit } from '$lib/schemas';

export const { load, actions } = contentCrud({
	table: t.countries,
	label: 'Country',
	addSchema: countryAdd,
	editSchema: countryEdit,
	listFields: ['paymentRails']
});
