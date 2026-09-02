import { describe, expect, it } from 'vitest';
import {
	bookingReference,
	canIntroduce,
	canTransition,
	introductionIsOpen,
	splitFee,
	stepIndex,
	type BookingStatus,
	type IntroductionStatus
} from './booking';

const ALL: BookingStatus[] = [
	'proposed',
	'negotiating',
	'booked',
	'in_production',
	'submitted',
	'revision',
	'approved',
	'awaiting_settlement',
	'completed',
	'cancelled',
	'disputed'
];

describe('canTransition', () => {
	it('allows the happy path end to end', () => {
		const path: BookingStatus[] = [
			'proposed',
			'booked',
			'in_production',
			'submitted',
			'approved',
			'awaiting_settlement',
			'completed'
		];
		for (let i = 0; i < path.length - 1; i++) {
			expect(canTransition(path[i], path[i + 1]), `${path[i]} → ${path[i + 1]}`).toBe(true);
		}
	});

	it('allows the revision loop to be re-entered', () => {
		expect(canTransition('submitted', 'revision')).toBe(true);
		expect(canTransition('revision', 'submitted')).toBe(true);
	});

	/* Cancelled is the end of the road: nothing may move it again — not an
	   operator, not a retried request. */
	it('makes cancelled terminal', () => {
		for (const to of ALL) {
			expect(canTransition('cancelled', to), `cancelled → ${to}`).toBe(false);
		}
	});

	/*
	 * Completed is terminal but for one edge.
	 *
	 * Escrow releases the moment a deal completes, so a problem discovered the
	 * next morning had no route at all until `completed → disputed` existed.
	 * Whether that edge is open in a given case is a clock, and the clock lives
	 * in `domain/dispute.ts`; this table only says the edge is there. Every
	 * other way out of `completed` stays shut — especially back into delivery,
	 * which would let a settled deal be re-run against released money.
	 */
	it('lets a completed deal be disputed, and nothing else', () => {
		expect(canTransition('completed', 'disputed')).toBe(true);
		for (const to of ALL.filter((s) => s !== 'disputed')) {
			expect(canTransition('completed', to), `completed → ${to}`).toBe(false);
		}
	});

	it('refuses to skip delivery', () => {
		expect(canTransition('booked', 'completed')).toBe(false);
		expect(canTransition('booked', 'approved')).toBe(false);
		expect(canTransition('in_production', 'approved')).toBe(false);
		expect(canTransition('proposed', 'in_production')).toBe(false);
	});

	it('refuses to walk a deal backwards', () => {
		expect(canTransition('booked', 'proposed')).toBe(false);
		expect(canTransition('submitted', 'in_production')).toBe(false);
		expect(canTransition('approved', 'submitted')).toBe(false);
	});

	/* `TRANSITIONS` is a plain object literal, so `in` and truthiness would both
	   answer for everything on Object.prototype — the same hole that made
	   `?sort=__proto__` a 500 in the query layer. */
	it('is not fooled by inherited keys', () => {
		for (const key of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
			expect(canTransition(key as BookingStatus, 'completed'), key).toBe(false);
			expect(canTransition('booked', key as BookingStatus), key).toBe(false);
		}
	});

	it('never lets a status reach one that is not a real status', () => {
		for (const from of ALL) {
			expect(canTransition(from, 'not_a_state' as BookingStatus)).toBe(false);
		}
	});
});

describe('stepIndex', () => {
	it('puts pre-agreement states before the pipeline', () => {
		expect(stepIndex('proposed')).toBe(-1);
		expect(stepIndex('negotiating')).toBe(-1);
	});

	it('holds a revision at the submission step rather than moving backwards', () => {
		expect(stepIndex('revision')).toBe(stepIndex('submitted'));
	});

	it('never goes backwards along the happy path', () => {
		const path: BookingStatus[] = [
			'booked',
			'in_production',
			'submitted',
			'approved',
			'awaiting_settlement',
			'completed'
		];
		const indexes = path.map(stepIndex);
		expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
	});
});

describe('splitFee', () => {
	it('splits without losing or inventing a cent', () => {
		for (const amount of [0, 1, 7, 999, 12_000, 1_234_567]) {
			for (const percent of [0, 3, 10, 12.5, 100]) {
				const { platformFee, creatorPayout } = splitFee(amount, percent);
				expect(platformFee + creatorPayout, `${amount} @ ${percent}%`).toBe(amount);
			}
		}
	});

	it('gives everything to the creator at zero percent', () => {
		expect(splitFee(50_000, 0)).toEqual({ platformFee: 0, creatorPayout: 50_000 });
	});

	it('rounds the fee rather than truncating it', () => {
		/* 999 × 10% = 99.9 → the platform takes 100, not 99. */
		expect(splitFee(999, 10).platformFee).toBe(100);
	});
});

describe('bookingReference', () => {
	const SHAPE = /^CN-\d{4}-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/;

	it('has the documented shape', () => {
		expect(bookingReference()).toMatch(SHAPE);
	});

	it('omits the letters that are misread aloud', () => {
		const random = Array.from({ length: 200 }, () => bookingReference().split('-')[2]).join('');
		for (const confusable of ['I', 'L', 'O', 'U']) {
			expect(random.includes(confusable), `contains ${confusable}`).toBe(false);
		}
	});

	/* The reason the random half was widened from four characters to eight: the
	   column has a unique index, and a collision surfaced as an unexplained
	   "booking failed" with no retry. */
	it('does not collide across ten thousand references', () => {
		const seen = new Set(Array.from({ length: 10_000 }, bookingReference));
		expect(seen.size).toBe(10_000);
	});
});

describe('canIntroduce', () => {
	const ALL_INTRO: IntroductionStatus[] = ['none', 'pending', 'contacted', 'connected', 'declined'];

	it('walks a case from opened to connected', () => {
		expect(canIntroduce('pending', 'contacted')).toBe(true);
		expect(canIntroduce('contacted', 'connected')).toBe(true);
	});

	it('lets a case be declined at either open step', () => {
		expect(canIntroduce('pending', 'declined')).toBe(true);
		expect(canIntroduce('contacted', 'declined')).toBe(true);
	});

	it('will not skip the contact step', () => {
		expect(canIntroduce('pending', 'connected')).toBe(false);
	});

	it('will not reopen a closed case', () => {
		for (const to of ALL_INTRO) {
			expect(canIntroduce('connected', to), `connected → ${to}`).toBe(false);
			expect(canIntroduce('declined', to), `declined → ${to}`).toBe(false);
		}
	});

	/* Whether an introduction is needed is decided from the creator at insert.
	   Nothing may move a case back to "not needed", and an ordinary booking may
	   not be dragged into the queue by a posted status. */
	it('will not move an ordinary booking into or out of the queue', () => {
		for (const to of ALL_INTRO) {
			expect(canIntroduce('none', to), `none → ${to}`).toBe(false);
		}
		for (const from of ALL_INTRO) {
			expect(canIntroduce(from, 'none'), `${from} → none`).toBe(false);
		}
	});

	/* The same Object.prototype hole the query layer and canTransition had. */
	it('answers false for inherited keys', () => {
		expect(canIntroduce('__proto__' as IntroductionStatus, 'contacted')).toBe(false);
		expect(canIntroduce('constructor' as IntroductionStatus, 'contacted')).toBe(false);
		expect(canIntroduce('toString' as IntroductionStatus, 'contacted')).toBe(false);
	});
});

describe('introductionIsOpen', () => {
	it('is true only while somebody still has to act', () => {
		expect(introductionIsOpen('pending')).toBe(true);
		expect(introductionIsOpen('contacted')).toBe(true);
		expect(introductionIsOpen('connected')).toBe(false);
		expect(introductionIsOpen('declined')).toBe(false);
		expect(introductionIsOpen('none')).toBe(false);
	});
});
