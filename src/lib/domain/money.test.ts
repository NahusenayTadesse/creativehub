import { describe, expect, it } from 'vitest';
import { buildRates, convert, formatReach, type Rate } from './money';

const COUNTRIES = [
	{ currencyCode: 'ETB', currencySymbol: 'Br', flag: '🇪🇹', usdRate: 130, name: 'Ethiopia' },
	{ currencyCode: 'KES', currencySymbol: 'KSh', flag: '🇰🇪', usdRate: 129, name: 'Kenya' },
	{ currencyCode: 'GBP', currencySymbol: '£', flag: '🇬🇧', usdRate: 0.79, name: 'United Kingdom' }
];

const rates: Record<string, Rate> = buildRates(COUNTRIES);

describe('buildRates', () => {
	it('always carries USD, even for a country list that never mentions it', () => {
		expect(buildRates([]).USD).toMatchObject({ code: 'USD', usdRate: 1 });
		expect(rates.USD.usdRate).toBe(1);
	});

	it('keys every country by its currency code', () => {
		expect(Object.keys(rates).sort()).toEqual(['ETB', 'GBP', 'KES', 'USD']);
	});
});

describe('convert', () => {
	it('leaves an amount alone when the codes match', () => {
		expect(convert(12_000, 'ETB', 'ETB', rates)).toBe(12_000);
	});

	it('converts through USD', () => {
		/* 13,000 ETB ÷ 130 = 100 USD × 0.79 = 79 GBP */
		expect(convert(13_000, 'ETB', 'GBP', rates)).toBeCloseTo(79, 6);
	});

	it('round-trips back to where it started', () => {
		const there = convert(50_000, 'ETB', 'KES', rates);
		expect(convert(there, 'KES', 'ETB', rates)).toBeCloseTo(50_000, 6);
	});

	/* An unknown code must not silently become zero on an invoice line. */
	it('returns the amount untouched rather than guessing', () => {
		expect(convert(500, 'XXX', 'ETB', rates)).toBe(500);
		expect(convert(500, 'ETB', 'XXX', rates)).toBe(500);
	});

	it('is not fooled by inherited keys', () => {
		for (const key of ['__proto__', 'constructor', 'toString']) {
			expect(convert(500, key, 'ETB', rates), key).toBe(500);
			expect(convert(500, 'ETB', key, rates), key).toBe(500);
		}
	});

	it('does not divide by a zero rate', () => {
		const broken = buildRates([
			{ currencyCode: 'ZWL', currencySymbol: 'Z$', flag: '🇿🇼', usdRate: 0, name: 'Zimbabwe' }
		]);
		expect(convert(100, 'ZWL', 'USD', broken)).toBe(100);
	});
});

describe('formatReach', () => {
	it('leaves small numbers alone', () => {
		expect(formatReach(0)).toBe('0');
		expect(formatReach(940)).toBe('940');
	});

	it('switches unit at each thousand', () => {
		expect(formatReach(1_000)).toBe('1K');
		expect(formatReach(420_000)).toBe('420K');
		expect(formatReach(999_999)).toBe('1000K');
		expect(formatReach(1_000_000)).toBe('1.0M');
		expect(formatReach(1_200_000)).toBe('1.2M');
	});

	it('never returns an empty string', () => {
		for (const value of [0, 1, 999, 1_000, 1_000_000, 987_654_321]) {
			expect(formatReach(value).length).toBeGreaterThan(0);
		}
	});
});
