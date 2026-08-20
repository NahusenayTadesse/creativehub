import * as m from '$lib/paraglide/messages';
import { asc } from 'drizzle-orm';
import { contentCrud } from '$lib/server/crud';
import { requireRole } from '$lib/server/guards';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { regionAdd, regionEdit } from '$lib/schemas';
import type { RequestEvent } from '@sveltejs/kit';

const crud = contentCrud({
	table: t.regions,
	label: () => m.re_label(),
	addSchema: regionAdd,
	editSchema: regionEdit,
	listFields: ['majorCities'],
	/* Actions run before any `load`, so the admin layout guard cannot cover them. */
	guard: (event) => requireRole(event, 'admin')
});

/** Regions need their country list so the form can offer a dropdown. */
export const load = async (event: RequestEvent) => {
	const [base, countries] = await Promise.all([
		crud.load(event),
		db.select().from(t.countries).orderBy(asc(t.countries.sortOrder))
	]);
	return { ...base, countries };
};

export const actions = crud.actions;
