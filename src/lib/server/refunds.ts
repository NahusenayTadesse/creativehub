import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, insertedId, rowsAffected } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import * as chapa from '$lib/server/chapa';
import { recordAudit } from '$lib/server/guards';
import { LIVE_PAYOUT_STATUSES } from '$lib/domain/payout';

/**
 * Money going back to the brand.
 *
 * The third of the three money modules, and the same shape as the other two:
 * `chapa.ts` moves it, this decides when it may move and records what happened,
 * and nothing but a verification concludes that it did.
 *
 * What is different is the handle. A deposit and a payout are both asked about
 * using the reference we chose; a refund is asked about using the `ref_id`
 * Chapa returns, which means the window between sending the request and
 * storing that id is the one moment a refund can become unaskable. The row is
 * written first and updated with the id the instant it arrives, and that
 * ordering is the whole reason this file is not three lines long.
 */

/** A reference for one attempt: `CN-2608-K4F2WQ7A-RF-LZ4F9K2P`. */
export function refundReference(bookingReference: string): string {
	const bytes = crypto.getRandomValues(new Uint8Array(8));
	const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
	const random = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
	return `${bookingReference}-RF-${random}`;
}

type Booking = typeof t.bookings.$inferSelect;

/**
 * The settled deposit a refund would reverse, or null if there is none.
 *
 * The newest successful payment, because a booking can collect several attempts
 * and only one of them is money that actually arrived. A booking funded by the
 * operator's manual path has a `MANUAL-` reference and no Chapa transaction
 * behind it, so it is deliberately excluded: asking Chapa to reverse a payment
 * it never took answers "no such transaction", and the honest handling is for
 * the caller to see there is nothing to reverse and say so.
 */
export async function refundableDeposit(bookingId: number) {
	const rows = await db
		.select()
		.from(t.payments)
		.where(
			and(
				eq(t.payments.bookingId, bookingId),
				eq(t.payments.status, 'success'),
				eq(t.payments.provider, 'chapa')
			)
		)
		.orderBy(desc(t.payments.verifiedAt), desc(t.payments.id))
		.limit(1);
	return rows.at(0) ?? null;
}

/** How many refund attempts on this booking are unresolved or already done. */
export async function liveAttemptCount(bookingId: number): Promise<number> {
	const rows = await db
		.select({ id: t.refunds.id })
		.from(t.refunds)
		.where(
			and(eq(t.refunds.bookingId, bookingId), inArray(t.refunds.status, LIVE_PAYOUT_STATUSES))
		);
	return rows.length;
}

export type SendRefundOutcome =
	| { ok: true; refundId: number; reference: string }
	| { ok: false; error: string; code?: 'nothing_to_refund' | 'already' };

/**
 * Sends one refund against a booking's settled deposit.
 *
 * `amount` is what goes back; omitting it refunds the whole payment. A partial
 * refund is what a split resolution needs, and it is passed through rather than
 * computed here — `domain/dispute.ts` decides the arithmetic.
 */
export async function send(
	booking: Booking,
	options: {
		amount?: number;
		reason?: string;
		disputeId?: number | null;
		actor: { id: string; name?: string | null };
	}
): Promise<SendRefundOutcome> {
	if ((await liveAttemptCount(booking.id)) > 0) {
		return { ok: false, error: 'A refund is already in flight.', code: 'already' };
	}

	const payment = await refundableDeposit(booking.id);
	if (!payment) return { ok: false, error: 'No settled deposit.', code: 'nothing_to_refund' };

	/* Never more than actually arrived: a split's arithmetic is done against the
	   booking's price, and a price edited after payment could otherwise ask
	   Chapa to return more than it took. */
	const amount = Math.min(Math.round(options.amount ?? payment.amount), payment.amount);
	const reference = refundReference(booking.reference);

	const inserted = await db.insert(t.refunds).values({
		bookingId: booking.id,
		paymentId: payment.id,
		txRef: payment.txRef,
		disputeId: options.disputeId ?? null,
		reference,
		provider: 'chapa',
		status: 'pending',
		amount,
		currencyCode: payment.currencyCode,
		reason: options.reason?.slice(0, 300) ?? null,
		createdBy: options.actor.id
	});

	const refundId = insertedId(inserted);

	const result = await chapa.refund({
		txRef: payment.txRef,
		/* Omitted when it is the whole payment: Chapa reads an absent amount as
		   "all of it", which cannot disagree with its own rounding. */
		amount: amount < payment.amount ? amount : undefined,
		reason: options.reason,
		reference
	});

	if (!result.ok) {
		await db
			.update(t.refunds)
			.set({
				status: 'failed',
				failureReason: result.error.slice(0, 300),
				updatedBy: options.actor.id
			})
			.where(and(eq(t.refunds.id, refundId), eq(t.refunds.status, 'pending')));

		await recordAudit({
			actorId: options.actor.id,
			actorLabel: options.actor.name ?? undefined,
			entity: 'booking',
			entityId: booking.id,
			action: 'refund_refused',
			reason: `${reference}: ${result.error}`.slice(0, 300)
		});

		return { ok: false, error: result.error };
	}

	await db
		.update(t.refunds)
		.set({ status: 'queued', providerRef: result.refId, updatedBy: options.actor.id })
		.where(and(eq(t.refunds.id, refundId), eq(t.refunds.status, 'pending')));

	await recordAudit({
		actorId: options.actor.id,
		actorLabel: options.actor.name ?? undefined,
		entity: 'booking',
		entityId: booking.id,
		action: 'refund_queued',
		toState: 'queued',
		reason: `${amount} ${payment.currencyCode} against ${payment.txRef} (${reference})`
	});

	return { ok: true, refundId, reference };
}

export type ReconcileRefundOutcome =
	| { state: 'refunded'; refundId: number; bookingId: number }
	| { state: 'already'; refundId: number; bookingId: number }
	| { state: 'pending'; refundId: number; bookingId: number }
	| { state: 'failed'; refundId: number; bookingId: number; reason: string }
	| { state: 'not_found'; reason: string }
	| { state: 'unreachable'; reason: string };

/**
 * Asks Chapa what became of one refund, and applies it.
 *
 * Safe to call twice, from the webhook and from an operator, in either order —
 * the `status = 'queued'` predicate is what makes the second call say `already`.
 *
 * A refund with no `providerRef` is the one case that cannot be resolved: Chapa
 * verifies by its own id, and if the response carrying it was lost then the
 * money may or may not have moved and the app cannot find out. It is reported
 * rather than guessed at, because guessing in either direction is worse.
 */
export async function reconcile(refundId: number): Promise<ReconcileRefundOutcome> {
	const rows = await db.select().from(t.refunds).where(eq(t.refunds.id, refundId)).limit(1);
	const row = rows.at(0);
	if (!row) return { state: 'not_found', reason: 'No such refund.' };

	if (row.status === 'success') {
		return { state: 'already', refundId: row.id, bookingId: row.bookingId };
	}
	if (!row.providerRef) {
		return { state: 'unreachable', reason: 'Chapa returned no reference for this refund.' };
	}

	const verified = await chapa.verifyRefund(row.providerRef);
	if (!verified.ok) return { state: 'unreachable', reason: verified.error };

	const outcome = chapa.refundOutcome(verified.refund.status);

	if (outcome === 'pending') {
		return { state: 'pending', refundId: row.id, bookingId: row.bookingId };
	}

	if (outcome === 'failed') {
		const reason = verified.refund.failureReason ?? `Chapa reported ${verified.refund.status}`;
		await db
			.update(t.refunds)
			.set({
				status: 'failed',
				failureReason: reason.slice(0, 300),
				mode: verified.refund.mode,
				verifiedAt: new Date()
			})
			.where(and(eq(t.refunds.id, row.id), eq(t.refunds.status, 'queued')));

		await recordAudit({
			entity: 'booking',
			entityId: row.bookingId,
			action: 'refund_failed',
			toState: 'failed',
			reason: `${row.reference}: ${reason}`.slice(0, 300)
		});

		return { state: 'failed', refundId: row.id, bookingId: row.bookingId, reason };
	}

	const claimed = await db
		.update(t.refunds)
		.set({ status: 'success', mode: verified.refund.mode, verifiedAt: new Date() })
		.where(and(eq(t.refunds.id, row.id), eq(t.refunds.status, 'queued')));

	if (rowsAffected(claimed) === 0) {
		return { state: 'already', refundId: row.id, bookingId: row.bookingId };
	}

	/*
	 * The booking's escrow is marked refunded only for a whole-deposit return.
	 *
	 * A split refunds part and pays the rest, and its escrow is `released` so
	 * the creator's share can still reach the payout queue — overwriting that
	 * here would strand the money the operator just decided they were owed.
	 */
	if (row.amount >= (await depositAmount(row.bookingId))) {
		await db
			.update(t.bookings)
			.set({ escrowStatus: 'refunded' })
			.where(eq(t.bookings.id, row.bookingId));
	}

	await recordAudit({
		entity: 'booking',
		entityId: row.bookingId,
		action: 'refund_paid',
		toState: 'success',
		reason: `Chapa ${verified.refund.mode ?? 'unknown'} refund ${row.reference} of ${row.amount} ${row.currencyCode}`
	});

	return { state: 'refunded', refundId: row.id, bookingId: row.bookingId };
}

/** What the settled deposit on this booking was, or 0 if there was none. */
async function depositAmount(bookingId: number): Promise<number> {
	const payment = await refundableDeposit(bookingId);
	return payment?.amount ?? 0;
}

/** Whether `reference` names a refund. Read by the webhook — see the note there. */
export async function findByReference(reference: string) {
	const rows = await db
		.select({ id: t.refunds.id })
		.from(t.refunds)
		.where(eq(t.refunds.reference, reference))
		.limit(1);
	return rows.at(0) ?? null;
}

/** Every refund on a booking, newest first. */
export const listForBooking = (bookingId: number) =>
	db
		.select()
		.from(t.refunds)
		.where(eq(t.refunds.bookingId, bookingId))
		.orderBy(desc(t.refunds.createdAt));

/** The same, for a page of bookings at once. */
export const listForBookings = (bookingIds: number[]) =>
	db
		.select()
		.from(t.refunds)
		.where(inArray(t.refunds.bookingId, bookingIds))
		.orderBy(desc(t.refunds.createdAt));
