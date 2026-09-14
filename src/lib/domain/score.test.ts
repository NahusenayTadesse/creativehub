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
	engagementConfirmed: false,
	responseRate: null,
	onTimeRate: null,
	averageRating: 0,
	reviewsCount: 0,
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
	engagementConfirmed: true,
	responseRate: 100,
	onTimeRate: 100,
	averageRating: 5,
	reviewsCount: 30,
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
		/* From a verified profile rather than an empty one: with nothing assumed any
		   more, an empty profile sits under the published floor of 10, and a single
		   four-point signal would disappear into the clamp instead of showing. */
		const start: ScoreInput = { ...empty, verificationLevel: 'cn_verified' };
		const base = calculateScore(start);
		const single: Partial<ScoreInput>[] = [
			{ fullName: 'Sara T.' },
			{ bio: 'A bio comfortably longer than twenty characters.' },
			{ avatar: 'a.png' },
			{ cover: 'c.png' },
			{ categoryCount: 1 },
			{ languageCount: 1 },
			{ packageCount: 1 },
			{ portfolioCount: 1 },
			{ engagementRate: 6 },
			{ responseRate: 100 },
			{ onTimeRate: 100 },
			{ completedBookings: 4 }
		];

		for (const change of single) {
			const key = Object.keys(change)[0];
			expect(calculateScore({ ...start, ...change }), key).toBeGreaterThan(base);
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

describe('calculateScore — evidence, not defaults', () => {
	/*
	 * The rule the three lower buckets used to break: an empty signal was scored
	 * as an average one. A profile with nothing measured must score exactly what
	 * its completeness and verification earn, and not a point more.
	 */
	it('gives nothing for signals with no evidence behind them', () => {
		expect(calculateScore(empty)).toBe(10);
		expect(calculateScore({ ...empty, verificationLevel: 'cn_verified' })).toBe(25);
	});

	it('does not score an average rating that has no reviews behind it', () => {
		expect(calculateScore({ ...empty, averageRating: 4.9 })).toBe(calculateScore(empty));
	});

	it('scores a confirmed engagement rate at twice an unconfirmed one', () => {
		const base = { ...empty, verificationLevel: 'cn_verified' };
		const unconfirmed = calculateScore({ ...base, engagementRate: 10 }) - calculateScore(base);
		const confirmed =
			calculateScore({ ...base, engagementRate: 10, engagementConfirmed: true }) -
			calculateScore(base);
		expect(confirmed).toBe(15);
		expect(unconfirmed).toBe(8);
	});

	it('distinguishes a measured 0% response rate from no measurement only by nothing', () => {
		/* Both earn no points — but for different reasons, and the column keeps them apart. */
		expect(calculateScore({ ...empty, responseRate: 0 })).toBe(calculateScore(empty));
		expect(calculateScore({ ...empty, verificationLevel: 'cn_verified', responseRate: 100 })).toBe(
			40
		);
	});

	it('rises with the response rate and the share of deadlines met', () => {
		const base = { ...empty, verificationLevel: 'cn_verified' };
		const responses = [0, 50, 100].map((responseRate) => calculateScore({ ...base, responseRate }));
		const deadlines = [0, 50, 100].map((onTimeRate) => calculateScore({ ...base, onTimeRate }));
		expect(responses).toEqual([...responses].sort((a, b) => a - b));
		expect(new Set(responses).size).toBe(3);
		expect(deadlines).toEqual([...deadlines].sort((a, b) => a - b));
		expect(new Set(deadlines).size).toBe(3);
	});

	it('does not let one glowing review count as a reputation', () => {
		const base = { ...empty, verificationLevel: 'cn_verified', averageRating: 5 };
		const one = calculateScore({ ...base, reviewsCount: 1 });
		const three = calculateScore({ ...base, reviewsCount: 3 });
		const thirty = calculateScore({ ...base, reviewsCount: 30 });
		expect(one).toBeLessThan(three);
		expect(three).toBe(thirty);
	});

	it('reaches 100 with every signal at its best', () => {
		expect(calculateScore(full)).toBe(100);
	});

	it('clamps rates that arrive out of range rather than overpaying', () => {
		expect(calculateScore({ ...full, responseRate: 400, onTimeRate: 250, averageRating: 9 })).toBe(
			calculateScore(full)
		);
		expect(calculateScore({ ...empty, responseRate: -50 })).toBe(calculateScore(empty));
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
