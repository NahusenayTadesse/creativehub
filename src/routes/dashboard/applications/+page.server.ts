import * as m from '$lib/paraglide/messages';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db, insertedId } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { notify } from '$lib/server/notify';
import { listApplications, applicationFacet, getSettings } from '$lib/server/queries';
import { requireUser, getCreatorFor, getOrganizationFor, recordAudit } from '$lib/server/guards';
import { applicationDecision } from '$lib/schemas';
import { bookingReference, splitFee } from '$lib/domain/booking';
import { recalcCampaignApplications } from '$lib/server/db/rollups';

export const load: PageServerLoad = async ({ url, parent }) => {
	const { role, creator, organization } = await parent();

	/* Whose applications these are comes from the session, not the query string. */
	const scope = { role, creatorId: creator?.id, organizationId: organization?.id };

	const [applications, statusCounts, decisionForm] = await Promise.all([
		listApplications(url, scope),
		applicationFacet(url, 'status', scope),
		superValidate(zod4(applicationDecision))
	]);

	return { applications, statusCounts, decisionForm };
};

export const actions: Actions = {
	/**
	 * Shortlist, reject, or select. Selecting opens a booking carrying the
	 * creator's proposed rate as the first offer — it does not agree terms,
	 * which still needs both sides to accept (PRD FR-054).
	 */
	decide: async (event) => {
		const user = requireUser(event);
		const form = await superValidate(event.request, zod4(applicationDecision));
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		const rows = await db
			.select({
				application: t.applications,
				campaign: t.campaigns,
				creator: t.creators,
				organization: t.organizations
			})
			.from(t.applications)
			.innerJoin(t.campaigns, eq(t.campaigns.id, t.applications.campaignId))
			.innerJoin(t.creators, eq(t.creators.id, t.applications.creatorId))
			.innerJoin(t.organizations, eq(t.organizations.id, t.campaigns.organizationId))
			.where(eq(t.applications.id, form.data.id))
			.limit(1);

		const row = rows.at(0);
		if (!row) return fail(404, { message: m.srv_application_not_found() });

		/* Only the owning organisation, or an operator, may decide. */
		const isOperator = (user as { role?: string }).role === 'admin';
		if (!isOperator) {
			const organization = await getOrganizationFor(user.id);
			if (!organization || organization.id !== row.organization.id) {
				return fail(403, { message: m.srv_not_yours_to_decide() });
			}
		}

		if (row.application.status === 'selected') {
			return fail(409, { message: m.srv_already_selected() });
		}

		await db
			.update(t.applications)
			.set({
				status: form.data.status,
				decisionNote: form.data.decisionNote || null,
				updatedBy: user.id
			})
			.where(eq(t.applications.id, row.application.id));

		await recordAudit({
			actorId: user.id,
			actorLabel: row.organization.name,
			entity: 'application',
			entityId: row.application.id,
			action: 'decision',
			fromState: row.application.status,
			toState: form.data.status,
			reason: form.data.decisionNote || undefined
		});

		if (form.data.status !== 'selected') {
			await notify(row.creator.userId, {
				category: 'deals',
				kind: 'application',
				title:
					form.data.status === 'shortlisted'
						? m.notif_shortlisted_title({ campaign: row.campaign.title })
						: m.notif_not_taken_forward_title({ campaign: row.campaign.title }),
				body: form.data.decisionNote || '',
				link: '/dashboard/applications',
				actionLabel: m.mail_open_applications(),
				footnote: m.mail_prefs_footnote(),
				actorId: user.id
			});
			return { decided: form.data.status };
		}

		/* Selection opens a booking in negotiation, with the pitch price as offer one. */
		const existing = await db
			.select({ id: t.bookings.id })
			.from(t.bookings)
			.where(eq(t.bookings.applicationId, row.application.id))
			.limit(1);

		if (existing.length) redirect(303, `/dashboard/bookings/${existing[0].id}`);

		const settings = await getSettings();
		const price = row.campaign.compensationType === 'paid' ? row.application.proposedPrice : 0;
		const { platformFee, creatorPayout } = splitFee(price, settings?.platformFeePercent ?? 15);

		const result = await db.insert(t.bookings).values({
			reference: bookingReference(),
			campaignId: row.campaign.id,
			applicationId: row.application.id,
			creatorId: row.creator.id,
			organizationId: row.organization.id,
			title: m.booking_title_campaign_creator({
				campaign: row.campaign.title,
				creator: row.creator.fullName
			}),
			deliverables: row.campaign.deliverables,
			compensationType: row.campaign.compensationType,
			price,
			currencyCode: row.application.currencyCode,
			platformFee,
			creatorPayout,
			status: 'proposed',
			escrowStatus: 'unfunded',
			deadline: row.campaign.deadline,
			revisionsAllowed: 2,
			createdBy: user.id
		});

		const bookingId = insertedId(result);

		await db.insert(t.termProposals).values({
			bookingId,
			proposedBy: 'organization',
			price,
			currencyCode: row.application.currencyCode,
			deliverables: row.campaign.deliverables,
			deadline: row.campaign.deadline,
			revisionsAllowed: 2,
			note: form.data.decisionNote || `Selected from your application to ${row.campaign.title}.`,
			status: 'pending',
			createdBy: user.id
		});

		await notify(row.creator.userId, {
			category: 'deals',
			kind: 'booking',
			title: m.notif_selected_title({ campaign: row.campaign.title }),
			body: m.notif_selected_body(),
			link: `/dashboard/bookings/${bookingId}`,
			actionLabel: m.mail_open_booking(),
			footnote: m.mail_prefs_footnote(),
			actorId: user.id
		});

		await recordAudit({
			actorId: user.id,
			actorLabel: row.organization.name,
			entity: 'booking',
			entityId: bookingId,
			action: 'created',
			toState: 'proposed',
			reason: `Selected application #${row.application.id}`
		});

		redirect(303, `/dashboard/bookings/${bookingId}`);
	},

	/** A creator may pull an application back before a decision is made. */
	withdraw: async (event) => {
		const user = requireUser(event);
		const creator = await getCreatorFor(user.id);
		if (!creator) return fail(403, { message: m.srv_creators_only() });

		const form = await event.request.formData();
		const id = Number(form.get('id'));

		const rows = await db
			.select()
			.from(t.applications)
			.where(and(eq(t.applications.id, id), eq(t.applications.creatorId, creator.id)))
			.limit(1);

		if (!rows.length) return fail(404, { message: m.srv_application_not_found() });
		if (rows[0].status === 'selected') {
			return fail(409, { message: m.srv_already_selected_use_booking() });
		}

		await db
			.update(t.applications)
			.set({ status: 'withdrawn', updatedBy: user.id })
			.where(eq(t.applications.id, id));

		/* The campaign's public tally must come down again. */
		await recalcCampaignApplications(db, rows[0].campaignId);

		await recordAudit({
			actorId: user.id,
			actorLabel: creator.fullName,
			entity: 'application',
			entityId: id,
			action: 'withdrawn',
			fromState: rows[0].status,
			toState: 'withdrawn'
		});

		return { withdrawn: true };
	}
};
