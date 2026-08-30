import { and, eq, ne } from 'drizzle-orm';
import { db, rowsAffected } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { absoluteUrl } from '$lib/server/urls';
import * as chapa from '$lib/server/chapa';
import { recordAudit } from '$lib/server/guards';
import { canTransition } from '$lib/domain/booking';

/**
 * What a payment means for a booking.
 *
 * `server/chapa.ts` talks to the provider and knows nothing about deals; this
 * decides who may pay, what a successful payment is allowed to change, and what
 * to do when the same success arrives twice. Both halves of the round trip —
 * the browser coming back and the provider's webhook — land on `settle` below,
 * which is written to be safe to call repeatedly because in practice it is.
 */

/**
 * A reference for one attempt: `CN-2608-K4F2WQ7A-LZ4F9K2P`.
 *
 * The booking's own reference is the readable half, so an operator holding a
 * Chapa dashboard entry can find the deal without a lookup. The random half is
 * what makes it *per attempt* — a retried checkout must not reuse a reference
 * the provider has already resolved, or the second attempt inherits the first
 * one's answer.
 */
export function paymentReference(bookingReference: string): string {
	const bytes = crypto.getRandomValues(new Uint8Array(8));
	const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
	const random = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
	return `${bookingReference}-${random}`;
}

type Booking = typeof t.bookings.$inferSelect;

/** Why a booking cannot be paid for right now, or null if it can. */
export function payableProblem(booking: Booking): 'not_paid' | 'settled' | 'currency' | null {
	/* Barter and event passes have no deposit; `settle` never asks for one. */
	if (booking.compensationType !== 'paid') return 'not_paid';
	if (booking.price <= 0) return 'not_paid';
	/* `pending` is payable: it means a checkout was opened and not finished. */
	if (booking.escrowStatus !== 'unfunded' && booking.escrowStatus !== 'pending') return 'settled';
	if (!chapa.currencyIsSupported(booking.currencyCode)) return 'currency';
	return null;
}

/* ------------------------------------------------------------------ *
 * Starting
 * ------------------------------------------------------------------ */

/**
 * Opens a checkout and returns where to send the payer.
 *
 * The row is written before the provider is called, so an attempt that dies
 * between the two still exists to be reconciled. It is left `pending`: nothing
 * here decides that money arrived, because nothing here has asked.
 */
export async function start(
	booking: Booking,
	payer: { id: string; email: string; name: string }
): Promise<{ ok: true; checkoutUrl: string } | { ok: false; error: string }> {
	const txRef = paymentReference(booking.reference);

	await db.insert(t.payments).values({
		bookingId: booking.id,
		txRef,
		provider: 'chapa',
		status: 'pending',
		amount: booking.price,
		currencyCode: booking.currencyCode,
		createdBy: payer.id
	});

	/* Chapa wants two names and will reject an empty one. Most accounts here
	   are organisations with a single-word name, so the surname falls back to
	   the first rather than being sent blank. */
	const [firstName, ...rest] = payer.name.trim().split(/\s+/);
	const lastName = rest.join(' ') || firstName || 'Customer';

	const result = await chapa.initialize({
		amount: booking.price,
		currency: booking.currencyCode,
		email: payer.email,
		firstName: firstName || 'Customer',
		lastName,
		txRef,
		callbackUrl: absoluteUrl('/api/chapa/webhook'),
		/* The booking page resolves `?payment=` on load, which is what makes the
		   result visible immediately even when the webhook is slow or blocked. */
		returnUrl: absoluteUrl(`/dashboard/bookings/${booking.id}?payment=${txRef}`),
		title: 'Deposit',
		description: booking.title
	});

	if (!result.ok) {
		await db
			.update(t.payments)
			.set({ status: 'failed', failureReason: result.error.slice(0, 300) })
			.where(eq(t.payments.txRef, txRef));
		return { ok: false, error: result.error };
	}

	/* Only now, with somewhere to send them: a booking left `pending` by a
	   checkout that was never reachable would show as in-flight forever. */
	await db
		.update(t.bookings)
		.set({ escrowStatus: 'pending', updatedBy: payer.id })
		.where(and(eq(t.bookings.id, booking.id), eq(t.bookings.escrowStatus, 'unfunded')));

	return { ok: true, checkoutUrl: result.checkoutUrl };
}

/* ------------------------------------------------------------------ *
 * Finishing
 * ------------------------------------------------------------------ */

export type SettleOutcome =
	| { state: 'funded'; bookingId: number }
	| { state: 'already'; bookingId: number }
	| { state: 'pending'; bookingId: number }
	| { state: 'failed'; bookingId: number; reason: string }
	/** A reference we never issued. Nothing to do, and nothing to retry. */
	| { state: 'not_found'; reason: string }
	/** We could not reach the provider to ask. Worth trying again. */
	| { state: 'unreachable'; reason: string };

/**
 * Asks the provider what happened to `txRef`, and applies it.
 *
 * Safe to call twice, from both ends of the round trip, in either order. The
 * two guards that make it so are the `status = 'pending'` predicate on the
 * payment update and the `escrow_status <> 'held'` predicate on the booking:
 * whichever call arrives second changes nothing and says `already`.
 *
 * Everything is decided from `chapa.verify`, never from a webhook body. See
 * the webhook route for why that is the whole security model here.
 */
export async function settle(txRef: string): Promise<SettleOutcome> {
	const rows = await db.select().from(t.payments).where(eq(t.payments.txRef, txRef)).limit(1);
	const payment = rows.at(0);
	/* A reference we never issued. Someone is guessing, or a stale callback
	   from a database that has since been reset. */
	if (!payment) return { state: 'not_found', reason: 'No such payment reference.' };

	if (payment.status === 'success') return { state: 'already', bookingId: payment.bookingId };

	const verified = await chapa.verify(txRef);
	if (!verified.ok) return { state: 'unreachable', reason: verified.error };

	const { status, amount, currency, method, reference, mode } = verified.payment;

	if (status !== 'success') {
		/* `pending` is a checkout still open, not a failure — leave it alone so
		   a payer who is mid-flow is not told their payment failed. */
		if (status === 'pending') return { state: 'pending', bookingId: payment.bookingId };

		await db
			.update(t.payments)
			.set({ status: 'failed', failureReason: `Chapa reported ${status}`, verifiedAt: new Date() })
			.where(and(eq(t.payments.txRef, txRef), eq(t.payments.status, 'pending')));

		/* Back to unfunded so the brand can try again; only from `pending`, so a
		   booking funded by some other route is never disturbed. */
		await db
			.update(t.bookings)
			.set({ escrowStatus: 'unfunded' })
			.where(and(eq(t.bookings.id, payment.bookingId), eq(t.bookings.escrowStatus, 'pending')));

		return { state: 'failed', bookingId: payment.bookingId, reason: status };
	}

	/*
	 * Paid — but for the right thing?
	 *
	 * The amount and currency are re-checked against what we asked for. Chapa's
	 * hosted page does not let a payer change either, so a mismatch means the
	 * booking's price moved after the checkout was opened, or the reference is
	 * being replayed against a different deal. Neither is a reason to mark a
	 * deposit held: the money exists, but it is not the money this booking
	 * needs, and an operator has to look at it.
	 */
	if (Math.round(amount) !== payment.amount || currency !== payment.currencyCode) {
		const reason = `Paid ${amount} ${currency}, expected ${payment.amount} ${payment.currencyCode}`;
		await db
			.update(t.payments)
			.set({
				status: 'failed',
				failureReason: reason,
				method,
				providerRef: reference,
				mode,
				verifiedAt: new Date()
			})
			.where(and(eq(t.payments.txRef, txRef), eq(t.payments.status, 'pending')));

		await recordAudit({
			entity: 'booking',
			entityId: payment.bookingId,
			action: 'payment_mismatch',
			reason
		});

		return { state: 'failed', bookingId: payment.bookingId, reason };
	}

	const claimed = await db
		.update(t.payments)
		.set({
			status: 'success',
			method,
			providerRef: reference,
			mode,
			verifiedAt: new Date()
		})
		.where(and(eq(t.payments.txRef, txRef), eq(t.payments.status, 'pending')));

	/* The other end of the round trip got here first and is mid-flight. */
	if (rowsAffected(claimed) === 0) return { state: 'already', bookingId: payment.bookingId };

	const funded = await db
		.update(t.bookings)
		.set({
			escrowStatus: 'held',
			paymentMethod: 'chapa',
			paymentRef: txRef
		})
		.where(and(eq(t.bookings.id, payment.bookingId), ne(t.bookings.escrowStatus, 'held')));

	if (rowsAffected(funded) === 0) return { state: 'already', bookingId: payment.bookingId };

	await recordAudit({
		entity: 'booking',
		entityId: payment.bookingId,
		action: 'compensation_held',
		toState: 'held',
		reason: `Chapa ${mode ?? 'unknown'} payment ${txRef}${method ? ` via ${method}` : ''}`
	});

	/*
	 * Paying for the work is what starts it.
	 *
	 * The operator's manual deposit does this too, and it is not cosmetic: a
	 * booking left at `booked` cannot be delivered, because `submit` only
	 * accepts `in_production` or `revision`. A deposit that funded the deal but
	 * left the creator unable to hand anything over would be a dead end that
	 * looked like success from both sides.
	 *
	 * `booked` is re-tested in the WHERE clause rather than trusted from the row
	 * read at the top: this runs from a webhook that can arrive at any moment,
	 * including after the deal has moved on by some other route, and only the
	 * declared transition is allowed to happen here.
	 */
	if (canTransition('booked', 'in_production')) {
		const started = await db
			.update(t.bookings)
			.set({ status: 'in_production' })
			.where(and(eq(t.bookings.id, payment.bookingId), eq(t.bookings.status, 'booked')));

		if (rowsAffected(started) > 0) {
			await recordAudit({
				entity: 'booking',
				entityId: payment.bookingId,
				action: 'status_change',
				fromState: 'booked',
				toState: 'in_production',
				reason: 'Deposit paid'
			});
		}
	}

	return { state: 'funded', bookingId: payment.bookingId };
}
