import * as m from '$lib/paraglide/messages';
import { contentCrud } from '$lib/server/crud';
import { referenceDataGuard, adminOnlyDelete } from '$lib/server/guards';
import * as t from '$lib/server/db/schema';
import { heroSlideAdd, heroSlideEdit } from '$lib/schemas';

/*
 * The photographs beside the hero headline. Kept like the gallery — an encoder
 * may add and arrange them, only an operator removes one — because they are
 * pictures, not claims: nothing here names a partner or a price.
 */
export const { load, actions } = contentCrud({
	table: t.heroSlides,
	label: () => m.hs_label(),
	addSchema: heroSlideAdd,
	editSchema: heroSlideEdit,
	fileFields: ['image'],
	searchFields: ['alt'],
	guard: referenceDataGuard,
	canDelete: adminOnlyDelete
});
