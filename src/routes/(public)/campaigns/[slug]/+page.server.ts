import * as m from '$lib/paraglide/messages';
import { error, fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { notify } from '$lib/server/notify';
import { getCampaignBySlug } from '$lib/server/queries';
import { getCreatorFor, recordAudit } from '$lib/server/guards';
import { applicationSchema } from '$lib/schemas';
import { recalcCampaignApplications } from '$lib/server/db/rollups';
import { acceptNda, maskCampaigns } from '$lib/server/nda';
import { clientAddress } from '$lib/server/bot-defence';

export const load: PageServerLoad = async ({ params, locals }) => {
	const found = await getCampaignBySlug(params.slug);
	if (!found) error(404, m.srv_campaign_not_found());
	/* The brand's name, logo and link wait behind the NDA on a confidential
	   brief; everything a creator needs to judge it is shown regardless. */
	const [campaign] = await maskCampaigns(locals.user, [found]);

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
		creator: creator
			? { id: creator.id, fullName: creator.fullName, isPublished: creator.isPublished }
			: null,
		existingApplication,
		form
	};
};

export const actions: Actions = {
	/** A creator's one-click NDA on this brief: its brand is shown from here on. */
	acceptNda: async (event) => {
		if (!event.locals.user) redirect(303, `/login?next=${event.url.pathname}`);
		const creator = await getCreatorFor(event.locals.user.id);
		if (!creator) return fail(403, { message: m.nda_creators_only() });
		const campaign = await getCampaignBySlug(event.params.slug);
		if (!campaign) return fail(404, { message: m.srv_campaign_not_found() });
		await acceptNda({
			user: event.locals.user,
			organizationId: campaign.organizationId,
			subject: { type: 'campaign', id: campaign.id },
			ip: clientAddress(event)
		});
		return { ndaAccepted: true };
	},

	apply: async (event) => {
		if (!event.locals.user) redirect(303, `/login?next=${event.url.pathname}`);

		const creator = await getCreatorFor(event.locals.user.id);
		const form = await superValidate(event.request, zod4(applicationSchema));

		/*
		 * A published profile, which is what this refusal has always said and
		 * never checked.
		 *
		 * The brand's side of an application links straight to
		 * `/creators/<handle>`, and that page answers 404 for a profile its owner
		 * has not published — so an unpublished creator could pitch, and the only
		 * thing the brand could do with the pitch was click into a dead page.
		 * Publishing is three steps the creator has already been walked through,
		 * and it is the point at which there is something for a brand to read.
		 */
		if (!creator || !creator.isPublished) {
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

		/* A creator pitches knowing who to: on a confidential brief, the NDA first. */
		const [seen] = await maskCampaigns(event.locals.user, [
			{
				id: campaign.id,
				organizationId: campaign.organizationId,
				confidential: campaign.confidential
			}
		]);
		if (seen.brandHidden) {
			return message(form, { type: 'error', text: m.nda_required_apply() }, { status: 403 });
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

			await notify(orgRows.at(0)?.ownerId, {
				category: 'deals',
				kind: 'application',
				title: m.notif_new_application_title({ creator: creator.fullName }),
				body: campaign.title,
				link: '/dashboard/applications',
				actionLabel: m.mail_open_applications(),
				footnote: m.mail_prefs_footnote(),
				actorId: event.locals.user.id
			});

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
