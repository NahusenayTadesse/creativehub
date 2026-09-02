import * as m from '$lib/paraglide/messages';

/**
 * The rules about paying a creator, with nothing that talks to anything.
 *
 * The same split as `domain/booking.ts`: what is allowed lives here and is
 * decided from plain values, while `server/payouts.ts` reads the rows, calls
 * Chapa and writes the outcome. Keeping the decision on this side is what lets
 * it be tested without a database or a payment provider — which for the one
 * piece of the app that sends money out is worth more than it is anywhere else.
 */

export type PayoutStatus = 'pending' | 'queued' | 'success' | 'failed' | 'cancelled';

/**
 * Which statuses mean a booking's money is spoken for.
 *
 * `pending` and `queued` are in flight and `success` is done; only `failed` and
 * `cancelled` leave a booking payable again. Getting this list wrong in either
 * direction is a real cost — too narrow pays somebody twice, too wide strands
 * a creator behind an attempt that will never resolve.
 */
export const LIVE_PAYOUT_STATUSES: PayoutStatus[] = ['pending', 'queued', 'success'];

export const payoutIsLive = (status: string): boolean =>
	LIVE_PAYOUT_STATUSES.includes(status as PayoutStatus);

/** Localised at call time — the locale is not known when this module loads. */
export const payoutStatusLabel = (status: string): string =>
	({
		pending: m.payout_status_pending(),
		queued: m.payout_status_queued(),
		success: m.payout_status_success(),
		failed: m.payout_status_failed(),
		cancelled: m.payout_status_cancelled()
	})[status] ?? status;

export type PayoutProblem =
	/** Barter, an event pass, or a zero-price deal. Nothing is owed. */
	| 'not_paid'
	/** The brand's deposit has not been released yet — the deal is not finished. */
	| 'not_released'
	/** The creator has not said where their money should go. */
	| 'no_account'
	/** An operator has not yet matched the account name against anything. */
	| 'account_unverified'
	/** Already sent, or an attempt is in flight. */
	| 'already'
	/** The booking's currency is not one the provider will transfer in. */
	| 'currency'
	/** The creator's account is held in a currency this booking is not in. */
	| 'currency_mismatch';

export const payoutProblemLabel = (problem: PayoutProblem): string =>
	({
		not_paid: m.payout_problem_not_paid(),
		not_released: m.payout_problem_not_released(),
		no_account: m.payout_problem_no_account(),
		account_unverified: m.payout_problem_account_unverified(),
		already: m.payout_problem_already(),
		currency: m.payout_problem_currency(),
		currency_mismatch: m.payout_problem_currency_mismatch()
	})[problem];

/* Structural rather than the Drizzle row types: this module is the one place
   the rules live, and it should be callable from a test with an object
   literal, not with a database row. */
type PayableBooking = {
	compensationType: string;
	creatorPayout: number;
	escrowStatus: string;
	currencyCode: string;
};

type PayableAccount = {
	isVerified: boolean;
	currencyCode: string;
};

/**
 * Why this booking cannot be paid out right now, or null if it can.
 *
 * The order is deliberate, because the first answer is the one shown: it runs
 * from facts about the deal, through facts about the attempt, to facts about
 * the account. An operator looking at a barter booking should be told there is
 * nothing owed, not that the creator has no bank account on file.
 */
export function payoutProblem(
	booking: PayableBooking,
	account: PayableAccount | null | undefined,
	liveAttempts: number,
	currencyIsSupported: (code: string) => boolean
): PayoutProblem | null {
	if (booking.compensationType !== 'paid') return 'not_paid';
	if (booking.creatorPayout <= 0) return 'not_paid';
	/*
	 * `released` and nothing else.
	 *
	 * `held` is the brand's money sitting in escrow against work that has not
	 * been accepted; paying it out then would hand over funds the brand can
	 * still dispute. `released` is set by the booking's own `settle` action at
	 * the moment the deal completes, which is exactly the event that makes the
	 * creator owed.
	 */
	if (booking.escrowStatus !== 'released') return 'not_released';
	if (liveAttempts > 0) return 'already';
	if (!account) return 'no_account';
	if (!account.isVerified) return 'account_unverified';
	if (!currencyIsSupported(booking.currencyCode)) return 'currency';
	if (account.currencyCode !== booking.currencyCode) return 'currency_mismatch';
	return null;
}

/**
 * A reference for one attempt: `CN-2608-K4F2WQ7A-PO-LZ4F9K2P`.
 *
 * The `PO-` infix is not decoration. Chapa references are unique per business
 * across *both* directions, the webhook receives deposits and transfers on one
 * URL, and an operator reading a Chapa dashboard export has only this string to
 * tell a 15,000 birr charge from a 12,750 birr payment on the same deal.
 *
 * Eight Crockford characters from `crypto.getRandomValues`, for the reason
 * `bookingReference` uses them: the column has a unique index, and a collision
 * is an unexplained failure with no retry.
 */
export function payoutReference(bookingReference: string): string {
	const bytes = crypto.getRandomValues(new Uint8Array(8));
	const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
	const random = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
	return `${bookingReference}-PO-${random}`;
}

/**
 * An account number with its middle removed: `1000••••3417`.
 *
 * Operator screens list other people's bank details, and a queue of thirty
 * bookings has no reason to put thirty full account numbers on a screen in an
 * office. The last four are enough to match against a bank statement, and the
 * unmasked value is on the payout's own row for the one operator who needs it.
 *
 * Short numbers are returned whole rather than masked: masking eight digits
 * leaves nothing but the mask, which identifies nothing and hides nothing.
 */
export function maskAccount(accountNumber: string): string {
	const digits = accountNumber.trim();
	if (digits.length <= 8) return digits;
	return `${digits.slice(0, 4)}${'•'.repeat(4)}${digits.slice(-4)}`;
}
