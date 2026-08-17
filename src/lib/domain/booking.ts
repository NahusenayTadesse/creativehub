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
export const PIPELINE_STEPS = [
	{ status: 'booked', label: 'Order Placed' },
	{ status: 'in_production', label: 'In Production' },
	{ status: 'submitted', label: 'Submitted' },
	{ status: 'approved', label: 'Approved' },
	{ status: 'completed', label: 'Completed' }
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

export const STATUS_LABELS: Record<BookingStatus, string> = {
	proposed: 'Proposed',
	negotiating: 'Negotiating',
	booked: 'Booked',
	in_production: 'In Production',
	submitted: 'Submitted',
	revision: 'Revision Requested',
	approved: 'Approved',
	awaiting_settlement: 'Awaiting Settlement',
	completed: 'Completed',
	cancelled: 'Cancelled',
	disputed: 'Disputed'
};

export const ESCROW_LABELS: Record<EscrowStatus, string> = {
	unfunded: 'Awaiting Deposit',
	pending: 'Payment Pending',
	held: 'Funds Held in Escrow',
	released: 'Released to Creator',
	refunded: 'Refunded to Brand'
};

/**
 * Compensation labels. Deliberately concrete: the product only claims the
 * protection the connected provider actually performs.
 */
export const COMPENSATION_LABELS = {
	paid: 'Paid',
	barter: 'Barter / Product',
	event_pass: 'Event Access'
} as const;

/** Splits a gross amount into the platform fee and the creator's net payout. */
export function splitFee(amount: number, feePercent: number) {
	const platformFee = Math.round((amount * feePercent) / 100);
	return { platformFee, creatorPayout: amount - platformFee };
}

/** CN-2608-4F2A — readable in a support conversation, unique in the table. */
export function bookingReference(): string {
	const now = new Date();
	const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
	const random = Math.random().toString(36).slice(2, 6).toUpperCase();
	return `CN-${stamp}-${random}`;
}
