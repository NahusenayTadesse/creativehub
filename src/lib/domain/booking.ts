import * as m from '$lib/paraglide/messages';

/**
 * The booking lifecycle. Transitions are declared here and enforced on the
 * server, so a client can request an action but never assert a state.
 */

export type BookingStatus =
	| 'proposed'
	| 'negotiating'
	| 'booked'
	| 'in_production'
	| 'submitted'
	| 'revision'
	| 'approved'
	| 'awaiting_settlement'
	| 'completed'
	| 'cancelled'
	| 'disputed';

export type EscrowStatus = 'unfunded' | 'pending' | 'held' | 'released' | 'refunded';

/** Which states may follow which. Anything absent is rejected server-side. */
const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
	proposed: ['negotiating', 'booked', 'cancelled'],
	negotiating: ['negotiating', 'booked', 'cancelled'],
	booked: ['in_production', 'cancelled', 'disputed'],
	in_production: ['submitted', 'cancelled', 'disputed'],
	submitted: ['revision', 'approved', 'disputed'],
	revision: ['submitted', 'cancelled', 'disputed'],
	approved: ['awaiting_settlement', 'disputed'],
	awaiting_settlement: ['completed', 'disputed'],
	completed: [],
	cancelled: [],
	disputed: ['completed', 'cancelled']
};

export const canTransition = (from: BookingStatus, to: BookingStatus) =>
	TRANSITIONS[from]?.includes(to) ?? false;

/** The five steps the pipeline stepper draws, and where a status sits on it. */
export const pipelineSteps = () =>
	[
		{ status: 'booked', label: m.pipeline_order_placed() },
		{ status: 'in_production', label: m.pipeline_in_production() },
		{ status: 'submitted', label: m.pipeline_submitted() },
		{ status: 'approved', label: m.pipeline_approved() },
		{ status: 'completed', label: m.pipeline_completed() }
	] as const;

export function stepIndex(status: BookingStatus): number {
	switch (status) {
		case 'proposed':
		case 'negotiating':
			return -1;
		case 'booked':
			return 0;
		case 'in_production':
			return 1;
		case 'submitted':
		case 'revision':
			return 2;
		case 'approved':
		case 'awaiting_settlement':
			return 3;
		case 'completed':
			return 4;
		default:
			return 0;
	}
}

/** Localised at call time — the locale is not known when this module loads. */
export const statusLabel = (status: string): string =>
	({
		proposed: m.status_proposed(),
		negotiating: m.status_negotiating(),
		booked: m.status_booked(),
		in_production: m.status_in_production(),
		submitted: m.status_submitted(),
		revision: m.status_revision(),
		approved: m.status_approved(),
		awaiting_settlement: m.status_awaiting_settlement(),
		completed: m.status_completed(),
		cancelled: m.status_cancelled(),
		disputed: m.status_disputed()
	})[status] ?? status;

export const escrowLabel = (status: string): string =>
	({
		unfunded: m.escrow_unfunded(),
		pending: m.escrow_pending(),
		held: m.escrow_held(),
		released: m.escrow_released(),
		refunded: m.escrow_refunded()
	})[status] ?? status;

export const applicationLabel = (status: string): string =>
	({
		applied: m.app_status_applied(),
		shortlisted: m.app_status_shortlisted(),
		selected: m.app_status_selected(),
		rejected: m.app_status_rejected(),
		withdrawn: m.app_status_withdrawn()
	})[status] ?? status.replace(/_/g, ' ');

/** Mirrors `campaignStatusEnum` in the schema — every case, and only real ones. */
export const campaignLabel = (status: string): string =>
	({
		draft: m.camp_status_draft(),
		published: m.camp_status_published(),
		closed: m.camp_status_closed(),
		cancelled: m.camp_status_cancelled(),
		completed: m.camp_status_completed()
	})[status] ?? status.replace(/_/g, ' ');

/**
 * Compensation labels. Deliberately concrete: the product only claims the
 * protection the connected provider actually performs.
 */
export const compensationLabel = (type: string): string =>
	({
		paid: m.comp_paid(),
		barter: m.comp_barter(),
		event_pass: m.comp_event_pass()
	})[type] ?? type;

/** Splits a gross amount into the platform fee and the creator's net payout. */
export function splitFee(amount: number, feePercent: number) {
	const platformFee = Math.round((amount * feePercent) / 100);
	return { platformFee, creatorPayout: amount - platformFee };
}

/**
 * CN-2608-K4F2WQ7A — readable in a support conversation, unique in the table.
 *
 * The random half was four base-36 characters, which is 1.7M possibilities
 * inside a `YYMM` bucket: by the birthday bound, a month with ~1,500 bookings
 * had a coin-flip chance of a collision against a column with a unique index,
 * and the loser saw an unexplained "booking failed" with no retry. Eight
 * characters drawn from `crypto.getRandomValues` gives 32^8 ≈ 1.1e12 per
 * bucket, which puts a collision out of reach.
 */
export function bookingReference(): string {
	const now = new Date();
	const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;

	const bytes = crypto.getRandomValues(new Uint8Array(8));
	const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford: no I, L, O, U
	const random = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');

	return `CN-${stamp}-${random}`;
}
