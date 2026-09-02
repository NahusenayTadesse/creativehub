import * as m from '$lib/paraglide/messages';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db, insertedId } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { notify } from '$lib/server/notify';
import { recordAudit } from '$lib/server/guards';
import * as refunds from '$lib/server/refunds';
import {
	disputeResolutionLabel,
	resolutionAmounts,
	resolutionOutcome,
	splitIsValid,
	type DisputeResolution,
	type PartySide
} from '$lib/domain/dispute';

/**
 * Arguments about deals, and what an operator's decision does to the money.
 *
 * The rules about *when* a case may be raised and *what* each side gets live in
 * `domain/dispute.ts`, with no database and no network. This is the half that
 * reads rows, writes outcomes and asks `server/refunds.ts` to move anything —
 * the same division as `payments`/`payouts` and their domain modules.
 *
 * A resolution touches three things that must agree: the booking's status, its
 * escrow, and its two money columns. They are written together here so no other
 * caller can set one without the others.
 */

type Booking = typeof t.bookings.$inferSelect;
type Dispute = typeof t.disputes.$inferSelect;

/** The open case on a booking, if there is one. There is only ever one. */
export async function openFor(bookingId: number): Promise<Dispute | null> {
	const rows = await db
		.select()
		.from(t.disputes)
		.where(and(eq(t.disputes.bookingId, bookingId), eq(t.disputes.status, 'open')))
		.limit(1);
	return rows.at(0) ?? null;
}

/** Every case on a booking, newest first. */
export const listForBooking = (bookingId: number) =>
	db
		.select()
		.from(t.disputes)
		.where(eq(t.disputes.bookingId, bookingId))
		.orderBy(desc(t.disputes.createdAt));

/**
 * Whether the creator has already been paid for this booking.
 *
 * Only reachable through the post-completion window, and it changes who bears
 * the outcome rather than what is possible: a refund draws on the merchant
 * balance, so the brand can still be paid back, but nothing in the product can
 * recover it from the creator. The operator deciding the case is told.
 */
export async function creatorAlreadyPaid(bookingId: number): Promise<boolean> {
	const rows = await db
		.select({ id: t.payouts.id })
		.from(t.payouts)
		.where(and(eq(t.payouts.bookingId, bookingId), eq(t.payouts.status, 'success')))
		.limit(1);
	return rows.length > 0;
}

/* ------------------------------------------------------------------ *
 * Raising, answering, withdrawing
 * ------------------------------------------------------------------ */

/**
 * Opens a case and freezes the deal.
 *
 * The booking moves to `disputed`, which is what actually stops things: the
 * payout queue pays only against `released` escrow and the delivery actions
 * only accept live statuses, so a disputed booking is inert everywhere without
 * any of those places needing to know disputes exist.
 */
export async function raise(
	booking: Booking,
	input: {
		side: PartySide;
		reason: string;
		evidenceUrl?: string | null;
		actor: { id: string; name?: string | null };
	}
): Promise<number> {
	const afterPayout = await creatorAlreadyPaid(booking.id);

	const inserted = await db.insert(t.disputes).values({
		bookingId: booking.id,
		raisedBy: input.actor.id,
		raisedBySide: input.side,
		reason: input.reason,
		evidenceUrl: input.evidenceUrl || null,
		status: 'open',
		afterPayout,
		createdBy: input.actor.id
	});

	const disputeId = insertedId(inserted);

	/*
	 * `completedAt` is deliberately left alone.
	 *
	 * A post-completion dispute has to remember when the deal finished — the
	 * window is measured from it, and clearing it would both reopen the window
	 * forever and lose the date the case is about.
	 */
	await db
		.update(t.bookings)
		.set({ status: 'disputed', updatedBy: input.actor.id })
		.where(eq(t.bookings.id, booking.id));

	await recordAudit({
		actorId: input.actor.id,
		actorLabel: input.actor.name ?? undefined,
		entity: 'booking',
		entityId: booking.id,
		action: 'dispute_raised',
		fromState: booking.status,
		toState: 'disputed',
		reason: input.reason.slice(0, 300)
	});

	await tellBoth(booking, {
		kind: 'dispute',
		title: m.notif_dispute_raised_title(),
		body: m.notif_dispute_raised_body({ title: booking.title })
	});

	return disputeId;
}

/** The other side's one written answer. */
export async function respond(
	dispute: Dispute,
	input: { text: string; evidenceUrl?: string | null; actor: { id: string; name?: string | null } }
): Promise<void> {
	await db
		.update(t.disputes)
		.set({
			respondedBy: input.actor.id,
			responseText: input.text,
			responseEvidenceUrl: input.evidenceUrl || null,
			respondedAt: new Date(),
			updatedBy: input.actor.id
		})
		.where(eq(t.disputes.id, dispute.id));

	await recordAudit({
		actorId: input.actor.id,
		actorLabel: input.actor.name ?? undefined,
		entity: 'booking',
		entityId: dispute.bookingId,
		action: 'dispute_answered',
		reason: input.text.slice(0, 300)
	});
}

/**
 * The side that raised a case backing down.
 *
 * The booking goes back to where it was rather than forward: withdrawing is
 * saying the argument was a misunderstanding, and a deal that resumes mid-
 * delivery should resume where delivery had got to. `previousStatus` is passed
 * in by the caller, which read it before the freeze.
 */
export async function withdraw(
	dispute: Dispute,
	previousStatus: string,
	actor: { id: string; name?: string | null }
): Promise<void> {
	await db
		.update(t.disputes)
		.set({ status: 'withdrawn', resolvedAt: new Date(), updatedBy: actor.id })
		.where(and(eq(t.disputes.id, dispute.id), eq(t.disputes.status, 'open')));

	await db
		.update(t.bookings)
		.set({ status: previousStatus as Booking['status'], updatedBy: actor.id })
		.where(and(eq(t.bookings.id, dispute.bookingId), eq(t.bookings.status, 'disputed')));

	await recordAudit({
		actorId: actor.id,
		actorLabel: actor.name ?? undefined,
		entity: 'booking',
		entityId: dispute.bookingId,
		action: 'dispute_withdrawn',
		fromState: 'disputed',
		toState: previousStatus
	});
}

/* ------------------------------------------------------------------ *
 * Deciding one
 * ------------------------------------------------------------------ */

export type ResolveOutcome =
	{ ok: true; refundQueued: boolean; refundError?: string } | { ok: false; error: string };

/**
 * An operator's decision, applied to the case and to the money.
 *
 * The order matters. The booking and the case are written first and the refund
 * is asked for second, because a decision that was recorded but whose refund
 * failed is recoverable — an operator sees a failed refund on a resolved case
 * and retries it — while a refund that went out against a case the database
 * never closed is money moved with no reason attached to it.
 *
 * So a failed refund does not fail the resolution. It is reported alongside it.
 */
export async function resolve(
	booking: Booking,
	dispute: Dispute,
	input: {
		resolution: DisputeResolution;
		refundInput: number;
		note: string;
		feePercent: number;
		actor: { id: string; name?: string | null };
	}
): Promise<ResolveOutcome> {
	if (input.resolution === 'split' && !splitIsValid(booking.price, input.refundInput)) {
		return { ok: false, error: m.srv_dispute_bad_split() };
	}

	const amounts = resolutionAmounts(
		booking.price,
		input.feePercent,
		input.resolution,
		input.refundInput
	);
	const outcome = resolutionOutcome(input.resolution);

	/*
	 * Escrow follows the decision only where the decision is final on its own.
	 *
	 * `released` is permission for the payout queue and takes effect now. A
	 * refund is not: the money has not gone back until Chapa says so, and
	 * `refunds.reconcile` is what writes `refunded`. Marking it here would show
	 * the brand as repaid the instant an operator pressed a button.
	 */
	const escrowStatus = outcome.escrowStatus === 'released' ? 'released' : booking.escrowStatus;

	await db
		.update(t.bookings)
		.set({
			status: outcome.status,
			escrowStatus,
			platformFee: amounts.platformFee,
			creatorPayout: amounts.payout,
			completedAt: outcome.status === 'completed' ? (booking.completedAt ?? new Date()) : null,
			cancelReason: outcome.status === 'cancelled' ? input.note || 'Dispute resolved' : null,
			updatedBy: input.actor.id
		})
		.where(eq(t.bookings.id, booking.id));

	await db
		.update(t.disputes)
		.set({
			status: 'resolved',
			resolution: input.resolution,
			refundAmount: amounts.refund,
			payoutAmount: amounts.payout,
			resolutionNote: input.note || null,
			resolvedBy: input.actor.id,
			resolvedAt: new Date(),
			updatedBy: input.actor.id
		})
		.where(and(eq(t.disputes.id, dispute.id), eq(t.disputes.status, 'open')));

	await recordAudit({
		actorId: input.actor.id,
		actorLabel: input.actor.name ?? undefined,
		entity: 'booking',
		entityId: booking.id,
		action: 'dispute_resolved',
		fromState: 'disputed',
		toState: outcome.status,
		reason:
			`${input.resolution}: brand ${amounts.refund}, fee ${amounts.platformFee}, creator ${amounts.payout}${input.note ? ` — ${input.note}` : ''}`.slice(
				0,
				300
			)
	});

	let refundQueued = false;
	let refundError: string | undefined;

	if (amounts.refund > 0) {
		const sent = await refunds.send(booking, {
			amount: amounts.refund,
			reason: `Dispute ${dispute.id} resolved`,
			disputeId: dispute.id,
			actor: input.actor
		});
		refundQueued = sent.ok;
		if (!sent.ok) {
			refundError =
				sent.code === 'nothing_to_refund'
					? m.srv_refund_nothing_to_refund()
					: m.srv_refund_failed();
		}
	}

	await tellBoth(booking, {
		kind: 'dispute',
		title: m.notif_dispute_resolved_title(),
		body: m.notif_dispute_resolved_body({
			title: booking.title,
			resolution: disputeResolutionLabel(input.resolution)
		})
	});

	return { ok: true, refundQueued, refundError };
}

/* ------------------------------------------------------------------ *
 * Telling people
 * ------------------------------------------------------------------ */

/**
 * Both sides of a deal, either of which may be absent.
 *
 * An unclaimed creator profile has no account, and `notify` drops a null id by
 * itself — which is why this does not check.
 */
export async function partiesOf(booking: Booking) {
	const [orgRows, creatorRows] = await Promise.all([
		db
			.select({ ownerId: t.organizations.ownerId })
			.from(t.organizations)
			.where(eq(t.organizations.id, booking.organizationId))
			.limit(1),
		db
			.select({ userId: t.creators.userId })
			.from(t.creators)
			.where(eq(t.creators.id, booking.creatorId))
			.limit(1)
	]);
	return [orgRows.at(0)?.ownerId, creatorRows.at(0)?.userId];
}

async function tellBoth(booking: Booking, event: { kind: string; title: string; body: string }) {
	await notify(await partiesOf(booking), {
		category: 'deals',
		kind: event.kind,
		title: event.title,
		body: event.body,
		link: `/dashboard/bookings/${booking.id}`,
		actionLabel: m.mail_open_dispute(),
		footnote: m.mail_prefs_footnote()
	});
}

/**
 * Cases for the operator queue.
 *
 * Open ones oldest first, because the queue is a debt and the person who has
 * waited longest should not be at the bottom of it; the history newest first,
 * because that one is read to answer "what happened to X".
 */
export const listCases = (openOnly: boolean, limit = 100) =>
	db
		.select({
			id: t.disputes.id,
			bookingId: t.disputes.bookingId,
			raisedBySide: t.disputes.raisedBySide,
			reason: t.disputes.reason,
			evidenceUrl: t.disputes.evidenceUrl,
			responseText: t.disputes.responseText,
			responseEvidenceUrl: t.disputes.responseEvidenceUrl,
			respondedAt: t.disputes.respondedAt,
			status: t.disputes.status,
			resolution: t.disputes.resolution,
			refundAmount: t.disputes.refundAmount,
			payoutAmount: t.disputes.payoutAmount,
			resolutionNote: t.disputes.resolutionNote,
			resolvedAt: t.disputes.resolvedAt,
			afterPayout: t.disputes.afterPayout,
			createdAt: t.disputes.createdAt,
			bookingReference: t.bookings.reference,
			bookingTitle: t.bookings.title,
			bookingStatus: t.bookings.status,
			escrowStatus: t.bookings.escrowStatus,
			price: t.bookings.price,
			currencyCode: t.bookings.currencyCode,
			creatorName: t.creators.fullName,
			organizationName: t.organizations.name
		})
		.from(t.disputes)
		.leftJoin(t.bookings, eq(t.bookings.id, t.disputes.bookingId))
		.leftJoin(t.creators, eq(t.creators.id, t.bookings.creatorId))
		.leftJoin(t.organizations, eq(t.organizations.id, t.bookings.organizationId))
		.where(openOnly ? eq(t.disputes.status, 'open') : undefined)
		.orderBy(openOnly ? asc(t.disputes.createdAt) : desc(t.disputes.createdAt))
		.limit(limit);

export type DisputeRow = Awaited<ReturnType<typeof listCases>>[number];
