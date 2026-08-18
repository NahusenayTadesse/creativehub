import * as m from '$lib/paraglide/messages';
import { error, fail } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq, sql } from 'drizzle-orm';
import type { PageServerLoad, Actions, RequestEvent } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { getBookingDetail, getSettings } from '$lib/server/queries';
import { requireBookingAccess, recordAudit } from '$lib/server/guards';
import { refreshCreatorCompletedBookings, refreshCreatorRating } from '$lib/server/score-service';
import { canTransition, splitFee, type BookingStatus } from '$lib/domain/booking';
import { maskContact } from '$lib/domain/mask';
import {
	proposalSchema,
	proposalRespond,
	fundEscrowSchema,
	submissionSchema,
	reviewSubmission,
	reviewSchema,
	messageSchema,
	bookingIdSchema
} from '$lib/schemas';

const toLines = (value: string) =>
	value
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);

export const load: PageServerLoad = async (event) => {
	const id = Number(event.params.id);
	if (!Number.isFinite(id)) error(404, m.srv_booking_not_found());

	const { side } = await requireBookingAccess(event, id);
	const detail = await getBookingDetail(id);
	if (!detail) error(404, m.srv_booking_not_found());

	const [proposalForm, submitForm, reviewForm, messageForm] = await Promise.all([
		superValidate(zod4(proposalSchema), { id: 'proposal' }),
		superValidate(zod4(submissionSchema), { id: 'submission' }),
		superValidate(zod4(reviewSchema), { id: 'review' }),
		superValidate(zod4(messageSchema), { id: 'message' })
	]);

	/* Seed the counter-offer form from whatever is currently on the table. */
	const latest = detail.proposals.at(-1);
	proposalForm.data.bookingId = id;
	proposalForm.data.price = latest?.price ?? detail.booking.price;
	proposalForm.data.currencyCode = (latest?.currencyCode ??
		detail.booking.currencyCode) as typeof proposalForm.data.currencyCode;
	proposalForm.data.deliverables = (latest?.deliverables ?? detail.booking.deliverables).join('\n');
	proposalForm.data.deadline = latest?.deadline
		? String(latest.deadline).slice(0, 10)
		: detail.booking.deadline
			? String(detail.booking.deadline).slice(0, 10)
			: '';
	proposalForm.data.revisionsAllowed = latest?.revisionsAllowed ?? detail.booking.revisionsAllowed;

	submitForm.data.bookingId = id;
	reviewForm.data.bookingId = id;
	messageForm.data.bookingId = id;

	return { ...detail, side, proposalForm, submitForm, reviewForm, messageForm };
};

/** Applies a state change only when the transition is legal, and records it. */
async function transition(
	event: RequestEvent,
	bookingId: number,
	from: BookingStatus,
	to: BookingStatus,
	extra: Record<string, unknown> = {},
	reason?: string
) {
	if (!canTransition(from, to)) {
		return { ok: false as const, text: m.srv_bad_transition({ from, to }) };
	}

	await db
		.update(t.bookings)
		.set({ status: to, updatedBy: event.locals.user?.id, ...extra })
		.where(eq(t.bookings.id, bookingId));

	await recordAudit({
		actorId: event.locals.user?.id,
		actorLabel: event.locals.user?.name,
		entity: 'booking',
		entityId: bookingId,
		action: 'status_change',
		fromState: from,
		toState: to,
		reason
	});

	return { ok: true as const };
}

async function notify(
	userId: string | null | undefined,
	title: string,
	body: string,
	link: string
) {
	if (!userId) return;
	await db.insert(t.notifications).values({ userId, title, body, link, kind: 'booking' });
}

export const actions: Actions = {
	/* ---------------- negotiation ---------------- */

	propose: async (event) => {
		const id = Number(event.params.id);
		const { booking, side } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(proposalSchema), { id: 'proposal' });

		if (side === 'admin') {
			return message(
				form,
				{ type: 'error', text: m.srv_operators_no_negotiate() },
				{ status: 403 }
			);
		}
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}
		if (!['proposed', 'negotiating'].includes(booking.status)) {
			return message(form, { type: 'error', text: m.srv_terms_already_agreed() }, { status: 409 });
		}

		/* Any earlier open offer is superseded by this counter. */
		await db
			.update(t.termProposals)
			.set({ status: 'countered' })
			.where(and(eq(t.termProposals.bookingId, id), eq(t.termProposals.status, 'pending')));

		await db.insert(t.termProposals).values({
			bookingId: id,
			proposedBy: side === 'creator' ? 'creator' : 'organization',
			price: form.data.price,
			currencyCode: form.data.currencyCode,
			deliverables: toLines(form.data.deliverables),
			deadline: form.data.deadline || null,
			revisionsAllowed: form.data.revisionsAllowed,
			note: form.data.note || null,
			status: 'pending',
			createdBy: event.locals.user?.id
		});

		if (booking.status === 'proposed') {
			await db.update(t.bookings).set({ status: 'negotiating' }).where(eq(t.bookings.id, id));
		}

		await recordAudit({
			actorId: event.locals.user?.id,
			actorLabel: event.locals.user?.name,
			entity: 'booking',
			entityId: id,
			action: 'counter_offer',
			reason: `${side} proposed ${form.data.price} ${form.data.currencyCode}`
		});

		return message(form, { type: 'success', text: m.srv_counter_sent() });
	},

	/**
	 * Accepting the open proposal is the moment terms freeze. The snapshot is
	 * written once and nothing downstream may rewrite it (PRD FR-061).
	 */
	respond: async (event) => {
		const id = Number(event.params.id);
		const { booking, side } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(proposalRespond));

		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });
		if (side === 'admin') return fail(403, { message: m.srv_operators_no_accept() });

		const rows = await db
			.select()
			.from(t.termProposals)
			.where(and(eq(t.termProposals.id, form.data.proposalId), eq(t.termProposals.bookingId, id)))
			.limit(1);
		const proposal = rows.at(0);

		if (!proposal || proposal.status !== 'pending') {
			return fail(409, { message: m.srv_proposal_closed() });
		}
		/* The side that made the offer cannot accept its own. */
		const proposedBySelf =
			(side === 'creator' && proposal.proposedBy === 'creator') ||
			(side === 'organization' && proposal.proposedBy === 'organization');
		if (proposedBySelf) {
			return fail(403, { message: m.srv_no_self_accept() });
		}

		if (form.data.decision === 'decline') {
			await db
				.update(t.termProposals)
				.set({ status: 'declined' })
				.where(eq(t.termProposals.id, proposal.id));

			const result = await transition(event, id, booking.status as BookingStatus, 'cancelled', {
				cancelReason: 'Proposal declined'
			});
			if (!result.ok) return fail(409, { message: result.text });
			return { declined: true };
		}

		const settings = await getSettings();
		const { platformFee, creatorPayout } = splitFee(
			proposal.price,
			settings?.platformFeePercent ?? 15
		);

		const creatorRows = await db
			.select({ userId: t.creators.userId, fullName: t.creators.fullName })
			.from(t.creators)
			.where(eq(t.creators.id, booking.creatorId))
			.limit(1);
		const orgRows = await db
			.select({ ownerId: t.organizations.ownerId, name: t.organizations.name })
			.from(t.organizations)
			.where(eq(t.organizations.id, booking.organizationId))
			.limit(1);

		const snapshot = {
			title: booking.title,
			deliverables: proposal.deliverables,
			price: proposal.price,
			currencyCode: proposal.currencyCode,
			platformFee,
			creatorPayout,
			compensationType: booking.compensationType,
			revisionsAllowed: proposal.revisionsAllowed,
			deadline: proposal.deadline ? String(proposal.deadline) : null,
			agreedAt: new Date().toISOString(),
			agreedByOrgUserId: orgRows.at(0)?.ownerId ?? null,
			agreedByCreatorUserId: creatorRows.at(0)?.userId ?? null
		};

		await db
			.update(t.termProposals)
			.set({ status: 'accepted' })
			.where(eq(t.termProposals.id, proposal.id));

		const result = await transition(
			event,
			id,
			booking.status as BookingStatus,
			'booked',
			{
				price: proposal.price,
				currencyCode: proposal.currencyCode,
				deliverables: proposal.deliverables,
				deadline: proposal.deadline,
				revisionsAllowed: proposal.revisionsAllowed,
				platformFee,
				creatorPayout,
				termsSnapshot: snapshot,
				termsFrozenAt: new Date()
			},
			'Both sides confirmed the same terms'
		);
		if (!result.ok) return fail(409, { message: result.text });

		await notify(
			side === 'creator' ? orgRows.at(0)?.ownerId : creatorRows.at(0)?.userId,
			m.notif_terms_agreed_title(),
			m.notif_terms_agreed_body({ title: booking.title }),
			`/dashboard/bookings/${id}`
		);

		return { accepted: true };
	},

	/* ---------------- compensation ---------------- */

	fund: async (event) => {
		const id = Number(event.params.id);
		const { booking, side } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(fundEscrowSchema));

		if (side === 'creator') return fail(403, { message: m.srv_only_brand_funds() });
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });
		/* There is no deposit to record against barter or an event pass, and
		   `settle` only requires one for a paid booking. */
		if (booking.compensationType !== 'paid') {
			return fail(400, { message: m.srv_only_paid_funded() });
		}
		if (booking.escrowStatus !== 'unfunded') {
			return fail(409, { message: m.srv_already_funded() });
		}

		/*
		 * No payment provider is connected yet, so this records an operator-marked
		 * deposit rather than moving money. The reference makes that explicit.
		 *
		 * `escrow_status` is re-tested in the WHERE clause rather than trusted from
		 * the read above: two concurrent posts both passed that check and both
		 * wrote a deposit record. Zero rows here means the other one won.
		 */
		const funded: any = await db
			.update(t.bookings)
			.set({
				escrowStatus: 'held',
				paymentMethod: form.data.paymentMethod,
				paymentRef: `MANUAL-${Date.now().toString(36).toUpperCase()}`,
				updatedBy: event.locals.user?.id
			})
			.where(and(eq(t.bookings.id, id), eq(t.bookings.escrowStatus, 'unfunded')));

		if ((funded?.rowsAffected ?? funded?.[0]?.affectedRows ?? 1) === 0) {
			return fail(409, { message: m.srv_already_funded() });
		}

		if (booking.status === 'booked') {
			await transition(event, id, 'booked', 'in_production', {}, 'Compensation recorded as held');
		}

		await recordAudit({
			actorId: event.locals.user?.id,
			actorLabel: event.locals.user?.name,
			entity: 'booking',
			entityId: id,
			action: 'compensation_held',
			toState: 'held',
			reason: `Recorded via ${form.data.paymentMethod}`
		});

		return { funded: true };
	},

	/** Marks compensation fulfilled and completes the booking. */
	settle: async (event) => {
		const id = Number(event.params.id);
		const { booking, side } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(bookingIdSchema));

		if (side === 'creator') return fail(403, { message: m.srv_only_brand_settles() });
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		/* PRD FR-083: completion requires the compensation obligation to be met. */
		if (booking.compensationType === 'paid' && booking.escrowStatus !== 'held') {
			return fail(409, {
				message: m.srv_record_deposit_first()
			});
		}

		const result = await transition(
			event,
			id,
			booking.status as BookingStatus,
			'completed',
			{ escrowStatus: 'released', completedAt: new Date() },
			'Compensation marked fulfilled'
		);
		if (!result.ok) return fail(409, { message: result.text });

		await refreshCreatorCompletedBookings(booking.creatorId);

		const creatorRows = await db
			.select({ userId: t.creators.userId })
			.from(t.creators)
			.where(eq(t.creators.id, booking.creatorId))
			.limit(1);

		await notify(
			creatorRows.at(0)?.userId,
			m.notif_booking_completed_title(),
			m.notif_booking_completed_body({ title: booking.title }),
			`/dashboard/bookings/${id}`
		);

		return { settled: true };
	},

	/* ---------------- delivery ---------------- */

	submit: async (event) => {
		const id = Number(event.params.id);
		const { booking, side } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(submissionSchema), { id: 'submission' });

		if (side !== 'creator') {
			return message(form, { type: 'error', text: m.srv_only_creator_submits() }, { status: 403 });
		}
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_paste_link() }, { status: 400 });
		}
		if (!['in_production', 'revision'].includes(booking.status)) {
			return message(
				form,
				{ type: 'error', text: m.srv_not_open_for_submission() },
				{ status: 409 }
			);
		}

		await db.insert(t.submissions).values({
			bookingId: id,
			contentUrl: form.data.contentUrl,
			notes: form.data.notes || null,
			status: 'submitted',
			createdBy: event.locals.user?.id
		});

		const result = await transition(
			event,
			id,
			booking.status as BookingStatus,
			'submitted',
			{},
			'Work submitted for review'
		);
		if (!result.ok) {
			return message(form, { type: 'error', text: result.text }, { status: 409 });
		}

		const orgRows = await db
			.select({ ownerId: t.organizations.ownerId })
			.from(t.organizations)
			.where(eq(t.organizations.id, booking.organizationId))
			.limit(1);

		await notify(
			orgRows.at(0)?.ownerId,
			m.notif_work_submitted_title(),
			booking.title,
			`/dashboard/bookings/${id}`
		);

		return message(form, { type: 'success', text: m.srv_submitted_for_review() });
	},

	review: async (event) => {
		const id = Number(event.params.id);
		const { booking, side } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(reviewSubmission));

		if (side === 'creator') return fail(403, { message: m.srv_only_brand_reviews() });
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		const rows = await db
			.select()
			.from(t.submissions)
			.where(and(eq(t.submissions.id, form.data.submissionId), eq(t.submissions.bookingId, id)))
			.limit(1);
		const submission = rows.at(0);
		if (!submission || submission.status !== 'submitted') {
			return fail(409, { message: m.srv_already_reviewed() });
		}

		if (form.data.decision === 'approve') {
			await db
				.update(t.submissions)
				.set({
					status: 'approved',
					reviewNote: form.data.reviewNote || null,
					reviewedBy: event.locals.user?.id,
					reviewedAt: new Date()
				})
				.where(eq(t.submissions.id, submission.id));

			const result = await transition(
				event,
				id,
				booking.status as BookingStatus,
				'approved',
				{},
				'Deliverables approved'
			);
			if (!result.ok) return fail(409, { message: result.text });

			/*
			 * `approved` is a transient step. Its result used to be discarded, and
			 * a booking left stranded there cannot move again: `canTransition`
			 * allows approved → awaiting_settlement only, and `settle` transitions
			 * from whatever the current status is.
			 */
			const settled = await transition(
				event,
				id,
				'approved',
				'awaiting_settlement',
				{},
				'Awaiting compensation'
			);
			if (!settled.ok) return fail(409, { message: settled.text });

			return { approved: true };
		}

		/* Revision: the reason is required and the allowance is consumed. */
		if (booking.revisionsUsed >= booking.revisionsAllowed) {
			return fail(409, {
				message: m.srv_revisions_used_up({ allowed: booking.revisionsAllowed })
			});
		}
		if (!form.data.reviewNote?.trim()) {
			return fail(400, { message: m.srv_revision_needs_reason() });
		}

		await db
			.update(t.submissions)
			.set({
				status: 'revision_requested',
				reviewNote: form.data.reviewNote,
				reviewedBy: event.locals.user?.id,
				reviewedAt: new Date()
			})
			.where(eq(t.submissions.id, submission.id));

		const result = await transition(
			event,
			id,
			booking.status as BookingStatus,
			'revision',
			/* Incremented in SQL, not from the value read earlier in this request:
			   two concurrent revision requests each computed the same successor and
			   one increment was lost, letting the allowance be exceeded. */
			{ revisionsUsed: sql`${t.bookings.revisionsUsed} + 1` },
			form.data.reviewNote
		);
		if (!result.ok) return fail(409, { message: result.text });

		const creatorRows = await db
			.select({ userId: t.creators.userId })
			.from(t.creators)
			.where(eq(t.creators.id, booking.creatorId))
			.limit(1);

		await notify(
			creatorRows.at(0)?.userId,
			m.notif_revision_requested_title(),
			form.data.reviewNote,
			`/dashboard/bookings/${id}`
		);

		return { revisionRequested: true };
	},

	/* ---------------- reviews & messages ---------------- */

	rate: async (event) => {
		const id = Number(event.params.id);
		const { booking, side } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(reviewSchema), { id: 'review' });

		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}
		/* PRD AC-11: reviews exist only for completed bookings. */
		if (booking.status !== 'completed') {
			return message(
				form,
				{ type: 'error', text: m.srv_reviews_after_complete() },
				{ status: 409 }
			);
		}
		if (side === 'admin') {
			return message(form, { type: 'error', text: m.srv_operators_no_review() }, { status: 403 });
		}

		const direction = side === 'creator' ? 'creator_to_brand' : 'brand_to_creator';

		const existing = await db
			.select({ id: t.reviews.id })
			.from(t.reviews)
			.where(and(eq(t.reviews.bookingId, id), eq(t.reviews.direction, direction)))
			.limit(1);

		if (existing.length) {
			return message(
				form,
				{ type: 'error', text: m.srv_already_reviewed_booking() },
				{ status: 409 }
			);
		}

		await db.insert(t.reviews).values({
			bookingId: id,
			creatorId: booking.creatorId,
			organizationId: booking.organizationId,
			authorId: event.locals.user?.id,
			direction,
			rating: form.data.rating,
			communication: form.data.communication,
			professionalism: form.data.professionalism,
			timeliness: form.data.timeliness,
			quality: form.data.quality,
			body: form.data.body,
			createdBy: event.locals.user?.id
		});

		if (direction === 'brand_to_creator') {
			await refreshCreatorRating(booking.creatorId);
		}

		return message(form, { type: 'success', text: m.srv_review_published() });
	},

	message: async (event) => {
		const id = Number(event.params.id);
		await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(messageSchema), { id: 'message' });

		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_write_something() }, { status: 400 });
		}

		/* Contact details are stripped before the message is stored, not after. */
		const { text, masked } = maskContact(form.data.body);

		await db.insert(t.messages).values({
			bookingId: id,
			senderId: event.locals.user!.id,
			body: text,
			isMasked: masked,
			createdBy: event.locals.user?.id
		});

		return message(
			form,
			masked
				? { type: 'warning', text: m.srv_sent_masked() }
				: { type: 'success', text: m.srv_sent() }
		);
	}
};
