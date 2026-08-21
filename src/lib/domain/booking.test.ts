import { describe, expect, it } from 'vitest';
import {
	bookingReference,
	canTransition,
	splitFee,
	stepIndex,
	type BookingStatus
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

	/* The rule the whole lifecycle rests on: once a deal is settled or dropped,
	   nothing may move it again — not an operator, not a retried request. */
	it('makes completed and cancelled terminal', () => {
		for (const to of ALL) {
			expect(canTransition('completed', to), `completed → ${to}`).toBe(false);
			expect(canTransition('cancelled', to), `cancelled → ${to}`).toBe(false);
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
