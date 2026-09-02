import { describe, expect, it } from 'vitest';
import {
	CANCELLABLE_STATUSES,
	DISPUTABLE_STATUSES,
	cancelAgreeProblem,
	cancelRequestProblem,
	disputeProblem,
	disputeWindowClosesAt,
	resolutionAmounts,
	resolutionOutcome,
	splitIsValid
} from './dispute';
import { canTransition, type BookingStatus } from './booking';

const DAY = 24 * 60 * 60 * 1000;
const COMPLETED_AT = new Date('2026-09-01T12:00:00Z');

const raise = (
	booking: { status: string; completedAt?: Date | string | null },
	options: Partial<Parameters<typeof disputeProblem>[1]> = {}
) =>
	disputeProblem(
		{ status: booking.status, completedAt: booking.completedAt ?? null },
		{ side: 'organization', hasOpenDispute: false, windowDays: 7, ...options }
	);

describe('disputeProblem', () => {
	it('allows every state the transition table declares a dispute edge from', () => {
		for (const status of DISPUTABLE_STATUSES) {
			expect(raise({ status }), status).toBeNull();
			/* The two tables must not drift: a state this list allows but the
			   lifecycle refuses would fail at the transition instead of here. */
			expect(canTransition(status as BookingStatus, 'disputed'), status).toBe(true);
		}
	});

	it('refuses a deal nobody has agreed to yet', () => {
		expect(raise({ status: 'proposed' })).toBe('not_disputable');
		expect(raise({ status: 'negotiating' })).toBe('not_disputable');
	});

	it('refuses a cancelled deal outright', () => {
		expect(raise({ status: 'cancelled' })).toBe('not_disputable');
	});

	it('refuses a second open case on the same booking', () => {
		expect(raise({ status: 'submitted' }, { hasOpenDispute: true })).toBe('already_open');
	});

	it('does not let an operator raise one', () => {
		expect(raise({ status: 'submitted' }, { side: 'admin' })).toBe('not_a_party');
	});

	describe('the window after completion', () => {
		const completed = { status: 'completed', completedAt: COMPLETED_AT };

		it('is open inside it, from either side', () => {
			for (const side of ['organization', 'creator'] as const) {
				expect(
					raise(completed, { side, now: new Date(COMPLETED_AT.getTime() + 3 * DAY) }),
					side
				).toBeNull();
			}
		});

		it('is open right up to the boundary and shut after', () => {
			expect(raise(completed, { now: new Date(COMPLETED_AT.getTime() + 7 * DAY) })).toBeNull();
			expect(raise(completed, { now: new Date(COMPLETED_AT.getTime() + 7 * DAY + 1) })).toBe(
				'window_closed'
			);
		});

		/* Zero is how an operator turns the feature off, and it has to make
		   completion final again rather than opening an unbounded window. */
		it('never opens when the window is zero or negative', () => {
			for (const windowDays of [0, -1]) {
				expect(raise(completed, { windowDays, now: COMPLETED_AT }), String(windowDays)).toBe(
					'not_disputable'
				);
			}
		});

		it('refuses a completed booking with no completion date rather than guessing', () => {
			expect(raise({ status: 'completed', completedAt: null })).toBe('not_disputable');
			expect(raise({ status: 'completed', completedAt: 'not a date' })).toBe('not_disputable');
		});
	});
});

describe('disputeWindowClosesAt', () => {
	it('is the completion plus the window', () => {
		expect(disputeWindowClosesAt(COMPLETED_AT, 7)?.toISOString()).toBe('2026-09-08T12:00:00.000Z');
	});

	it('is nothing at all when there is no window or no completion', () => {
		expect(disputeWindowClosesAt(COMPLETED_AT, 0)).toBeNull();
		expect(disputeWindowClosesAt(null, 7)).toBeNull();
		expect(disputeWindowClosesAt('not a date', 7)).toBeNull();
	});
});

describe('resolutionAmounts', () => {
	/* 20,000 at 15% is the shape every booking in the app has: fee 3,000,
	   creator 17,000. */
	it('releases the whole deal on the agreed terms', () => {
		expect(resolutionAmounts(20_000, 15, 'released')).toEqual({
			refund: 0,
			platformFee: 3_000,
			payout: 17_000
		});
	});

	/*
	 * The fee goes back too. A deal that did not happen has not earned one, and
	 * keeping a cut of a refunded booking is invisible in code and extremely
	 * visible on a bank statement.
	 */
	it('returns the platform fee on a full refund', () => {
		expect(resolutionAmounts(20_000, 15, 'refunded')).toEqual({
			refund: 20_000,
			platformFee: 0,
			payout: 0
		});
	});

	/*
	 * The fee is charged on what was retained, not on the original price.
	 * Charging the full 3,000 against a halved deal would take the entire
	 * reduction out of the creator's share and leave the platform whole.
	 */
	it('charges the fee on what was kept, not on what was agreed', () => {
		expect(resolutionAmounts(20_000, 15, 'split', 8_000)).toEqual({
			refund: 8_000,
			platformFee: 1_800,
			payout: 10_200
		});
	});

	it('never lets the three parts disagree with the price', () => {
		for (const refund of [1, 999, 7_500, 19_999]) {
			const { refund: r, platformFee, payout } = resolutionAmounts(20_000, 15, 'split', refund);
			expect(r + platformFee + payout, `refund ${refund}`).toBe(20_000);
		}
	});

	it('clamps a figure outside the deal rather than inventing money', () => {
		expect(resolutionAmounts(20_000, 15, 'split', -5_000).refund).toBe(0);
		expect(resolutionAmounts(20_000, 15, 'split', 50_000).refund).toBe(20_000);
	});
});

describe('splitIsValid', () => {
	/* Both ends are one of the other two outcomes wearing the wrong name, and a
	   case closed as `split` for the whole amount reads forever afterwards as
	   though somebody was paid something. */
	it('refuses the two ends, which are not splits', () => {
		expect(splitIsValid(20_000, 0)).toBe(false);
		expect(splitIsValid(20_000, 20_000)).toBe(false);
	});

	it('refuses figures outside the deal, and nonsense', () => {
		expect(splitIsValid(20_000, -1)).toBe(false);
		expect(splitIsValid(20_000, 20_001)).toBe(false);
		expect(splitIsValid(20_000, Number.NaN)).toBe(false);
		expect(splitIsValid(20_000, Number.POSITIVE_INFINITY)).toBe(false);
	});

	it('accepts anything genuinely between', () => {
		expect(splitIsValid(20_000, 1)).toBe(true);
		expect(splitIsValid(20_000, 19_999)).toBe(true);
	});
});

describe('resolutionOutcome', () => {
	it('sends a refunded deal to cancelled, and the rest to completed', () => {
		expect(resolutionOutcome('refunded')).toEqual({
			status: 'cancelled',
			escrowStatus: 'refunded'
		});
		expect(resolutionOutcome('released')).toEqual({
			status: 'completed',
			escrowStatus: 'released'
		});
	});

	/*
	 * A split completes rather than cancels, and that is load-bearing: the
	 * payout queue pays only against released escrow, so a split that cancelled
	 * would agree the creator is owed something and then never pay it.
	 */
	it('completes a split so the creator’s share can still be paid', () => {
		expect(resolutionOutcome('split')).toEqual({
			status: 'completed',
			escrowStatus: 'released'
		});
	});

	it('only ever lands on a transition the lifecycle allows', () => {
		for (const resolution of ['released', 'refunded', 'split'] as const) {
			expect(canTransition('disputed', resolutionOutcome(resolution).status), resolution).toBe(
				true
			);
		}
	});
});

describe('cancelling by agreement', () => {
	const live = { status: 'in_production', cancelRequestedSide: null };

	it('can be asked for from a live deal', () => {
		for (const status of CANCELLABLE_STATUSES) {
			expect(cancelRequestProblem({ status, cancelRequestedSide: null }), status).toBeNull();
			expect(canTransition(status as BookingStatus, 'cancelled'), status).toBe(true);
		}
	});

	/* `submitted` is in this list on purpose: work has been handed over and not
	   yet answered, so calling it off is a question about the work, which is a
	   dispute rather than a cancellation. */
	it('cannot be asked for once work is delivered or the deal is over', () => {
		for (const status of [
			'submitted',
			'approved',
			'awaiting_settlement',
			'completed',
			'cancelled'
		]) {
			expect(cancelRequestProblem({ status, cancelRequestedSide: null }), status).toBe(
				'not_cancellable'
			);
		}
	});

	it('refuses a second request while one is outstanding', () => {
		expect(cancelRequestProblem({ ...live, cancelRequestedSide: 'creator' })).toBe(
			'already_requested'
		);
	});

	/*
	 * The whole point of the handshake. Without the side test, "cancel" is a
	 * button one party presses to walk away from a funded deal and the other
	 * finds out afterwards.
	 */
	it('does not let the side that asked also agree', () => {
		expect(cancelAgreeProblem({ ...live, cancelRequestedSide: 'creator' }, 'creator')).toBe(
			'own_request'
		);
		expect(
			cancelAgreeProblem({ ...live, cancelRequestedSide: 'organization' }, 'organization')
		).toBe('own_request');
	});

	it('lets the other side agree', () => {
		expect(
			cancelAgreeProblem({ ...live, cancelRequestedSide: 'creator' }, 'organization')
		).toBeNull();
		expect(
			cancelAgreeProblem({ ...live, cancelRequestedSide: 'organization' }, 'creator')
		).toBeNull();
	});

	/* An operator closing out a stuck case is not one of the two agreeing, so
	   the own-request test does not apply to them. */
	it('lets an operator close out either side’s request', () => {
		for (const side of ['creator', 'organization'] as const) {
			expect(cancelAgreeProblem({ ...live, cancelRequestedSide: side }, 'admin'), side).toBeNull();
		}
	});

	it('has nothing to agree to when nobody asked', () => {
		expect(cancelAgreeProblem(live, 'organization')).toBe('no_request');
	});
});
