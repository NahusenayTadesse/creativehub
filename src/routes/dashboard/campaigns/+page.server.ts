import { asc, eq, ne, and } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { contentCrud } from '$lib/server/crud';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { campaignAdd, campaignEdit } from '$lib/schemas';
import { requireRole, getOrganizationFor, recordAudit } from '$lib/server/guards';
import { getReferenceData } from '$lib/server/queries';

/** "Telebirr SuperApp 5G Launch" → "telebirr-superapp-5g-launch". */
const slugify = (value: string) =>
	value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 240) || 'campaign';

/** Finds a free slug, ignoring the row being edited. */
async function uniqueSlug(title: string, ignoreId = 0) {
	const base = slugify(title);
	let candidate = base;
	let suffix = 1;

	while (true) {
		const clash = await db
			.select({ id: t.campaigns.id })
			.from(t.campaigns)
			.where(ignoreId ? and(eq(t.campaigns.slug, candidate), ne(t.campaigns.id, ignoreId)) : eq(t.campaigns.slug, candidate))
			.limit(1);
		if (!clash.length) return candidate;
		candidate = `${base}-${++suffix}`;
	}
}

/**
 * Campaigns belong to an organisation. Admins manage every campaign; a brand
 * only ever sees and edits its own — enforced by the crud scope rather than by
 * anything the client sends.
 */
async function context(event: RequestEvent) {
	const user = requireRole(event, 'business', 'admin');
	const isOperator = (user as { role?: string }).role === 'admin';

	if (isOperator) return { user, isOperator, organization: null };

	const organization = await getOrganizationFor(user.id);
	if (!organization) redirect(303, '/dashboard/organization/create');

	return { user, isOperator, organization };
}

/** `defaults` carries the derived slug so the schema never has to accept one. */
function buildCrud(organizationId: number | null, defaults: Record<string, unknown> = {}) {
	return contentCrud({
		table: t.campaigns,
		label: 'Campaign',
		addSchema: campaignAdd,
		editSchema: campaignEdit,
		listFields: ['deliverables', 'tags', 'targetRegions'],
		excludeDeleted: true,
		defaults,
		...(organizationId
			? {
					scope: {
						column: t.campaigns.organizationId,
						key: 'organizationId',
						value: organizationId
					}
				}
			: {})
	});
}

export const load = async (event: RequestEvent) => {
	const { organization } = await context(event);
	const crud = buildCrud(organization?.id ?? null);

	const [base, reference, applications] = await Promise.all([
		crud.load(),
		getReferenceData(),
		db
			.select({ campaignId: t.applications.campaignId, status: t.applications.status })
			.from(t.applications)
	]);

	return {
		...base,
		reference,
		applications,
		organizationName: organization?.name ?? 'All organisations'
	};
};

export const actions = {
	add: async (event: RequestEvent) => {
		const { user, organization } = await context(event);
		const form = await event.request.clone().formData();
		const slug = await uniqueSlug(String(form.get('title') ?? ''));

		const result = await buildCrud(organization?.id ?? null, { slug }).actions.add(event);

		await recordAudit({
			actorId: user.id,
			actorLabel: organization?.name ?? 'Operator',
			entity: 'campaign',
			action: 'created',
			toState: String(form.get('status') ?? 'draft'),
			reason: String(form.get('title') ?? '')
		});

		return result;
	},

	edit: async (event: RequestEvent) => {
		const { user, organization } = await context(event);
		const form = await event.request.clone().formData();
		const id = Number(form.get('id') ?? 0);
		const slug = await uniqueSlug(String(form.get('title') ?? ''), id);

		const result = await buildCrud(organization?.id ?? null, { slug }).actions.edit(event);

		await recordAudit({
			actorId: user.id,
			actorLabel: organization?.name ?? 'Operator',
			entity: 'campaign',
			entityId: id,
			action: 'updated',
			toState: String(form.get('status') ?? '')
		});

		return result;
	},

	delete: async (event: RequestEvent) => {
		const { organization } = await context(event);
		return buildCrud(organization?.id ?? null).actions.delete(event);
	}
};
