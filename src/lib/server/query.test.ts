import { beforeAll, describe, expect, it, vi } from 'vitest';

/*
 * `query.ts` imports the connection pool at module load, and none of what is
 * tested here touches it: `parse` turns a URL into validated state and emits no
 * SQL. Stubbing the module is what lets these run without a database, which is
 * what lets them run in CI on every push.
 */
vi.mock('$lib/server/db', () => ({ db: {} }));

import * as t from './schema-under-test';
import { defineQuery, type Filter } from './query';

/**
 * The two rules `query.ts` documents, as tests.
 *
 * 1. Nothing reaches SQL that the definition did not name.
 * 2. Ownership is not a filter — it comes from the caller, never the URL.
 *
 * Rule 1 is the one that has actually broken. `?sort=__proto__` was a 500 on
 * every listing in the app including two public ones, and `?tab=constructor`
 * threw before any query ran, both because `in` and plain truthiness answer for
 * every key on `Object.prototype`. Those two cases are the reason this file
 * exists; the rest guard the same seam elsewhere.
 */

const BOOKING_TABS = {
	all: [] as string[],
	active: ['booked', 'in_production', 'submitted'],
	closed: ['completed', 'cancelled']
};

const definition = () =>
	defineQuery({
		table: t.bookings,
		columns: { id: t.bookings.id, title: t.bookings.title },
		search: [t.bookings.title],
		filters: {
			tab: { type: 'group', column: t.bookings.status, groups: BOOKING_TABS },
			escrow: {
				type: 'enum',
				column: t.bookings.escrowStatus,
				values: ['unfunded', 'held', 'released']
			},
			currency: {
				type: 'enums',
				column: t.bookings.currencyCode,
				values: ['ETB', 'USD', 'KES']
			},
			creator: { type: 'number', column: t.bookings.creatorId },
			creators: { type: 'numbers', column: t.bookings.creatorId },
			reference: { type: 'text', column: t.bookings.reference },
			minPrice: { type: 'min', column: t.bookings.price },
			maxPrice: { type: 'max', column: t.bookings.price },
			flagged: { type: 'flag', column: t.bookings.isActive }
		} satisfies Record<string, Filter>,
		sort: {
			newest: { column: t.bookings.createdAt, direction: 'desc' },
			value: { column: t.bookings.price, direction: 'desc' }
		},
		defaultSort: 'newest',
		tiebreaker: t.bookings.id
	});

let query: ReturnType<typeof definition>;
beforeAll(() => {
	query = definition();
});

const parse = (search: string) => query.parse(new URL(`https://x.test/l${search}`).searchParams);

/** The keys every object literal inherits, and no definition ever declares. */
const INHERITED = ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty'];

describe('sort', () => {
	it('accepts a sort the definition declared', () => {
		expect(parse('?sort=value').sortKey).toBe('value');
	});

	it('falls back to the default for one it did not', () => {
		expect(parse('?sort=nonsense').sortKey).toBe('newest');
		expect(parse('').sortKey).toBe('newest');
	});

	/* H1: `requestedSort in sort` answered true for every inherited key, and
	   `desc(Object.prototype)` is a TypeError — a 500 anyone could produce on a
	   public URL, on demand, at zero cost. */
	it.each(INHERITED)('does not accept the inherited key %s', (key) => {
		expect(parse(`?sort=${key}`).sortKey).toBe('newest');
	});

	it('takes the direction from the URL when it is one of the two', () => {
		expect(parse('?sort=value&dir=asc').direction).toBe('asc');
		expect(parse('?sort=value&dir=desc').direction).toBe('desc');
	});

	it('ignores a direction that is neither', () => {
		expect(parse('?sort=value&dir=sideways').direction).toBe('desc');
	});
});

describe('group filters', () => {
	it('accepts a declared group', () => {
		expect(parse('?tab=active').state.filters.tab).toEqual(['active']);
	});

	it('keeps an "all" group as state without narrowing anything', () => {
		const { state, filterConditions } = parse('?tab=all');
		expect(state.filters.tab).toEqual(['all']);
		expect(filterConditions.has('tab')).toBe(false);
	});

	it('drops a group nobody declared', () => {
		expect(parse('?tab=nonsense').state.filters.tab).toBeUndefined();
	});

	/*
	 * H2, in both of its halves. `groups.constructor` is a function: truthy, so
	 * the `!members` guard let it through, and `[...members]` then threw.
	 * `groups.toString` has arity 0, so `members.length` read as the "all" tab —
	 * the quieter half, where the filter was silently dropped while the page
	 * still rendered a tab that does not exist as though it were selected.
	 */
	it.each(INHERITED)('does not accept the inherited group %s', (key) => {
		const { state, filterConditions } = parse(`?tab=${key}`);
		expect(state.filters.tab).toBeUndefined();
		expect(filterConditions.has('tab')).toBe(false);
	});
});

describe('enum filters', () => {
	it('accepts a value from the declared vocabulary', () => {
		expect(parse('?escrow=held').state.filters.escrow).toEqual(['held']);
	});

	it('drops a value outside it rather than passing it through', () => {
		expect(parse('?escrow=nonsense').state.filters.escrow).toBeUndefined();
		expect(parse('?escrow=__proto__').state.filters.escrow).toBeUndefined();
	});

	it('keeps only the declared members of a multi-value filter', () => {
		expect(parse('?currency=ETB,nonsense,USD').state.filters.currency).toEqual(['ETB', 'USD']);
	});

	it('drops the filter entirely when nothing survives', () => {
		expect(parse('?currency=aaa,bbb').state.filters.currency).toBeUndefined();
	});
});

describe('numeric filters', () => {
	it('reads an integer', () => {
		expect(parse('?creator=42').state.filters.creator).toEqual(['42']);
	});

	it('truncates rather than rejecting a decimal', () => {
		expect(parse('?creator=42.9').state.filters.creator).toEqual(['42']);
	});

	it('drops something that is not a number at all', () => {
		expect(parse('?creator=abc').state.filters.creator).toBeUndefined();
		expect(parse('?creator=').state.filters.creator).toBeUndefined();
	});

	/* M4: `Number.isFinite(1e21)` is true, and `String(1e21 * 24)` is
	   `2.4e+22`, which is not valid SQL — the one numeric parameter with no
	   ceiling turned a crafted URL into a 500. */
	it('drops a value too large to survive being stringified', () => {
		expect(parse('?creator=1e21').state.filters.creator).toBeUndefined();
		expect(parse('?creator=9007199254740993').state.filters.creator).toBeUndefined();
	});

	it('reads either spelling of a multi-value list', () => {
		expect(parse('?creators=1,2,3').state.filters.creators).toEqual(['1', '2', '3']);
		expect(parse('?creators=1&creators=2').state.filters.creators).toEqual(['1', '2']);
	});

	it('accepts bounds and rejects bounds that are not numbers', () => {
		expect(parse('?minPrice=1000').state.filters.minPrice).toEqual(['1000']);
		expect(parse('?maxPrice=abc').state.filters.maxPrice).toBeUndefined();
	});
});

describe('flag filters', () => {
	it('is on only for the spellings that mean yes', () => {
		for (const on of ['1', 'true', 'TRUE', 'yes', 'on']) {
			expect(parse(`?flagged=${on}`).state.filters.flagged, on).toEqual(['1']);
		}
	});

	it('is off for anything else, including a deliberate no', () => {
		for (const off of ['0', 'false', 'no', 'nonsense']) {
			expect(parse(`?flagged=${off}`).state.filters.flagged, off).toBeUndefined();
		}
	});
});

describe('search', () => {
	it('keeps the accepted text on the state so a box can show it', () => {
		expect(parse('?q=telebirr').state.search).toBe('telebirr');
	});

	it('is empty when nothing was searched', () => {
		expect(parse('').state.search).toBe('');
		expect(parse('?q=%20%20').state.search).toBe('');
	});

	it('makes one condition per word, so a second word narrows', () => {
		expect(parse('?q=one').searchConditions).toHaveLength(1);
		expect(parse('?q=one%20two%20three').searchConditions).toHaveLength(3);
	});

	it('caps how many words reach the query', () => {
		expect(parse('?q=a+b+c+d+e+f+g+h+i+j').searchConditions.length).toBeLessThanOrEqual(6);
	});

	it('caps how long the text can be', () => {
		expect(parse(`?q=${'x'.repeat(500)}`).state.search.length).toBeLessThanOrEqual(120);
	});

	it('accepts text that would be dangerous unescaped', () => {
		for (const text of ["o'brien", "%25' or '1'='1", 'a%22b', 'ሰላም']) {
			expect(() => parse(`?q=${encodeURIComponent(text)}`)).not.toThrow();
		}
	});
});

describe('unrecognised parameters', () => {
	it('are dropped rather than carried anywhere near SQL', () => {
		const { state, filterConditions } = parse('?somethingElse=1&drop=table&__proto__=x');
		expect(Object.keys(state.filters)).toEqual([]);
		expect(filterConditions.size).toBe(0);
	});
});

describe('facet', () => {
	/* L3: a custom filter matches on whatever `build` decides, so grouping by
	   the column it happens to mention counts something else entirely. */
	it('refuses a filter it cannot count honestly', async () => {
		const withCustom = defineQuery({
			table: t.bookings,
			columns: { id: t.bookings.id },
			filters: { market: { type: 'custom', build: () => undefined } },
			sort: { newest: t.bookings.createdAt },
			defaultSort: 'newest'
		});
		await expect(withCustom.facet(new URL('https://x.test/l'), 'market')).resolves.toEqual({});
	});

	it('refuses a filter that does not exist, inherited keys included', async () => {
		for (const key of ['nope', ...INHERITED]) {
			await expect(query.facet(new URL('https://x.test/l'), key)).resolves.toEqual({});
		}
	});
});
