import * as m from '$lib/paraglide/messages';
import { and, eq, inArray } from 'drizzle-orm';
import { db, insertedId, rowsAffected } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import * as chapa from '$lib/server/chapa';
import { notify } from '$lib/server/notify';
import { recordAudit } from '$lib/server/guards';
import {
	LIVE_PAYOUT_STATUSES,
	maskAccount,
	payoutProblem,
	payoutReference,
	type PayoutProblem
} from '$lib/domain/payout';

/* Re-exported so a caller needs one import to send a payout and to say why it
   could not be sent. The rules themselves live in the domain module. */
export { maskAccount, payoutProblem, payoutReference, type PayoutProblem };

/**
 * What it means to pay a creator.
 *
 * The mirror of `server/payments.ts`, and it holds the same line: `chapa.ts`
 * moves money and knows nothing about deals, this decides which deals may be
 * paid, how much, and what to do when the same answer arrives twice.
 *
 * One asymmetry runs through the whole file. Taking money is reversible in
 * practice — a deposit that lands wrongly can be refunded, and the payer is a
 * brand with an account and a support thread. Sending money is not: Chapa will
 * transfer to any valid account number, the receiving bank matches on the
 * number and not the name, and once it settles there is nobody to ask. So
 * every guard here is stricter than its counterpart on the way in, a payout is
 * never sent automatically, and nothing but `chapa.verifyTransfer` is allowed
 * to conclude that a creator has been paid.
 */

type Booking = typeof t.bookings.$inferSelect;
type PayoutAccount = typeof t.payoutAccounts.$inferSelect;

/* ------------------------------------------------------------------ *
 * The bank list
 * ------------------------------------------------------------------ */

let bankCache: { banks: chapa.Bank[]; at: number } | null = null;
/** Chapa's list changes a few times a year; an hour is generous. */
const BANK_TTL_MS = 60 * 60 * 1000;

/**
 * Chapa's banks, cached in memory.
 *
 * The creator's payout form is the only thing that needs this and it is one of
 * the least-visited pages in the app, so the cache exists to stop a reload
 * loop hammering the provider rather than to make anything fast. A failed
 * fetch is not cached: the next visitor should try again, not inherit an
 * outage.
 */
export async function banks(): Promise<{ ok: true; banks: chapa.Bank[] } | { ok: false }> {
	if (bankCache && Date.now() - bankCache.at < BANK_TTL_MS) {
		return { ok: true, banks: bankCache.banks };
	}

	const result = await chapa.listBanks();
	if (!result.ok) {
		console.error('[chapa] could not list banks:', result.error);
		/* A stale list beats no list: a creator can still pick their bank. */
		if (bankCache) return { ok: true, banks: bankCache.banks };
		return { ok: false };
	}

	bankCache = { banks: result.banks, at: Date.now() };
	return { ok: true, banks: result.banks };
}

/* ------------------------------------------------------------------ *
 * Whether this may be paid
 * ------------------------------------------------------------------ */

/** How many attempts against this booking are unresolved or already succeeded. */
export async function liveAttemptCount(bookingId: number): Promise<number> {
	const rows = await db
		.select({ id: t.payouts.id })
		.from(t.payouts)
		.where(
			and(eq(t.payouts.bookingId, bookingId), inArray(t.payouts.status, LIVE_PAYOUT_STATUSES))
		);
	return rows.length;
}

/** The creator's account, or null if they have not set one up. */
export async function accountFor(creatorId: number): Promise<PayoutAccount | null> {
	const rows = await db
		.select()
		.from(t.payoutAccounts)
		.where(eq(t.payoutAccounts.creatorId, creatorId))
		.limit(1);
	return rows.at(0) ?? null;
}

/* ------------------------------------------------------------------ *
 * Sending
 * ------------------------------------------------------------------ */

export type SendOutcome =
	| { ok: true; payoutId: number; reference: string }
	| { ok: false; problem: PayoutProblem }
	| { ok: false; error: string };

/**
 * Sends one payout, and records what happened either way.
 *
 * The row is written `pending` *before* Chapa is called, for the reason
 * `payments.start` writes one first: an attempt that dies between the two must
 * still exist to be reconciled. Here it matters more. A transfer that Chapa
 * accepted but whose response we never saw is money that has left the merchant
 * balance with no record of where it went — the insert is what makes that
 * recoverable instead of a mystery in a bank statement.
 *
 * The insert also *is* the lock. `liveAttemptCount` is re-read inside the same
 * moment, and the row it writes is what makes a second concurrent press find
 * `already` rather than send the money twice.
 */
export async function send(
	booking: Booking,
	actor: { id: string; name?: string | null }
): Promise<SendOutcome> {
	const account = await accountFor(booking.creatorId);
	const problem = payoutProblem(
		booking,
		account,
		await liveAttemptCount(booking.id),
		chapa.currencyIsSupported
	);
	if (problem) return { ok: false, problem };
	/* `payoutProblem` returns `no_account` when this is null; narrowing for TS. */
	if (!account) return { ok: false, problem: 'no_account' };

	const reference = payoutReference(booking.reference);
	const amount = booking.creatorPayout;

	const inserted = await db.insert(t.payouts).values({
		bookingId: booking.id,
		creatorId: booking.creatorId,
		payoutAccountId: account.id,
		reference,
		provider: 'chapa',
		status: 'pending',
		amount,
		currencyCode: booking.currencyCode,
		bankCode: account.bankCode,
		bankName: account.bankName,
		accountName: account.accountName,
		accountNumber: account.accountNumber,
		createdBy: actor.id
	});

	const payoutId = insertedId(inserted);

	const result = await chapa.transfer({
		amount,
		currency: booking.currencyCode,
		accountNumber: account.accountNumber,
		accountName: account.accountName,
		bankCode: account.bankCode,
		reference
	});

	if (!result.ok) {
		/*
		 * Refused, not lost.
		 *
		 * Chapa rejects before queuing — insufficient balance, a malformed
		 * account number — so a failure here means no money moved and the
		 * booking is payable again once the cause is fixed. That is why this is
		 * `failed` rather than something that needs reconciling: `failed` is not
		 * a live status, so the queue offers the booking again.
		 */
		await db
			.update(t.payouts)
			.set({ status: 'failed', failureReason: result.error.slice(0, 300), updatedBy: actor.id })
			.where(and(eq(t.payouts.id, payoutId), eq(t.payouts.status, 'pending')));

		await recordAudit({
			actorId: actor.id,
			actorLabel: actor.name ?? undefined,
			entity: 'booking',
			entityId: booking.id,
			action: 'payout_refused',
			reason: `${reference}: ${result.error}`.slice(0, 300)
		});

		return { ok: false, error: result.error };
	}

	/* Queued, not paid. Chapa has the instruction; a bank has not moved yet. */
	await db
		.update(t.payouts)
		.set({ status: 'queued', providerRef: result.providerRef, updatedBy: actor.id })
		.where(and(eq(t.payouts.id, payoutId), eq(t.payouts.status, 'pending')));

	await recordAudit({
		actorId: actor.id,
		actorLabel: actor.name ?? undefined,
		entity: 'booking',
		entityId: booking.id,
		action: 'payout_queued',
		toState: 'queued',
		reason: `${amount} ${booking.currencyCode} to ${account.bankName} ${maskAccount(
			account.accountNumber
		)} (${reference})`
	});

	return { ok: true, payoutId, reference };
}

/* ------------------------------------------------------------------ *
 * Finding out what happened
 * ------------------------------------------------------------------ */

export type ReconcileOutcome =
	| { state: 'paid'; payoutId: number; bookingId: number; creatorId: number }
	| { state: 'already'; payoutId: number; bookingId: number }
	| { state: 'pending'; payoutId: number; bookingId: number }
	| { state: 'failed'; payoutId: number; bookingId: number; reason: string }
	/** A reference we never issued. Nothing to do, and nothing to retry. */
	| { state: 'not_found'; reason: string }
	/** We could not reach the provider to ask. Worth trying again. */
	| { state: 'unreachable'; reason: string };

/**
 * Asks Chapa what became of `reference`, and applies it.
 *
 * Safe to call twice, from the webhook and from an operator pressing refresh,
 * in either order. The `status = 'queued'` predicate on every update is what
 * makes the second call change nothing and say `already`.
 *
 * Nothing here is decided from a webhook body — see the webhook route.
 */
export async function reconcile(reference: string): Promise<ReconcileOutcome> {
	const rows = await db.select().from(t.payouts).where(eq(t.payouts.reference, reference)).limit(1);
	const payout = rows.at(0);
	if (!payout) return { state: 'not_found', reason: 'No such payout reference.' };

	if (payout.status === 'success') {
		return { state: 'already', payoutId: payout.id, bookingId: payout.bookingId };
	}

	const verified = await chapa.verifyTransfer(reference);
	if (!verified.ok) return { state: 'unreachable', reason: verified.error };

	const {
		status,
		amount,
		currency,
		reference: providerRef,
		mode,
		failureReason
	} = verified.transfer;

	if (status === 'pending') {
		return { state: 'pending', payoutId: payout.id, bookingId: payout.bookingId };
	}

	if (status !== 'success') {
		const reason = failureReason ?? `Chapa reported ${status}`;
		await db
			.update(t.payouts)
			.set({
				status: 'failed',
				failureReason: reason.slice(0, 300),
				providerRef: providerRef ?? payout.providerRef,
				mode,
				verifiedAt: new Date()
			})
			.where(and(eq(t.payouts.id, payout.id), eq(t.payouts.status, 'queued')));

		await recordAudit({
			entity: 'booking',
			entityId: payout.bookingId,
			action: 'payout_failed',
			toState: 'failed',
			reason: `${reference}: ${reason}`.slice(0, 300)
		});

		await tellCreator(payout.creatorId, {
			category: 'deals',
			kind: 'payout',
			title: m.notif_payout_failed_title(),
			/* The provider's own words are not passed on: they are English, about
			   our request as often as their bank, and the creator's only useful
			   next step is to check the account details they gave us. */
			body: m.notif_payout_failed_body({ reference: payout.reference }),
			link: '/dashboard/payouts',
			actionLabel: m.mail_open_payouts(),
			footnote: m.mail_prefs_footnote()
		});

		return { state: 'failed', payoutId: payout.id, bookingId: payout.bookingId, reason };
	}

	/*
	 * Sent — but the right amount?
	 *
	 * Checked for the same reason the deposit is: a mismatch means the figure
	 * moved between the instruction and the settlement, or this reference is
	 * being replayed against a different payout. Unlike a deposit, the money is
	 * already gone, so this cannot be refused — only recorded loudly enough that
	 * an operator reconciling against a bank statement finds it.
	 */
	const mismatch =
		Math.round(amount) !== payout.amount || (currency && currency !== payout.currencyCode);

	const claimed = await db
		.update(t.payouts)
		.set({
			status: 'success',
			providerRef: providerRef ?? payout.providerRef,
			mode,
			failureReason: mismatch
				? `Sent ${amount} ${currency}, expected ${payout.amount} ${payout.currencyCode}`
				: null,
			verifiedAt: new Date()
		})
		.where(and(eq(t.payouts.id, payout.id), eq(t.payouts.status, 'queued')));

	/* The other end of the round trip got here first and is mid-flight. */
	if (rowsAffected(claimed) === 0) {
		return { state: 'already', payoutId: payout.id, bookingId: payout.bookingId };
	}

	if (mismatch) {
		await recordAudit({
			entity: 'booking',
			entityId: payout.bookingId,
			action: 'payout_mismatch',
			reason: `Sent ${amount} ${currency}, expected ${payout.amount} ${payout.currencyCode}`
		});
	}

	await recordAudit({
		entity: 'booking',
		entityId: payout.bookingId,
		action: 'payout_paid',
		toState: 'success',
		reason: `Chapa ${mode ?? 'unknown'} transfer ${reference} to ${payout.bankName} ${maskAccount(
			payout.accountNumber
		)}`
	});

	await tellCreator(payout.creatorId, {
		category: 'deals',
		kind: 'payout',
		title: m.notif_payout_paid_title(),
		body: m.notif_payout_paid_body({
			amount: `${payout.amount.toLocaleString()} ${payout.currencyCode}`,
			bank: payout.bankName
		}),
		link: '/dashboard/payouts',
		actionLabel: m.mail_open_payouts(),
		footnote: m.mail_prefs_footnote()
	});

	return {
		state: 'paid',
		payoutId: payout.id,
		bookingId: payout.bookingId,
		creatorId: payout.creatorId
	};
}

/**
 * Tells a creator their money moved.
 *
 * Raised from `reconcile` rather than from the operator's action, so it fires
 * once whichever way the outcome arrived — the webhook, or an operator pressing
 * refresh — and never for a transfer that was only queued. `notify` drops a
 * null id by itself, which is what an unclaimed profile has.
 */
async function tellCreator(creatorId: number, event: Parameters<typeof notify>[1]) {
	const rows = await db
		.select({ userId: t.creators.userId })
		.from(t.creators)
		.where(eq(t.creators.id, creatorId))
		.limit(1);
	await notify(rows.at(0)?.userId, event);
}

/**
 * Whether `reference` names a payout rather than a deposit.
 *
 * The webhook receives both on one URL and must not guess from the shape of
 * the string: an operator can be sent a reference by hand, and Chapa's payload
 * field names have moved between versions. A row either exists or it does not.
 */
export async function isPayoutReference(reference: string): Promise<boolean> {
	const rows = await db
		.select({ id: t.payouts.id })
		.from(t.payouts)
		.where(eq(t.payouts.reference, reference))
		.limit(1);
	return rows.length > 0;
}
