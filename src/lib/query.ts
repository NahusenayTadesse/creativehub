/**
 * The vocabulary a list URL speaks, shared by the server that reads it and the
 * controls that write it.
 *
 * Every paginated surface in the app puts its whole state in the query string:
 * the page, the search text, the sort and every filter. That is what makes a
 * result linkable, back-button-correct and reloadable, and it is why the server
 * never has to trust a POST to know what the reader is looking at.
 *
 * Nothing here touches the database — `$lib/server/query.ts` is what turns
 * these parameters into SQL, and it validates every one of them first.
 */

import type { ResolvedPathname } from '$app/types';

export const PARAM = {
	page: 'page',
	perPage: 'per',
	search: 'q',
	sort: 'sort',
	direction: 'dir'
} as const;

export type SortDirection = 'asc' | 'desc';

/** The normalised state a page result carries back to the controls. */
export type QueryState = {
	/** The accepted search text — empty when there was none. */
	search: string;
	sort: string;
	direction: SortDirection;
	/** Every accepted filter value, keyed by filter name. */
	filters: Record<string, string[]>;
	/** The first value of each filter, for single-choice controls. */
	values: Record<string, string>;
};

/** What a paginated read returns: the page, and where it sits in the whole. */
export type PageResult<Row> = {
	rows: Row[];
	/** 1-based. */
	page: number;
	perPage: number;
	/** Rows matching the search and filters, ignoring the page. */
	total: number;
	pageCount: number;
	/** 1-based row numbers this page covers, for "showing 25–48 of 191". */
	from: number;
	to: number;
	hasPrev: boolean;
	hasNext: boolean;
	state: QueryState;
	/**
	 * Set when an in-memory ranking could not see the whole result set, so the
	 * order below the cut is the database's rather than the ranker's.
	 */
	rankedWithin?: number;
};

export type ParamValue = string | number | boolean | null | undefined | readonly string[];

/**
 * A link this module built is already base-path correct.
 *
 * Every one of them is derived from `url.pathname`, which is the pathname the
 * browser is actually on — so it already carries `paths.base` if there is one.
 * Running it back through `resolve()` would prepend the base a second time,
 * which is why these are asserted rather than resolved.
 */
const resolved = (path: string) => path as ResolvedPathname;

/**
 * `url`'s query string with `changes` applied, as a relative link.
 *
 * Changing anything except the page returns to page one: staying on page 7 of a
 * result that a new filter just cut to two pages shows an empty screen, and the
 * reader has no way to tell an over-filtered search from a mistaken one.
 */
export function withParams(url: URL, changes: Record<string, ParamValue>): ResolvedPathname {
	const params = new URLSearchParams(url.searchParams);

	for (const [key, value] of Object.entries(changes)) {
		if (value === null || value === undefined || value === '' || value === false) {
			params.delete(key);
		} else if (Array.isArray(value)) {
			params.delete(key);
			for (const entry of value) if (entry !== '') params.append(key, entry);
		} else {
			params.set(key, String(value));
		}
	}

	if (!(PARAM.page in changes)) params.delete(PARAM.page);

	const query = params.toString();
	return resolved(query ? `${url.pathname}?${query}` : url.pathname);
}

/** The link to one page of the current result, keeping everything else. */
export const pageLink = (url: URL, page: number): ResolvedPathname =>
	withParams(url, { [PARAM.page]: page > 1 ? page : null });

/** Adds or removes one value of a multi-select filter. */
export function toggleValue(current: readonly string[], value: string): string[] {
	return current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
}

/**
 * The page numbers to draw, with `null` where a run was elided.
 *
 * Always shows the first and last page, and a window around the current one, so
 * the control stays the same width whether there are three pages or three
 * hundred.
 */
export function pageWindow(page: number, pageCount: number, span = 1): (number | null)[] {
	if (pageCount <= 1) return pageCount === 1 ? [1] : [];

	const wanted = new Set<number>([1, pageCount]);
	for (let n = page - span; n <= page + span; n++) {
		if (n >= 1 && n <= pageCount) wanted.add(n);
	}

	const numbers = [...wanted].sort((a, b) => a - b);
	const out: (number | null)[] = [];
	let previous = 0;

	for (const n of numbers) {
		if (previous && n - previous > 1) out.push(null);
		out.push(n);
		previous = n;
	}
	return out;
}
