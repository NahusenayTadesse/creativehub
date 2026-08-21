import { describe, expect, it } from 'vitest';
import { ADJACENT_CATEGORIES, calculateMatch, type MatchInput } from './match';

const campaign = (over: Partial<MatchInput['campaign']> = {}): MatchInput['campaign'] => ({
	categoryId: 1,
	platformIds: [10],
	countryId: 100,
	targetRegions: [],
	budgetMax: 20_000,
	followerMin: 1_000,
	followerMax: 100_000,
	compensationType: 'paid',
	categoryName: 'Technology',
	...over
});

const creator = (over: Partial<MatchInput['creator']> = {}): MatchInput['creator'] => ({
	categoryIds: [1],
	categories: ['Technology'],
	platformIds: [10],
	platformId: 10,
	platformName: 'TikTok',
	countryId: 100,
	countryName: 'Ethiopia',
	regionName: 'Addis Ababa',
	city: 'Addis Ababa',
	startingPrice: 8_000,
	totalReach: 50_000,
	engagementRate: 7,
	averageRating: 4.7,
	completedBookings: 6,
	verificationLevel: 'identity_verified',
	overseasPercentage: 10,
	topCountries: [],
	...over
});

const score = (over: Partial<MatchInput> = {}) =>
	calculateMatch({ campaign: campaign(), creator: creator(), ...over });

describe('calculateMatch', () => {
	it('stays inside its documented range whatever it is fed', () => {
		const extremes: MatchInput[] = [
			{ campaign: campaign(), creator: creator() },
			{
				campaign: campaign({ categoryId: null, platformIds: [], budgetMax: 0 }),
				creator: creator({
					categoryIds: [],
					platformIds: [],
					platformId: null,
					countryId: null,
					startingPrice: 0,
					totalReach: 0,
					engagementRate: 0,
					averageRating: 0,
					completedBookings: 0,
					verificationLevel: '',
					overseasPercentage: 0
				})
			},
			{
				campaign: campaign({ budgetMax: 10_000_000 }),
				creator: creator({
					engagementRate: 99,
					averageRating: 5,
					completedBookings: 500,
					verificationLevel: 'cn_verified',
					overseasPercentage: 90,
					startingPrice: 1
				})
			}
		];

		for (const input of extremes) {
			const result = calculateMatch(input);
			expect(result.total).toBeGreaterThanOrEqual(15);
			expect(result.total).toBeLessThanOrEqual(100);
			expect(Number.isInteger(result.total)).toBe(true);
		}
	});

	it('is deterministic — the same input always scores the same', () => {
		const input: MatchInput = { campaign: campaign(), creator: creator() };
		const runs = Array.from({ length: 5 }, () => calculateMatch(input).total);
		expect(new Set(runs).size).toBe(1);
	});

	it('keeps every factor inside its own ceiling', () => {
		const result = score();
		expect(result.niche).toBeLessThanOrEqual(25);
		expect(result.demographics).toBeLessThanOrEqual(25);
		expect(result.performance).toBeLessThanOrEqual(25);
		expect(result.platform).toBeLessThanOrEqual(15);
		expect(result.budget).toBeLessThanOrEqual(10);
	});

	it('ranks direct, adjacent and unrelated niches in that order', () => {
		const direct = score().niche;
		const adjacent = calculateMatch({
			campaign: campaign(),
			creator: creator({ categoryIds: [2] }),
			adjacentCategoryIds: [2]
		}).niche;
		const unrelated = calculateMatch({
			campaign: campaign(),
			creator: creator({ categoryIds: [9] })
		}).niche;

		expect(direct).toBeGreaterThan(adjacent);
		expect(adjacent).toBeGreaterThan(unrelated);
	});

	it('rewards the campaign’s own channel over merely having it', () => {
		const primary = score().platform;
		const secondary = calculateMatch({
			campaign: campaign({ platformIds: [10, 11] }),
			creator: creator({ platformId: 11, platformIds: [11, 10] })
		}).platform;
		const absent = calculateMatch({
			campaign: campaign({ platformIds: [99] }),
			creator: creator()
		}).platform;

		expect(primary).toBeGreaterThanOrEqual(secondary);
		expect(secondary).toBeGreaterThan(absent);
	});

	it('scores budget headroom monotonically as the price rises', () => {
		const prices = [5_000, 18_000, 24_000, 90_000];
		const budgets = prices.map(
			(startingPrice) =>
				calculateMatch({
					campaign: campaign({ budgetMax: 20_000 }),
					creator: creator({ startingPrice })
				}).budget
		);
		expect(budgets).toEqual([...budgets].sort((a, b) => b - a));
	});

	it('uses the follower bracket instead of price for a non-paid brief', () => {
		const inside = calculateMatch({
			campaign: campaign({ compensationType: 'barter' }),
			creator: creator({ totalReach: 50_000, startingPrice: 999_999 })
		}).budget;
		const outside = calculateMatch({
			campaign: campaign({ compensationType: 'barter' }),
			creator: creator({ totalReach: 10, startingPrice: 0 })
		}).budget;

		expect(inside).toBeGreaterThan(outside);
	});

	it('gives the tier the score deserves, and a label to go with it', () => {
		const tiers = new Set<string>();
		for (const engagementRate of [0, 4, 6, 9]) {
			for (const startingPrice of [1_000, 25_000, 90_000]) {
				const result = calculateMatch({
					campaign: campaign(),
					creator: creator({ engagementRate, startingPrice })
				});
				tiers.add(result.tier);

				if (result.total >= 90) expect(result.tier).toBe('exceptional');
				else if (result.total >= 80) expect(result.tier).toBe('strong');
				else if (result.total >= 65) expect(result.tier).toBe('moderate');
				else expect(result.tier).toBe('low');

				expect(result.tierLabel.length).toBeGreaterThan(0);
			}
		}
		expect(tiers.size).toBeGreaterThan(1);
	});

	it('always explains itself with at least one synergy', () => {
		expect(score().synergies.length).toBeGreaterThan(0);
	});
});

describe('ADJACENT_CATEGORIES', () => {
	it('is symmetric — adjacency that only runs one way is a typo', () => {
		for (const [slug, neighbours] of Object.entries(ADJACENT_CATEGORIES)) {
			for (const neighbour of neighbours) {
				expect(
					ADJACENT_CATEGORIES[neighbour],
					`${neighbour} is missing from the table entirely`
				).toBeDefined();
				expect(ADJACENT_CATEGORIES[neighbour], `${neighbour} does not list ${slug} back`).toContain(
					slug
				);
			}
		}
	});

	it('never lists a category as adjacent to itself', () => {
		for (const [slug, neighbours] of Object.entries(ADJACENT_CATEGORIES)) {
			expect(neighbours, slug).not.toContain(slug);
		}
	});

	it('has no duplicate neighbours', () => {
		for (const [slug, neighbours] of Object.entries(ADJACENT_CATEGORIES)) {
			expect(new Set(neighbours).size, slug).toBe(neighbours.length);
		}
	});
});
