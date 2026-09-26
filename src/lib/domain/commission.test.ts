import { describe, expect, it } from 'vitest';
import {
	DEFAULT_COMMISSION,
	DEFAULT_TIERS,
	normaliseTiers,
	projectSizeProblem,
	quoteDeal,
	tierFor
} from './commission';

describe('tierFor', () => {
	it('reads the rate card as flat brackets with inclusive ceilings', () => {
		expect(tierFor(5_000, DEFAULT_TIERS).percent).toBe(15);
		expect(tierFor(100_000, DEFAULT_TIERS).percent).toBe(15);
		expect(tierFor(100_001, DEFAULT_TIERS).percent).toBe(12);
		expect(tierFor(500_000, DEFAULT_TIERS).percent).toBe(12);
		expect(tierFor(500_001, DEFAULT_TIERS).percent).toBe(10);
		expect(tierFor(1_500_000, DEFAULT_TIERS).percent).toBe(10);
		expect(tierFor(1_500_001, DEFAULT_TIERS).percent).toBe(8);
		expect(tierFor(90_000_000, DEFAULT_TIERS).percent).toBe(8);
	});
});

describe('quoteDeal', () => {
	it('charges the whole price at its bracket, not marginally', () => {
		const quote = quoteDeal(200_000);
		expect(quote.commissionPercent).toBe(12);
		expect(quote.commission).toBe(24_000);
		expect(quote.creatorPayout).toBe(176_000);
	});

	it('applies the floor to a small deal', () => {
		const quote = quoteDeal(8_000);
		/* 15% would be 1,200; the minimum is 1,500. */
		expect(quote.commission).toBe(1_500);
		expect(quote.minimumApplied).toBe(true);
		expect(quote.creatorPayout).toBe(6_500);
	});

	it('adds the brand service fee and its VAT on top of the price', () => {
		const quote = quoteDeal(100_000);
		expect(quote.brandServiceFee).toBe(5_000);
		expect(quote.brandServiceFeeVat).toBe(750);
		expect(quote.brandTotal).toBe(105_750);
		expect(quote.platformRevenue).toBe(15_000 + 5_000);
	});

	it('charges no VAT when the platform is not registered', () => {
		const quote = quoteDeal(100_000, { ...DEFAULT_COMMISSION, vatRegistered: false });
		expect(quote.brandServiceFeeVat).toBe(0);
		expect(quote.brandTotal).toBe(105_000);
	});

	it('takes a level discount off the rate, never below zero', () => {
		expect(quoteDeal(200_000, DEFAULT_COMMISSION, { discountPoints: 1 }).commissionPercent).toBe(
			11
		);
		expect(quoteDeal(200_000, DEFAULT_COMMISSION, { discountPoints: 40 }).commissionPercent).toBe(
			0
		);
	});

	it('costs and earns nothing on a deal with no price', () => {
		const quote = quoteDeal(0);
		expect(quote.commission).toBe(0);
		expect(quote.brandTotal).toBe(0);
	});

	it('never takes more than the price', () => {
		const quote = quoteDeal(1_000);
		expect(quote.commission).toBe(1_000);
		expect(quote.creatorPayout).toBe(0);
	});
});

describe('normaliseTiers', () => {
	it('sorts, dedupes and closes a stored list', () => {
		expect(
			normaliseTiers([
				{ upTo: 500_000, percent: 12 },
				{ upTo: 100_000, percent: 15 },
				{ upTo: 100_000, percent: 99 }
			])
		).toEqual([
			{ upTo: 100_000, percent: 15 },
			{ upTo: 500_000, percent: 12 },
			{ upTo: null, percent: 12 }
		]);
	});

	it('reads JSON text and falls back to the rate card on nonsense', () => {
		expect(normaliseTiers(JSON.stringify(DEFAULT_TIERS))).toEqual(DEFAULT_TIERS);
		expect(normaliseTiers('not json')).toEqual(DEFAULT_TIERS);
		expect(normaliseTiers(null)).toEqual(DEFAULT_TIERS);
		expect(normaliseTiers([{ upTo: 5, percent: 'x' }])).toEqual(DEFAULT_TIERS);
	});
});

describe('projectSizeProblem', () => {
	it('holds paid deals to the minimum and nothing else', () => {
		expect(projectSizeProblem(4_999, 'paid', DEFAULT_COMMISSION)).toBe('below_minimum');
		expect(projectSizeProblem(5_000, 'paid', DEFAULT_COMMISSION)).toBeNull();
		expect(projectSizeProblem(0, 'barter', DEFAULT_COMMISSION)).toBeNull();
	});
});
