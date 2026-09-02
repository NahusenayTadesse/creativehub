import * as m from '$lib/paraglide/messages';
import { splitFee, type BookingStatus } from '$lib/domain/booking';

/**
 * When a deal can be argued about, and what an argument may end in.
 *
 * Pure, like `domain/booking.ts` beside it: every rule here is decided from
 * plain values so it can be tested against object literals, and the server
 * modules that read rows and move money call in rather than reimplementing.
 *
 * The reason this file exists at all is that until now a booking past `booked`
 * had exactly one exit — `completed`. A creator who vanished, work that was
 * never acceptable, plans that changed: all of them left a deposit sitting in
 * escrow with nothing in the product able to move it. Cancellation and disputes
 * are the two exits, and they are deliberately different things. Most stuck
 * deals are not disagreements, and routing those through an arbitration queue
 * makes an operator adjudicate something nobody is arguing about.
 */

export type PartySide = 'creator' | 'organization';
export type DisputeStatus = 'open' | 'resolved' | 'withdrawn';
export type DisputeResolution = 'released' | 'refunded' | 'split';

/**
 * The states a live booking may be disputed from.
 *
 * Mirrors the `disputed` edges declared in `domain/booking.ts` — everything
 * after the deal is agreed and before it is finished. `proposed` and
 * `negotiating` are absent because there is nothing to argue about yet: a
 * proposal that is not working out is declined, not disputed.
 */
export const DISPUTABLE_STATUSES: BookingStatus[] = [
	'booked',
	'in_production',
	'submitted',
	'revision',
	'approved',
	'awaiting_settlement'
];

/**
 * The states a live booking may be cancelled from, once both sides agree.
 *
 * Exactly the states the lifecycle already declares a `cancelled` edge from —
 * this list must not widen it. `submitted` is the interesting omission: the
 * creator has handed work over and the brand has not answered yet, so calling
 * that off is a question of whether the work was any good. That is what a
 * dispute is for, and an operator should see it rather than one side agreeing
 * to a refund of work they have already received.
 */
export const CANCELLABLE_STATUSES: BookingStatus[] = ['booked', 'in_production', 'revision'];

export const disputeStatusLabel = (status: string): string =>
	({
		open: m.dsp_status_open(),
		resolved: m.dsp_status_resolved(),
		withdrawn: m.dsp_status_withdrawn()
	})[status] ?? status;

export const disputeResolutionLabel = (resolution: string): string =>
	({
		released: m.dsp_resolution_released(),
		refunded: m.dsp_resolution_refunded(),
		split: m.dsp_resolution_split()
	})[resolution] ?? resolution;

/* ------------------------------------------------------------------ *
 * Raising one
 * ------------------------------------------------------------------ */

export type DisputeProblem =
	/** The deal is not far enough along, or is already finished and out of time. */
	| 'not_disputable'
	/** Completed, and the window has closed. */
	| 'window_closed'
	/** One is already open on this booking. */
	| 'already_open'
	/** Operators arbitrate cases; they are not a side that can raise one. */
	| 'not_a_party';

type DisputableBooking = {
	status: string;
	completedAt: Date | string | null;
};

/**
 * Why this booking cannot be disputed right now, or null if it can.
 *
 * The post-completion window is the awkward part. Escrow releases the moment a
 * deal completes, so without a window the product's answer to "the video came
 * down the next day" is nothing at all; with an unbounded one, no deal is ever
 * really finished. `windowDays` of 0 switches it off and makes completion final.
 *
 * Measured from `completedAt` and not from the row's `updatedAt`, which moves
 * every time anybody touches the booking — including the operator reading it.
 */
export function disputeProblem(
	booking: DisputableBooking,
	options: {
		side: PartySide | 'admin';
		hasOpenDispute: boolean;
		windowDays: number;
		now?: Date;
	}
): DisputeProblem | null {
	if (options.side === 'admin') return 'not_a_party';
	if (options.hasOpenDispute) return 'already_open';

	if (DISPUTABLE_STATUSES.includes(booking.status as BookingStatus)) return null;

	if (booking.status === 'completed') {
		if (options.windowDays <= 0) return 'not_disputable';
		if (!booking.completedAt) return 'not_disputable';
		const completed = new Date(booking.completedAt).getTime();
		/* An unparseable date is not a licence to dispute a finished deal. */
		if (!Number.isFinite(completed)) return 'not_disputable';
		const closesAt = completed + options.windowDays * 24 * 60 * 60 * 1000;
		return (options.now ?? new Date()).getTime() <= closesAt ? null : 'window_closed';
	}

	return 'not_disputable';
}

/** When the window on a completed booking shuts, or null if it never opened. */
export function disputeWindowClosesAt(
	completedAt: Date | string | null,
	windowDays: number
): Date | null {
	if (!completedAt || windowDays <= 0) return null;
	const completed = new Date(completedAt).getTime();
	if (!Number.isFinite(completed)) return null;
	return new Date(completed + windowDays * 24 * 60 * 60 * 1000);
}

/* ------------------------------------------------------------------ *
 * Ending one
 * ------------------------------------------------------------------ */

export type ResolutionAmounts = {
	/** Back to the brand. */
	refund: number;
	/** The platform's cut of whatever the deal turned out to be worth. */
	platformFee: number;
	/** The creator's share, which the payout queue later sends. */
	payout: number;
};

/**
 * What each party gets, for a resolution and an operator's refund figure.
 *
 * The three outcomes are money answers rather than verdicts, and only `split`
 * takes a number from the operator — the other two are the whole amount, one
 * way or the other.
 *
 * A full refund returns the platform fee too. A deal that did not happen has
 * not earned one, and keeping a cut of a refunded booking is the kind of detail
 * that is invisible in code and extremely visible on a bank statement.
 *
 * A split charges the fee on what was *retained*, using the same `splitFee` the
 * booking was priced with. Charging the original fee against a reduced deal
 * would quietly take the whole reduction out of the creator's share.
 */
export function resolutionAmounts(
	price: number,
	feePercent: number,
	resolution: DisputeResolution,
	refundInput = 0
): ResolutionAmounts {
	if (resolution === 'refunded') {
		return { refund: price, platformFee: 0, payout: 0 };
	}

	if (resolution === 'released') {
		const { platformFee, creatorPayout } = splitFee(price, feePercent);
		return { refund: 0, platformFee, payout: creatorPayout };
	}

	const refund = Math.min(Math.max(Math.round(refundInput), 0), price);
	const retained = price - refund;
	const { platformFee, creatorPayout } = splitFee(retained, feePercent);
	return { refund, platformFee, payout: creatorPayout };
}

/**
 * Whether an operator's split figure is a split at all.
 *
 * Zero and the full price are refused rather than silently accepted, because
 * both are one of the other two outcomes wearing the wrong name — and a case
 * closed as `split` for the entire amount reads, forever afterwards, as though
 * somebody was paid something.
 */
export const splitIsValid = (price: number, refund: number): boolean =>
	Number.isFinite(refund) && Math.round(refund) > 0 && Math.round(refund) < price;

/** Where a resolution leaves the booking and its escrow. */
export function resolutionOutcome(resolution: DisputeResolution): {
	status: BookingStatus;
	escrowStatus: 'released' | 'refunded';
} {
	/*
	 * A split completes rather than cancels. Some of the work was accepted and
	 * some of the money is being paid for it, which is a finished deal on worse
	 * terms — and it has to be `completed` for the creator's share to reach the
	 * payout queue, which pays only against released escrow.
	 */
	if (resolution === 'refunded') return { status: 'cancelled', escrowStatus: 'refunded' };
	return { status: 'completed', escrowStatus: 'released' };
}

/* ------------------------------------------------------------------ *
 * Cancelling by agreement
 * ------------------------------------------------------------------ */

export type CancelProblem =
	/** Too early, too late, or already being argued about. */
	| 'not_cancellable'
	/** Somebody has already asked and is waiting on an answer. */
	| 'already_requested'
	/** You cannot agree with yourself. */
	| 'own_request'
	/** Nobody has asked, so there is nothing to agree to. */
	| 'no_request';

type CancellableBooking = {
	status: string;
	cancelRequestedSide: string | null;
};

/** Why this booking cannot be proposed for cancellation, or null if it can. */
export function cancelRequestProblem(booking: CancellableBooking): CancelProblem | null {
	if (!CANCELLABLE_STATUSES.includes(booking.status as BookingStatus)) return 'not_cancellable';
	if (booking.cancelRequestedSide) return 'already_requested';
	return null;
}

/**
 * Why this side cannot agree to the outstanding request, or null if it can.
 *
 * The side test is the whole point of the handshake: without it "cancel" is a
 * button one party presses to walk away from a funded deal, and the other side
 * finds out afterwards.
 */
export function cancelAgreeProblem(
	booking: CancellableBooking,
	side: PartySide | 'admin'
): CancelProblem | null {
	if (!CANCELLABLE_STATUSES.includes(booking.status as BookingStatus)) return 'not_cancellable';
	if (!booking.cancelRequestedSide) return 'no_request';
	/* An operator may close out a case, but is not one of the two agreeing. */
	if (side !== 'admin' && booking.cancelRequestedSide === side) return 'own_request';
	return null;
}
