import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { listApplications, getSettings } from '$lib/server/queries';
import { requireUser, getCreatorFor, getOrganizationFor, recordAudit } from '$lib/server/guards';
import { applicationDecision } from '$lib/schemas';
import { bookingReference, splitFee } from '$lib/domain/booking';

export const load: PageServerLoad = async ({ parent }) => {
	const { role, creator, organization } = await parent();

	const applications = await listApplications(
		role === 'admin'
			? {}
			: creator
				? { creatorId: creator.id }
				: organization
					? { organizationId: organization.id }
					: { creatorId: -1 }
	);

	return { applications, decisionForm: await superValidate(zod4(applicationDecision)) };
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
		if (!form.valid) return fail(400, { message: 'Invalid request' });

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
		if (!row) return fail(404, { message: 'Application not found' });

		/* Only the owning organisation, or an operator, may decide. */
		const isOperator = (user as { role?: string }).role === 'admin';
		if (!isOperator) {
			const organization = await getOrganizationFor(user.id);
			if (!organization || organization.id !== row.organization.id) {
				return fail(403, { message: 'That application is not yours to decide.' });
			}
		}

		if (row.application.status === 'selected') {
			return fail(409, { message: 'This applicant has already been selected.' });
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
			if (row.creator.userId) {
				await db.insert(t.notifications).values({
					userId: row.creator.userId,
					title:
						form.data.status === 'shortlisted'
							? `You were shortlisted for ${row.campaign.title}`
							: `Your application for ${row.campaign.title} was not taken forward`,
					body: form.data.decisionNote || '',
					link: '/dashboard/applications',
					kind: 'application'
				});
			}
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
		const price =
			row.campaign.compensationType === 'paid' ? row.application.proposedPrice : 0;
		const { platformFee, creatorPayout } = splitFee(price, settings?.platformFeePercent ?? 15);

		const result: any = await db.insert(t.bookings).values({
			reference: bookingReference(),
			campaignId: row.campaign.id,
			applicationId: row.application.id,
			creatorId: row.creator.id,
			organizationId: row.organization.id,
			title: `${row.campaign.title} — ${row.creator.fullName}`,
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

		const bookingId = Number(result.insertId ?? result[0]?.insertId);

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

		if (row.creator.userId) {
			await db.insert(t.notifications).values({
				userId: row.creator.userId,
				title: `You were selected for ${row.campaign.title}`,
				body: 'Review the proposed terms and accept or counter.',
				link: `/dashboard/bookings/${bookingId}`,
				kind: 'booking'
			});
		}

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
		if (!creator) return fail(403, { message: 'Creator accounts only' });

		const form = await event.request.formData();
		const id = Number(form.get('id'));

		const rows = await db
			.select()
			.from(t.applications)
			.where(and(eq(t.applications.id, id), eq(t.applications.creatorId, creator.id)))
			.limit(1);

		if (!rows.length) return fail(404, { message: 'Application not found' });
		if (rows[0].status === 'selected') {
			return fail(409, { message: 'You have already been selected — use the booking instead.' });
		}

		await db
			.update(t.applications)
			.set({ status: 'withdrawn', updatedBy: user.id })
			.where(eq(t.applications.id, id));

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
