import * as m from '$lib/paraglide/messages';
import type { RequestEvent } from '@sveltejs/kit';
import { contentCrud } from '$lib/server/crud';
import { requireRole } from '$lib/server/guards';
import { uniqueSlug } from '$lib/server/slug';
import * as t from '$lib/server/db/schema';
import { blogCategoryAdd, blogCategoryEdit } from '$lib/schemas';

/** `defaults` carries the derived slug so the schema never has to accept one. */
const buildCrud = (defaults: Record<string, unknown> = {}) =>
	contentCrud({
		table: t.blogCategories,
		label: () => m.bc_label(),
		addSchema: blogCategoryAdd,
		editSchema: blogCategoryEdit,
		defaults,
		/* Actions run before any `load`, so the admin layout guard cannot cover
		   them — the write would already have happened by the time it fired. */
		guard: (event) => requireRole(event, 'admin')
	});

/** A section's slug is part of `/blog?category=…`, and follows its name. */
const slugFor = async (event: RequestEvent, ignoreId = 0) => {
	const form = await event.request.clone().formData();
	return uniqueSlug(
		t.blogCategories,
		t.blogCategories.slug,
		t.blogCategories.id,
		String(form.get('name') ?? ''),
		{ ignoreId, fallback: 'section' }
	);
};

export const load = (event: RequestEvent) => buildCrud().load(event);

export const actions = {
	add: async (event: RequestEvent) => buildCrud({ slug: await slugFor(event) }).actions.add(event),

	edit: async (event: RequestEvent) => {
		const form = await event.request.clone().formData();
		const id = Number(form.get('id') ?? 0);
		return buildCrud({ slug: await slugFor(event, id) }).actions.edit(event);
	},

	delete: (event: RequestEvent) => buildCrud().actions.delete(event)
};
