import * as m from '$lib/paraglide/messages';
import { redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db, insertedId } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { organizationCreate } from '$lib/schemas';
import { requireRole, getOrganizationFor, recordAudit } from '$lib/server/guards';
import { getReferenceData } from '$lib/server/queries';

/** Turns "Goh Hotels & Resorts" into "goh-hotels-resorts". */
const slugify = (value: string) =>
	value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 190);

export const load: PageServerLoad = async (event) => {
	const user = requireRole(event, 'business', 'admin');
	const existing = await getOrganizationFor(user.id);
	if (existing) redirect(303, '/dashboard/organization');

	return {
		form: await superValidate(zod4(organizationCreate)),
		reference: await getReferenceData()
	};
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireRole(event, 'business', 'admin');
		const form = await superValidate(event.request, zod4(organizationCreate));
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		/* A `load` never runs before an action, so the redirect above cannot stop
		   a double-submit from opening a second organisation. */
		const already = await getOrganizationFor(user.id);
		if (already) redirect(303, '/dashboard/organization');

		/* Slugs must be unique; append a counter rather than rejecting the name. */
		let slug = slugify(form.data.name);
		let suffix = 1;
		while (
			(
				await db
					.select({ id: t.organizations.id })
					.from(t.organizations)
					.where(eq(t.organizations.slug, slug))
					.limit(1)
			).length
		) {
			slug = `${slugify(form.data.name)}-${++suffix}`;
		}

		let organizationId: number;
		try {
			const result = await db.insert(t.organizations).values({
				ownerId: user.id,
				name: form.data.name,
				slug,
				orgType: form.data.orgType,
				website: form.data.website || null,
				bio: form.data.bio || null,
				countryId: form.data.countryId,
				city: form.data.city,
				createdBy: user.id
			});
			organizationId = insertedId(result);

			await db.insert(t.organizationMembers).values({
				organizationId,
				userId: user.id,
				role: 'owner',
				createdBy: user.id
			});
		} catch (err) {
			console.error('Organisation creation failed:', err);
			return message(form, { type: 'error', text: m.srv_org_create_failed() }, { status: 500 });
		}

		await recordAudit({
			actorId: user.id,
			actorLabel: form.data.name,
			entity: 'organization',
			entityId: organizationId,
			action: 'created'
		});

		redirect(303, '/dashboard/campaigns');
	}
};
