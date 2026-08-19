import * as m from '$lib/paraglide/messages';
import { contentCrud } from '$lib/server/crud';
import { requireRole } from '$lib/server/guards';
import * as t from '$lib/server/db/schema';
import { gallerySlideAdd, gallerySlideEdit } from '$lib/schemas';

export const { load, actions } = contentCrud({
	table: t.gallerySlides,
	label: () => m.gal_label(),
	addSchema: gallerySlideAdd,
	editSchema: gallerySlideEdit,
	/* An upload is stored on disk and the row keeps the file name it was given. */
	fileFields: ['image'],
	/* Actions run before any `load`, so the admin layout guard cannot cover them. */
	guard: (event) => requireRole(event, 'admin')
});
