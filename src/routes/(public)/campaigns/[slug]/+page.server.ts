import * as m from '$lib/paraglide/messages';
import { error, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { getCampaignBySlug } from '$lib/server/queries';
import { getCreatorFor, recordAudit } from '$lib/server/guards';
import { applicationSchema } from '$lib/schemas';
import { recalcCampaignApplications } from '$lib/server/db/rollups';

export const load: PageServerLoad = async ({ params, locals }) => {
	const campaign = await getCampaignBySlug(params.slug);
	if (!campaign) error(404, m.srv_campaign_not_found());

	const isOperator = (locals.user as { role?: string })?.role === 'admin';
	if (campaign.status !== 'published' && !isOperator) {
		error(404, m.srv_campaign_closed());
	}

	const creator = locals.user ? await getCreatorFor(locals.user.id) : undefined;

	let existingApplication = null;
	if (creator) {
		const rows = await db
			.select()
			.from(t.applications)
			.where(
				and(eq(t.applications.campaignId, campaign.id), eq(t.applications.creatorId, creator.id))
			)
			.limit(1);
		existingApplication = rows.at(0) ?? null;
	}

	const form = await superValidate(zod4(applicationSchema));
	form.data.campaignId = campaign.id;
	form.data.proposedPrice = campaign.budgetMin || 0;
	form.data.currencyCode = campaign.currencyCode as typeof form.data.currencyCode;

	return {
		campaign,
		creator: creator ? { id: creator.id, fullName: creator.fullName } : null,
		existingApplication,
		form
	};
};

export const actions: Actions = {
	apply: async (event) => {
		if (!event.locals.user) redirect(303, `/login?next=${event.url.pathname}`);

		const creator = await getCreatorFor(event.locals.user.id);
		const form = await superValidate(event.request, zod4(applicationSchema));

		if (!creator) {
			return message(
				form,
				{ type: 'error', text: m.srv_need_published_profile() },
				{ status: 403 }
			);
		}
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		const campaignRows = await db
			.select()
			.from(t.campaigns)
			.where(eq(t.campaigns.id, form.data.campaignId))
			.limit(1);
		const campaign = campaignRows.at(0);

		if (!campaign || campaign.status !== 'published') {
			return message(
				form,
				{ type: 'error', text: m.srv_campaign_no_applications() },
				{ status: 400 }
			);
		}

		/* One active application per creator per campaign (PRD INV-005). */
		const existing = await db
			.select({ id: t.applications.id })
			.from(t.applications)
			.where(
				and(eq(t.applications.campaignId, campaign.id), eq(t.applications.creatorId, creator.id))
			)
			.limit(1);

		if (existing.length) {
			return message(form, { type: 'error', text: m.srv_already_applied() }, { status: 409 });
		}

		try {
			await db.insert(t.applications).values({
				campaignId: campaign.id,
				creatorId: creator.id,
				pitch: form.data.pitch,
				proposedPrice: form.data.proposedPrice,
				currencyCode: form.data.currencyCode,
				status: 'applied',
				createdBy: event.locals.user.id
			});

			/* Recount rather than increment, so a later withdrawal can bring it down. */
			await recalcCampaignApplications(db, campaign.id);

			const orgRows = await db
				.select({ ownerId: t.organizations.ownerId, name: t.organizations.name })
				.from(t.organizations)
				.where(eq(t.organizations.id, campaign.organizationId))
				.limit(1);

			if (orgRows.length) {
				await db.insert(t.notifications).values({
					userId: orgRows[0].ownerId,
					title: m.notif_new_application_title({ creator: creator.fullName }),
					body: campaign.title,
					link: `/dashboard/applications`,
					kind: 'application',
					createdBy: event.locals.user.id
				});
			}

			await recordAudit({
				actorId: event.locals.user.id,
				actorLabel: creator.fullName,
				entity: 'application',
				action: 'created',
				toState: 'applied',
				reason: `Applied to ${campaign.title}`
			});

			return message(form, { type: 'success', text: m.srv_pitch_sent() });
		} catch (err) {
			console.error('Application failed:', err);
			return message(form, { type: 'error', text: m.srv_application_failed() }, { status: 500 });
		}
	}
};
