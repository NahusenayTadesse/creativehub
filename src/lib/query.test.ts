import { describe, expect, it } from 'vitest';
import { PARAM, pageLink, pageWindow, toggleValue, withParams } from './query';

const at = (path: string, query = '') => new URL(`https://example.com${path}${query}`);

describe('withParams', () => {
	it('keeps the parameters it was not asked about', () => {
		const link = withParams(at('/discover', '?q=sara&country=3'), { sort: 'reach' });
		expect(link).toContain('q=sara');
		expect(link).toContain('country=3');
		expect(link).toContain('sort=reach');
	});

	it('drops a parameter set to nothing', () => {
		for (const empty of [null, undefined, '', false]) {
			expect(withParams(at('/discover', '?q=sara'), { q: empty })).toBe('/discover');
		}
	});

	it('keeps a deliberate zero', () => {
		expect(withParams(at('/discover'), { minReach: 0 })).toContain('minReach=0');
	});

	it('replaces a multi-value filter rather than appending to it', () => {
		const link = withParams(at('/discover', '?country=1&country=2'), { country: ['3'] });
		expect(link).toBe('/discover?country=3');
	});

	it('clears a multi-value filter when given an empty list', () => {
		expect(withParams(at('/discover', '?country=1&country=2'), { country: [] })).toBe('/discover');
	});

	/**
	 * The documented rule, and the one worth a test: changing anything except
	 * the page goes back to page one. Staying on page 7 of a result a new filter
	 * just cut to two pages shows an empty screen, and nothing on it says why.
	 */
	it('returns to page one whenever anything else changes', () => {
		expect(withParams(at('/discover', '?page=7'), { sort: 'reach' })).not.toContain('page=');
		expect(withParams(at('/discover', '?page=7&q=a'), { q: 'b' })).not.toContain('page=');
	});

	it('leaves the page alone when the page is what changed', () => {
		expect(withParams(at('/discover', '?q=a&page=7'), { [PARAM.page]: 3 })).toContain('page=3');
	});

	it('returns a bare path when nothing is left', () => {
		expect(withParams(at('/discover', '?q=sara'), { q: null })).toBe('/discover');
	});

	it('round-trips values that need escaping', () => {
		const link = withParams(at('/discover'), { q: "o'brien & sons 100%" });
		const parsed = new URL(link, 'https://example.com');
		expect(parsed.searchParams.get('q')).toBe("o'brien & sons 100%");
	});

	it('keeps the path it was given', () => {
		expect(withParams(at('/dashboard/bookings'), { tab: 'active' })).toMatch(
			/^\/dashboard\/bookings\?/
		);
	});
});

describe('pageLink', () => {
	it('omits the parameter for page one, so the first page has one URL', () => {
		expect(pageLink(at('/discover', '?q=a&page=4'), 1)).toBe('/discover?q=a');
	});

	it('keeps every other parameter', () => {
		const link = pageLink(at('/discover', '?q=a&sort=reach'), 3);
		expect(link).toContain('q=a');
		expect(link).toContain('sort=reach');
		expect(link).toContain('page=3');
	});
});

describe('toggleValue', () => {
	it('adds what is absent and removes what is present', () => {
		expect(toggleValue([], '1')).toEqual(['1']);
		expect(toggleValue(['1', '2'], '3')).toEqual(['1', '2', '3']);
		expect(toggleValue(['1', '2'], '1')).toEqual(['2']);
	});

	it('does not mutate what it was given', () => {
		const current = ['1'];
		toggleValue(current, '2');
		expect(current).toEqual(['1']);
	});

	it('returns to where it started after two toggles', () => {
		expect(toggleValue(toggleValue(['1', '2'], '3'), '3')).toEqual(['1', '2']);
	});
});

describe('pageWindow', () => {
	it('draws nothing for no pages and one entry for one', () => {
		expect(pageWindow(1, 0)).toEqual([]);
		expect(pageWindow(1, 1)).toEqual([1]);
	});

	it('draws every page while they all fit', () => {
		expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
	});

	it('always shows the first and last page', () => {
		for (const page of [1, 5, 50, 100]) {
			const window = pageWindow(page, 100);
			expect(window[0]).toBe(1);
			expect(window.at(-1)).toBe(100);
		}
	});

	it('elides the runs it skipped', () => {
		expect(pageWindow(50, 100)).toEqual([1, null, 49, 50, 51, null, 100]);
	});

	it('never repeats a page and never goes backwards', () => {
		for (const page of [1, 2, 3, 47, 99, 100]) {
			const numbers = pageWindow(page, 100).filter((n): n is number => n !== null);
			expect(new Set(numbers).size, `page ${page}`).toBe(numbers.length);
			expect(numbers, `page ${page}`).toEqual([...numbers].sort((a, b) => a - b));
		}
	});

	/* The control sitting still is the point: a pager that changes width as you
	   move through it makes the next button move out from under the cursor. */
	it('keeps a steady width through the middle of a long result', () => {
		const widths = [10, 20, 30, 40, 50].map((page) => pageWindow(page, 100).length);
		expect(new Set(widths).size).toBe(1);
	});
});
