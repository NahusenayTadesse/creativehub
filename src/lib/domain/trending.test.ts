import { describe, expect, it } from 'vitest';
import {
	LOCAL_FIRST_BONUS,
	TRENDING_SIGNALS,
	compareCandidates,
	decayWeight,
	localBonus,
	matchesLocation,
	newcomerValue,
	normalizeValues,
	positionScore,
	scoreCandidates,
	verificationValue,
	type ScoredCandidate,
	type SignalValues,
	type TrendingWeights
} from './trending';

const zeroValues = (): SignalValues =>
	Object.fromEntries(TRENDING_SIGNALS.map((key) => [key, 0])) as SignalValues;

const values = (overrides: Partial<SignalValues>): SignalValues => ({
	...zeroValues(),
	...overrides
});

const weights = (overrides: Partial<TrendingWeights>): TrendingWeights =>
	({
		...(Object.fromEntries(TRENDING_SIGNALS.map((key) => [key, 0])) as TrendingWeights),
		...overrides
	}) as TrendingWeights;

describe('decayWeight', () => {
	it('counts something that happened just now in full', () => {
		expect(decayWeight(0, 7)).toBe(1);
	});

	it('halves at exactly one half-life', () => {
		expect(decayWeight(7, 7)).toBeCloseTo(0.5, 10);
		expect(decayWeight(14, 7)).toBeCloseTo(0.25, 10);
	});

	it('counts everything flat when decay is switched off', () => {
		expect(decayWeight(0, 0)).toBe(1);
		expect(decayWeight(365, 0)).toBe(1);
		expect(decayWeight(365, -1)).toBe(1);
	});

	it('never rewards a future timestamp with more than the present', () => {
		expect(decayWeight(-100, 7)).toBe(1);
	});

	it('decreases monotonically with age', () => {
		const series = [0, 1, 3, 7, 30, 90].map((days) => decayWeight(days, 7));
		expect(series).toEqual([...series].sort((a, b) => b - a));
	});
});

describe('verificationValue', () => {
	it('orders the levels as the ladder does', () => {
		expect(verificationValue('cn_verified')).toBeGreaterThan(
			verificationValue('identity_verified')
		);
		expect(verificationValue('identity_verified')).toBeGreaterThan(
			verificationValue('social_verified')
		);
		expect(verificationValue('social_verified')).toBeGreaterThan(verificationValue('unverified'));
	});

	it('treats anything it does not recognise as unverified', () => {
		for (const level of ['', 'gold', '__proto__', 'constructor']) {
			expect(verificationValue(level), level).toBe(0);
		}
	});

	it('stays inside 0–1', () => {
		for (const level of ['cn_verified', 'identity_verified', 'social_verified', 'nonsense']) {
			const value = verificationValue(level);
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThanOrEqual(1);
		}
	});
});

describe('newcomerValue', () => {
	it('is strongest on the day a profile appears and gone at the horizon', () => {
		expect(newcomerValue(0)).toBe(1);
		expect(newcomerValue(45)).toBeCloseTo(0.5, 10);
		expect(newcomerValue(90)).toBe(0);
		expect(newcomerValue(900)).toBe(0);
	});

	it('is switched off rather than dividing by zero', () => {
		expect(newcomerValue(10, 0)).toBe(0);
		expect(newcomerValue(10, -5)).toBe(0);
	});
});

describe('normalizeValues', () => {
	it('maps a spread onto the full range with min–max', () => {
		expect(normalizeValues([0, 5, 10], 'minmax')).toEqual([0, 0.5, 1]);
	});

	/* The documented choice: a signal that cannot tell candidates apart must not
	   silently discard the weight an operator gave it, nor invent an ordering. */
	it('maps a constant non-zero signal to a flat midpoint', () => {
		expect(normalizeValues([7, 7, 7], 'minmax')).toEqual([0.5, 0.5, 0.5]);
		expect(normalizeValues([7, 7, 7], 'percentile')).toEqual([0.5, 0.5, 0.5]);
	});

	it('maps an all-zero signal to zero, not a midpoint', () => {
		expect(normalizeValues([0, 0, 0], 'minmax')).toEqual([0, 0, 0]);
	});

	it('handles the degenerate pool sizes', () => {
		expect(normalizeValues([], 'minmax')).toEqual([]);
		expect(normalizeValues([5], 'minmax')).toEqual([1]);
		expect(normalizeValues([0], 'minmax')).toEqual([0]);
	});

	it('gives ties the same percentile instead of splitting them by row order', () => {
		const out = normalizeValues([10, 10, 20, 5], 'percentile');
		expect(out[0]).toBe(out[1]);
		expect(out[3]).toBeLessThan(out[0]);
		expect(out[2]).toBeGreaterThan(out[0]);
	});

	it('keeps real distances under min–max and discards them under percentile', () => {
		const raw = [1, 2, 100];
		const minmax = normalizeValues(raw, 'minmax');
		const percentile = normalizeValues(raw, 'percentile');
		/* The outlier is far away by distance and merely "last" by rank. */
		expect(minmax[1] - minmax[0]).toBeLessThan(0.02);
		expect(percentile[1] - percentile[0]).toBeCloseTo(0.5, 10);
	});

	it('stays inside 0–1 for both methods', () => {
		for (const method of ['minmax', 'percentile'] as const) {
			for (const value of normalizeValues([-50, 0, 3, 999], method)) {
				expect(value).toBeGreaterThanOrEqual(0);
				expect(value).toBeLessThanOrEqual(1);
			}
		}
	});
});

describe('scoreCandidates', () => {
	const pool = [
		{ creatorId: 1, values: values({ reach: 100, rating: 5 }) },
		{ creatorId: 2, values: values({ reach: 50, rating: 3 }) },
		{ creatorId: 3, values: values({ reach: 0, rating: 1 }) }
	];

	it('returns nothing for an empty pool', () => {
		expect(
			scoreCandidates([], { weights: weights({ reach: 1 }), normalization: 'minmax' })
		).toEqual([]);
	});

	/**
	 * The property the trending screen is built on: weights are ratios, not
	 * percentages. Doubling every slider must change no score at all — otherwise
	 * raising one signal quietly steals from the other nine.
	 */
	it('is invariant to the scale of the weights', () => {
		const options = { normalization: 'minmax' } as const;
		const single = scoreCandidates(pool, { ...options, weights: weights({ reach: 3, rating: 1 }) });
		const doubled = scoreCandidates(pool, {
			...options,
			weights: weights({ reach: 6, rating: 2 })
		});
		const huge = scoreCandidates(pool, {
			...options,
			weights: weights({ reach: 300, rating: 100 })
		});

		expect(doubled.map((c) => c.score)).toEqual(single.map((c) => c.score));
		expect(huge.map((c) => c.score)).toEqual(single.map((c) => c.score));
	});

	it('ignores a signal whose weight is zero', () => {
		const withRating = scoreCandidates(pool, {
			weights: weights({ reach: 1, rating: 0 }),
			normalization: 'minmax'
		});
		expect(withRating[0].components.map((c) => c.key)).toEqual(['reach']);
	});

	it('makes the shares of the active signals sum to one', () => {
		const [first] = scoreCandidates(pool, {
			weights: weights({ reach: 2, rating: 1, saves: 1 }),
			normalization: 'minmax'
		});
		const total = first.components.reduce((sum, component) => sum + component.share, 0);
		expect(total).toBeCloseTo(1, 3);
	});

	it('adds the contributions up to the base score', () => {
		for (const candidate of scoreCandidates(pool, {
			weights: weights({ reach: 2, rating: 1 }),
			normalization: 'minmax'
		})) {
			const sum = candidate.components.reduce((total, c) => total + c.contribution, 0);
			expect(candidate.baseScore).toBeCloseTo(sum, 2);
		}
	});

	it('tops out at 100 before any boost is applied', () => {
		const scored = scoreCandidates(pool, {
			weights: weights({ reach: 1, rating: 1 }),
			normalization: 'minmax'
		});
		for (const candidate of scored) expect(candidate.baseScore).toBeLessThanOrEqual(100);
	});

	/* A boost is an operator saying "put this one higher", and two competing
	   boosts have to stay distinguishable — clamping at 100 would flatten them. */
	it('lets a boost carry a score past 100', () => {
		const [boosted] = scoreCandidates(
			[{ creatorId: 1, values: values({ reach: 100 }), multiplier: 1.5 }],
			{ weights: weights({ reach: 1 }), normalization: 'minmax' }
		);
		expect(boosted.score).toBeCloseTo(boosted.baseScore * 1.5, 2);
		expect(boosted.score).toBeGreaterThan(100);
	});

	it('survives a weight set that is entirely zero', () => {
		const scored = scoreCandidates(pool, {
			weights: weights({}),
			normalization: 'minmax'
		});
		expect(scored).toHaveLength(3);
		for (const candidate of scored) expect(candidate.score).toBe(0);
	});
});

describe('compareCandidates', () => {
	const candidate = (over: Partial<ScoredCandidate>): ScoredCandidate => ({
		creatorId: 1,
		score: 0,
		baseScore: 0,
		multiplier: 1,
		values: zeroValues(),
		components: [],
		...over
	});

	it('puts the higher board score first', () => {
		expect(compareCandidates(candidate({ score: 90 }), candidate({ score: 10 }))).toBeLessThan(0);
	});

	it('breaks a tie on the platform score', () => {
		const a = candidate({ creatorId: 1, score: 50, values: values({ score: 80 }) });
		const b = candidate({ creatorId: 2, score: 50, values: values({ score: 40 }) });
		expect(compareCandidates(a, b)).toBeLessThan(0);
	});

	/**
	 * The reason the last tiebreak exists: without a *total* order, two identical
	 * candidates swap places on every recompute and the homepage strip reshuffles
	 * for no reason anyone can explain.
	 */
	it('is a total order — identical candidates still have a stable sequence', () => {
		const pool = [3, 1, 2].map((creatorId) => candidate({ creatorId, score: 50 }));
		const once = [...pool].sort(compareCandidates).map((c) => c.creatorId);
		const again = [...pool]
			.reverse()
			.sort(compareCandidates)
			.map((c) => c.creatorId);
		expect(once).toEqual([1, 2, 3]);
		expect(again).toEqual(once);
	});
});

const at = (
	countryId: number | null,
	regionId: number | null = null,
	city: string | null = null
) => ({
	countryId,
	regionId,
	city
});

describe('matchesLocation', () => {
	it('matches on the country when that is the level asked for', () => {
		expect(matchesLocation(at(1), at(1), 'country')).toBe(true);
		expect(matchesLocation(at(2), at(1), 'country')).toBe(false);
	});

	it('ignores a shared region when only the country is being matched', () => {
		expect(matchesLocation(at(2, 9), at(1, 9), 'country')).toBe(false);
	});

	it('demands the same region at region level', () => {
		expect(matchesLocation(at(1, 9), at(1, 9), 'region')).toBe(true);
		expect(matchesLocation(at(1, 8), at(1, 9), 'region')).toBe(false);
	});

	it('demands the same city at city level, however it was typed', () => {
		expect(matchesLocation(at(1, 9, 'Addis Ababa'), at(1, 9, ' addis ababa '), 'city')).toBe(true);
		expect(matchesLocation(at(1, 9, 'Adama'), at(1, 9, 'Addis Ababa'), 'city')).toBe(false);
	});

	/* The fallbacks are the point: a reader we know less about should get a
	   wider match, not an empty one. */
	it('falls back to the region for a reader with no city', () => {
		expect(matchesLocation(at(1, 9, 'Adama'), at(1, 9, null), 'city')).toBe(true);
		expect(matchesLocation(at(1, 8, 'Adama'), at(1, 9, null), 'city')).toBe(false);
	});

	it('falls back to the country for a reader with neither', () => {
		expect(matchesLocation(at(1, 8), at(1, null), 'city')).toBe(true);
		expect(matchesLocation(at(1, 8), at(1, null), 'region')).toBe(true);
		expect(matchesLocation(at(2, 8), at(1, null), 'region')).toBe(false);
	});

	it('matches nobody when the reader location is unknown', () => {
		expect(matchesLocation(at(1, 9, 'Addis Ababa'), at(null), 'country')).toBe(false);
		expect(matchesLocation(at(null), at(null), 'country')).toBe(false);
	});
});

describe('localBonus', () => {
	it('is worth nothing when the setting is off, local or not', () => {
		expect(localBonus(true, 'off', 40)).toBe(0);
		expect(localBonus(false, 'off', 40)).toBe(0);
	});

	it('is worth nothing to a creator who is not local', () => {
		expect(localBonus(false, 'boost', 40)).toBe(0);
		expect(localBonus(false, 'first', 40)).toBe(0);
	});

	it('pays the configured points in boost', () => {
		expect(localBonus(true, 'boost', 15)).toBe(15);
		expect(localBonus(true, 'boost', -5)).toBe(0);
	});

	it('outruns any real score in first, whatever the points say', () => {
		expect(localBonus(true, 'first', 0)).toBeGreaterThan(100);
		expect(localBonus(true, 'first', 0)).toBe(LOCAL_FIRST_BONUS);
	});
});

describe('positionScore', () => {
	it('runs from 100 at the top of the board to 0 at the bottom', () => {
		expect(positionScore(1, 12)).toBe(100);
		expect(positionScore(12, 12)).toBe(0);
	});

	it('decreases with every step down the board', () => {
		const series = [1, 2, 3, 4].map((rank) => positionScore(rank, 12));
		expect(series).toEqual([...series].sort((a, b) => b - a));
	});

	it('gives a one-creator board the top score rather than dividing by zero', () => {
		expect(positionScore(1, 1)).toBe(100);
	});

	/* What the two settings are meant to feel like, in the units they share. */
	it('lets a boost lift a local creator past a nearby stranger but not the leader', () => {
		const boost = 15;
		expect(positionScore(4, 12) + boost).toBeGreaterThan(positionScore(3, 12));
		expect(positionScore(4, 12) + boost).toBeLessThan(positionScore(1, 12));
	});

	it('lets first put the last local creator above the leader', () => {
		expect(positionScore(12, 12) + LOCAL_FIRST_BONUS).toBeGreaterThan(positionScore(1, 12));
	});
});
