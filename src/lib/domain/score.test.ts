import { describe, expect, it } from 'vitest';
import { calculateScore, scoreWeights, type ScoreInput } from './score';

const empty: ScoreInput = {
	fullName: null,
	bio: null,
	avatar: null,
	cover: null,
	categoryCount: 0,
	languageCount: 0,
	packageCount: 0,
	portfolioCount: 0,
	verificationLevel: 'unverified',
	engagementRate: 0,
	averageRating: 0,
	completedBookings: 0
};

const full: ScoreInput = {
	fullName: 'Sara T.',
	bio: 'A bio comfortably longer than twenty characters.',
	avatar: 'a.png',
	cover: 'c.png',
	categoryCount: 3,
	languageCount: 2,
	packageCount: 4,
	portfolioCount: 6,
	verificationLevel: 'cn_verified',
	engagementRate: 12,
	averageRating: 5,
	completedBookings: 40
};

describe('calculateScore', () => {
	it('stays inside the published 10–100 band', () => {
		for (const input of [empty, full]) {
			const score = calculateScore(input);
			expect(score).toBeGreaterThanOrEqual(10);
			expect(score).toBeLessThanOrEqual(100);
		}
	});

	it('scores a finished profile above an empty one', () => {
		expect(calculateScore(full)).toBeGreaterThan(calculateScore(empty));
	});

	/**
	 * The claim the public explainer makes: the score is derived from evidence.
	 * Every field it reads must be able to move it, or the modal is describing
	 * something the code does not do.
	 */
	it('lets each piece of evidence move the number', () => {
		const base = calculateScore(empty);
		const single: Partial<ScoreInput>[] = [
			{ fullName: 'Sara T.' },
			{ bio: 'A bio comfortably longer than twenty characters.' },
			{ avatar: 'a.png' },
			{ cover: 'c.png' },
			{ categoryCount: 1 },
			{ languageCount: 1 },
			{ packageCount: 1 },
			{ portfolioCount: 1 },
			{ verificationLevel: 'cn_verified' }
		];

		for (const change of single) {
			const key = Object.keys(change)[0];
			expect(calculateScore({ ...empty, ...change }), key).toBeGreaterThan(base);
		}
	});

	it('does not pay for a one-word bio', () => {
		expect(calculateScore({ ...empty, bio: 'hi' })).toBe(calculateScore(empty));
	});

	it('rises monotonically with the verification ladder', () => {
		const ladder = ['unverified', 'social_verified', 'identity_verified', 'cn_verified'].map(
			(verificationLevel) => calculateScore({ ...empty, verificationLevel })
		);
		expect(ladder).toEqual([...ladder].sort((a, b) => a - b));
		expect(new Set(ladder).size).toBe(4);
	});

	it('treats an unknown verification level as unverified rather than throwing', () => {
		for (const level of ['', 'gold', '__proto__']) {
			expect(calculateScore({ ...empty, verificationLevel: level }), level).toBe(
				calculateScore({ ...empty, verificationLevel: 'unverified' })
			);
		}
	});

	it('never rewards a creator for more bookings by lowering the score', () => {
		const series = [0, 1, 5, 15, 100].map((completedBookings) =>
			calculateScore({ ...empty, completedBookings })
		);
		expect(series).toEqual([...series].sort((a, b) => a - b));
	});

	it('caps the engagement contribution rather than running away', () => {
		expect(calculateScore({ ...full, engagementRate: 1_000 })).toBe(
			calculateScore({ ...full, engagementRate: 100 })
		);
	});

	it('is an integer — it is rendered as one', () => {
		for (const rate of [0, 3.7, 6.02, 15]) {
			expect(Number.isInteger(calculateScore({ ...full, engagementRate: rate }))).toBe(true);
		}
	});
});

describe('scoreWeights', () => {
	/* The modal shows these as a breakdown of 100. If they stop adding up, the
	   explainer is lying about a number a creator is judged on. */
	it('adds up to 100', () => {
		const total = scoreWeights().reduce((sum, row) => sum + row.weight, 0);
		expect(total).toBe(100);
	});

	it('labels every weight', () => {
		for (const row of scoreWeights()) expect(row.label.length).toBeGreaterThan(0);
	});
});
