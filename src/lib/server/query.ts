/**
 * One place where a list URL becomes SQL.
 *
 * Every listing in the app — discovery, briefs, deals, applications, the
 * operator's reference tables — is the same query with different columns: a
 * search, some filters, a sort and a page. This module is that query, written
 * once. A surface supplies a *definition* naming the columns it exposes, and
 * gets back a function that reads a `URL` and returns one page.
 *
 * Two rules hold everywhere, and they are the reason this is not written by
 * hand each time:
 *
 * 1. **Nothing reaches SQL that the definition did not name.** A sort key is
 *    looked up in a map, a filter value is checked against its column's allowed
 *    values, `q` is escaped before it enters a LIKE pattern, and the page and
 *    page size are clamped. A parameter that is not recognised is dropped, never
 *    passed through. Every lookup uses `Object.hasOwn`, because `in` and plain
 *    truthiness both answer for `__proto__`, `constructor` and the rest of
 *    `Object.prototype` — keys no definition ever declared.
 *
 *    Two kinds of "unrecognised" are deliberately told apart. A value outside a
 *    vocabulary this file was *given* — an `enum`, a `group` — is not a choice
 *    the listing offers, so it is **dropped** and the reader sees the unfiltered
 *    list. A syntactically valid reference to a row that does not exist — an id,
 *    a slug — is a choice the listing does offer, pointed at nothing, so it is
 *    **applied** and the reader correctly sees no results.
 * 2. **Ownership is not a filter.** Conditions that decide *whose* rows these
 *    are come from the caller's `where`, derived from the session. Filters come
 *    from the query string. Keeping them in separate arguments is what stops a
 *    crafted URL from widening a scope.
 *
 * The count and the page are the same query: the joins are declared once and
 * applied to both, so the total can never describe a different set from the
 * rows.
 */

/* eslint-disable @typescript-eslint/no-explicit-any --
   The `any`s below all sit on one seam: Drizzle's `$dynamic()` builder. Its
   `.leftJoin()` returns a *wider* type than it received — the selection map
   grows with every join — so a function that adds joins cannot be typed as
   `(qb: T) => T`, and a selection assembled at runtime cannot be checked
   against a fixed shape. What is actually checked is `columns`, which fixes the
   row type callers receive (see `RowOf`), and every value read out of the URL,
   which is validated before it reaches any of this. */

import {
	and,
	asc,
	count,
	countDistinct,
	desc,
	eq,
	gte,
	inArray,
	isNull,
	like,
	lte,
	or,
	type GetColumnData,
	type SQL
} from 'drizzle-orm';
import type { AnyMySqlColumn, MySqlTable } from 'drizzle-orm/mysql-core';
import { db } from '$lib/server/db';
import { PARAM, type PageResult, type QueryState, type SortDirection } from '$lib/query';

export type { PageResult, QueryState } from '$lib/query';

export const DEFAULT_PER_PAGE = 24;
export const MAX_PER_PAGE = 100;

/** How many rows an in-memory ranking may consider before SQL order takes over. */
export const DEFAULT_RANK_LIMIT = 500;

/**
 * The highest page number a URL may name.
 *
 * `perPage` has always been clamped; `page` was not, and it is the value that
 * becomes an OFFSET. The past-the-end recovery below lands anyone who asks for
 * more on the last real page, so this only has to be larger than any genuine
 * result set.
 */
const MAX_PAGE = 1_000_000;

/** At most this many words are taken from `q`; the rest is noise in a LIKE. */
const MAX_SEARCH_TERMS = 6;

type Sortable = AnyMySqlColumn | SQL;

/**
 * The row a selection map produces.
 *
 * `columns` on a definition is the select shape *and* the row type callers get,
 * so this reads the data type out of each entry — the column's own type, or
 * whatever an `sql<T>` fragment was annotated with. It replaces the
 * `{ [K in keyof C]: any }` these row types used to be, which typed the shape
 * and nothing else.
 */
export type RowOf<TColumns> = {
	[K in keyof TColumns]: TColumns[K] extends AnyMySqlColumn
		? GetColumnData<TColumns[K]>
		: TColumns[K] extends SQL<infer T>
			? T
			: TColumns[K] extends SQL.Aliased<infer T>
				? T
				: unknown;
};

/** A sort option: a column, or a column with the direction it reads best in. */
type SortSpec = Sortable | { column: Sortable; direction?: SortDirection };

/**
 * How one query parameter becomes a condition.
 *
 * `enum` and `group` carry their own vocabulary, which is what makes them safe:
 * the value is compared against a list this file was given, so an unexpected
 * one is dropped rather than reaching the database.
 */
export type Filter =
	/** `?region=3` — an integer foreign key. */
	| { type: 'number'; column: AnyMySqlColumn }
	/** `?country=1&country=2` or `?country=1,2` — any of several ids. */
	| { type: 'numbers'; column: AnyMySqlColumn }
	/** `?code=ET` — an exact string match. */
	| { type: 'text'; column: AnyMySqlColumn }
	/**
	 * `?role=admin` — one value from a vocabulary this definition names.
	 *
	 * `nullAs` is for a nullable column with a default: a row whose value was
	 * never written still *means* that default, and without this it is reachable
	 * only from the "all" choice while the facet counts it under nothing.
	 */
	| { type: 'enum'; column: AnyMySqlColumn; values: readonly string[]; nullAs?: string }
	| { type: 'enums'; column: AnyMySqlColumn; values: readonly string[]; nullAs?: string }
	/** `?tab=active` — one named set of states, e.g. the tabs above a list. */
	| { type: 'group'; column: AnyMySqlColumn; groups: Record<string, readonly string[]> }
	/** `?minReach=10000` — inclusive lower bound. */
	| { type: 'min'; column: AnyMySqlColumn }
	/** `?maxPrice=50000` — inclusive upper bound. */
	| { type: 'max'; column: AnyMySqlColumn }
	/** `?available=1` — present and truthy means "must be true". */
	| { type: 'flag'; column: AnyMySqlColumn }
	/**
	 * Anything the shapes above cannot say — a join-table membership, a bound
	 * spanning two columns. `build` receives the raw values and returns a
	 * condition or nothing.
	 *
	 * There is deliberately no `column` here: what a custom filter matches on is
	 * whatever `build` decides, so `facet()` cannot count it honestly and refuses
	 * to try.
	 */
	| {
			type: 'custom';
			build: (values: string[]) => SQL | undefined;
	  };

/**
 * Applies the joins a listing needs.
 *
 * Typed loosely on purpose: Drizzle's `.leftJoin()` returns a *wider* builder
 * than it received — the selection map grows with each join — so a function
 * that adds joins cannot be typed as `(qb: T) => T`. The definition's `columns`
 * is what fixes the row shape, and it is checked.
 */
type Joins = (qb: any) => any;

export interface QueryDefinition<TColumns extends Record<string, unknown>, TRow> {
	/** The table the listing counts rows of. Joins may add more. */
	table: MySqlTable;
	/** The select shape. Also the row type callers receive. */
	columns: TColumns;
	joins?: Joins;
	/**
	 * Counted distinctly instead of `count(*)`.
	 *
	 * Needed wherever a join can match a row more than once — one account owning
	 * two organisations, say. Without it the total counts join matches rather
	 * than rows, and reports more results than the pages can show.
	 */
	countColumn?: AnyMySqlColumn;
	/**
	 * Collapses the page query to one row per value of this column.
	 *
	 * The companion to `countColumn`: that one stops a fan-out join from
	 * inflating the *total*, this one stops it from repeating a *row*. Set both
	 * wherever a join can match more than once, or the page shows four rows over
	 * a total of three. Columns taken from the joined side must be aggregated.
	 */
	groupBy?: AnyMySqlColumn;
	/** Columns `q` searches, matched case-insensitively as substrings. */
	search?: AnyMySqlColumn[];
	filters?: Record<string, Filter>;
	/** The sort options this listing offers, by the name its URL uses. */
	sort: Record<string, SortSpec>;
	defaultSort: string;
	defaultDirection?: SortDirection;
	/**
	 * Appended to every ordering to make it total. Two rows sharing a timestamp
	 * otherwise swap places between requests, which makes one repeat on page two
	 * and another vanish entirely.
	 */
	tiebreaker?: AnyMySqlColumn;
	perPage?: number;
	maxPerPage?: number;
	/**
	 * Decorates the rows of one page — the second query that turns ids into
	 * names, say. It runs on the page, never on the table, which is the whole
	 * point of paginating first.
	 */
	hydrate?: (rows: any[]) => Promise<TRow[]>;
}

export type RunOptions<TRow> = {
	/**
	 * Conditions the server decides: whose rows these are, what is published.
	 * Never anything read from the query string.
	 */
	where?: (SQL | undefined)[];
	/** Overrides the URL's page, for a fixed strip rather than a browsed list. */
	page?: number;
	perPage?: number;
	/**
	 * Orders the result by something SQL cannot express — a match score
	 * computed in the domain, say — and pages that order.
	 *
	 * The ranking is applied to at most `limit` rows, because ranking in memory
	 * means fetching what is ranked. Past that boundary the database's order
	 * decides, and `rankedWithin` on the result says where the boundary fell so
	 * the page can be honest about it.
	 */
	rank?: { by: (row: TRow) => number; limit?: number };
};

/** `%` and `_` are wildcards, and `\` escapes them — none may come from a reader. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

/** `?k=a&k=b` and `?k=a,b` mean the same thing; both arrive here as `['a','b']`. */
function readValues(params: URLSearchParams, key: string): string[] {
	return params
		.getAll(key)
		.flatMap((entry) => entry.split(','))
		.map((entry) => entry.trim())
		.filter(Boolean);
}

/**
 * An integer, or nothing.
 *
 * The empty check is load-bearing: `Number('')` is `0`, not `NaN`, so an absent
 * parameter would otherwise read as a real zero — and a page size of zero,
 * clamped, becomes a page of one row.
 */
const readInt = (value: string): number | null => {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed)) return null;
	const truncated = Math.trunc(parsed);
	/* Past MAX_SAFE_INTEGER a number stringifies in exponent form — `2.4e+22`
	   is not valid SQL, so an offset built from it is a 500 rather than an
	   empty page. Anything that large is a crafted URL, not a reader. */
	return Number.isSafeInteger(truncated) ? truncated : null;
};

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

const sortColumn = (spec: SortSpec): Sortable =>
	spec && typeof spec === 'object' && 'column' in spec ? (spec as any).column : (spec as Sortable);

const sortDirection = (spec: SortSpec): SortDirection | undefined =>
	spec && typeof spec === 'object' && 'direction' in spec ? (spec as any).direction : undefined;

/** The accepted values of one filter, and the condition they produce. */
function buildFilter(filter: Filter, raw: string[]): { values: string[]; condition?: SQL } {
	if (!raw.length) return { values: [] };

	switch (filter.type) {
		case 'number': {
			const id = readInt(raw[0]);
			if (id === null) return { values: [] };
			return { values: [String(id)], condition: eq(filter.column, id) };
		}
		case 'numbers': {
			const ids = raw.map(readInt).filter((id): id is number => id !== null);
			if (!ids.length) return { values: [] };
			return { values: ids.map(String), condition: inArray(filter.column, ids) };
		}
		case 'text':
			return { values: [raw[0]], condition: eq(filter.column, raw[0]) };
		case 'enum': {
			if (!filter.values.includes(raw[0])) return { values: [] };
			const match = eq(filter.column, raw[0]);
			return {
				values: [raw[0]],
				condition: raw[0] === filter.nullAs ? or(match, isNull(filter.column)) : match
			};
		}
		case 'enums': {
			const allowed = raw.filter((value) => filter.values.includes(value));
			if (!allowed.length) return { values: [] };
			const match = inArray(filter.column, allowed);
			return {
				values: allowed,
				condition:
					filter.nullAs && allowed.includes(filter.nullAs)
						? or(match, isNull(filter.column))
						: match
			};
		}
		case 'group': {
			/* `in`/truthiness would also answer for `constructor`, `toString` and
			   everything else inherited from Object.prototype: `groups.constructor`
			   is a function, whose `.length` is its arity, so it reads as either a
			   state list or an "all" tab depending on which key was asked for. Only
			   a key this definition actually declared may pass. */
			if (!Object.hasOwn(filter.groups, raw[0])) return { values: [] };
			const members = filter.groups[raw[0]];
			/* A group naming no states — an "all" tab — is a valid choice that
			   filters nothing, so it is kept as state without a condition. */
			if (!members) return { values: [] };
			if (!members.length) return { values: [raw[0]] };
			return { values: [raw[0]], condition: inArray(filter.column, [...members]) };
		}
		case 'min': {
			const bound = Number(raw[0]);
			if (!Number.isFinite(bound)) return { values: [] };
			return { values: [String(bound)], condition: gte(filter.column, bound) };
		}
		case 'max': {
			const bound = Number(raw[0]);
			if (!Number.isFinite(bound)) return { values: [] };
			return { values: [String(bound)], condition: lte(filter.column, bound) };
		}
		case 'flag': {
			const on = ['1', 'true', 'yes', 'on'].includes(raw[0].toLowerCase());
			if (!on) return { values: [] };
			return { values: ['1'], condition: eq(filter.column, true) };
		}
		case 'custom': {
			const condition = filter.build(raw);
			return { values: condition ? raw : [], condition };
		}
	}
}

/**
 * Turns a definition into the reads a listing needs.
 *
 * Returns `run` for one page, and `facet` for the counts beside a filter's
 * choices — the numbers on a set of tabs, or against each country in a list of
 * markets.
 */
export function defineQuery<TColumns extends Record<string, unknown>, TRow = any>(
	definition: QueryDefinition<TColumns, TRow>
) {
	const {
		table,
		columns,
		joins = (qb: any) => qb,
		search = [],
		filters = {},
		countColumn,
		groupBy,
		sort,
		defaultSort,
		defaultDirection = 'desc',
		tiebreaker,
		perPage: definitionPerPage = DEFAULT_PER_PAGE,
		maxPerPage = MAX_PER_PAGE,
		hydrate
	} = definition;

	/** Everything the query string asked for, validated. */
	function parse(params: URLSearchParams) {
		const searchText = (params.get(PARAM.search) ?? '').trim().slice(0, 120);
		const terms = searchText.split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_TERMS);

		/* Every term must appear in at least one searched column, so a second
		   word narrows a search instead of being ignored. */
		const searchConditions = search.length
			? terms
					.map((term) => or(...search.map((column) => like(column, `%${escapeLike(term)}%`))))
					.filter(Boolean)
			: [];

		const requestedSort = params.get(PARAM.sort) ?? '';
		/* `in` answers for `__proto__`, `constructor` and every other inherited
		   key, which is not what "a sort this definition declared" means. */
		const sortKey = Object.hasOwn(sort, requestedSort) ? requestedSort : defaultSort;
		const requestedDirection = params.get(PARAM.direction);
		const direction: SortDirection =
			requestedDirection === 'asc' || requestedDirection === 'desc'
				? requestedDirection
				: (sortDirection(sort[sortKey]) ?? defaultDirection);

		const state: QueryState = {
			search: searchConditions.length ? searchText : '',
			sort: sortKey,
			direction,
			filters: {},
			values: {}
		};

		/* Kept per filter, not merged, so `facet` can drop one and keep the rest. */
		const filterConditions = new Map<string, SQL>();

		for (const [key, filter] of Object.entries(filters)) {
			const { values, condition } = buildFilter(filter, readValues(params, key));
			if (!values.length) continue;
			state.filters[key] = values;
			state.values[key] = values[0];
			if (condition) filterConditions.set(key, condition);
		}

		return { state, searchConditions, filterConditions, sortKey, direction };
	}

	/** The page query and the count query, over the same joins and conditions. */
	const rowsQuery = (where: SQL | undefined) => {
		const qb = joins(
			db
				.select(columns as any)
				.from(table)
				.$dynamic()
		).where(where);
		return groupBy ? qb.groupBy(groupBy) : qb;
	};

	const counted = () => (countColumn ? countDistinct(countColumn) : count());

	const countQuery = async (where: SQL | undefined): Promise<number> => {
		const rows = await joins(db.select({ value: counted() }).from(table).$dynamic()).where(where);
		return Number(rows[0]?.value ?? 0);
	};

	const orderFor = (sortKey: string, direction: SortDirection) => {
		const order = direction === 'asc' ? asc : desc;
		const clauses = [order(sortColumn(sort[sortKey]) as any)];
		if (tiebreaker) clauses.push(order(tiebreaker));
		return clauses;
	};

	async function run(url: URL, options: RunOptions<TRow> = {}): Promise<PageResult<TRow>> {
		const params = url.searchParams;
		const { state, searchConditions, filterConditions, sortKey, direction } = parse(params);

		const scope = (options.where ?? []).filter(Boolean) as SQL[];
		const where = and(...scope, ...searchConditions, ...filterConditions.values());
		const order = orderFor(sortKey, direction);

		const perPage = clamp(
			options.perPage ?? readInt(params.get(PARAM.perPage) ?? '') ?? definitionPerPage,
			1,
			maxPerPage
		);
		const requestedPage = clamp(
			options.page ?? readInt(params.get(PARAM.page) ?? '') ?? 1,
			1,
			MAX_PAGE
		);

		const decorate = async (rows: any[]): Promise<TRow[]> =>
			hydrate ? await hydrate(rows) : (rows as TRow[]);

		const finishRanked = (
			rows: TRow[],
			total: number,
			page: number,
			pageCount: number,
			rankedWithin?: number
		) => {
			const from = rows.length === 0 ? 0 : (page - 1) * perPage + 1;
			return {
				rows,
				page,
				perPage,
				total,
				pageCount,
				from,
				to: rows.length === 0 ? 0 : from + rows.length - 1,
				hasPrev: page > 1,
				hasNext: page < pageCount,
				state,
				...(rankedWithin === undefined ? {} : { rankedWithin })
			};
		};

		const finish = (rows: TRow[], total: number, page: number) =>
			finishRanked(rows, total, page, Math.max(1, Math.ceil(total / perPage)));

		/*
		 * A ranked list is ordered by a value the database cannot compute, so the
		 * order has to be decided here — which means fetching the rows to be
		 * ordered rather than one page of them. The cap is what keeps that from
		 * becoming the very problem paging solves.
		 */
		if (options.rank) {
			const limit = options.rank.limit ?? DEFAULT_RANK_LIMIT;
			const [raw, total] = await Promise.all([
				rowsQuery(where)
					.orderBy(...order)
					.limit(limit),
				countQuery(where)
			]);

			const ranked = (await decorate(raw)).sort(
				(a, b) => options.rank!.by(b) - options.rank!.by(a)
			);
			/*
			 * Page within what was ranked, not within the true total. `total` can
			 * exceed `limit`, and pages past the cut would then slice past the end
			 * of `ranked` — an empty grid under a "Showing 577 – 576 of 1000" line,
			 * with `hasNext` still offering another one. `rankedWithin` is how the
			 * result says the order stops here; the pager has to agree with it.
			 */
			const reachable = Math.min(total, ranked.length);
			const pageCount = Math.max(1, Math.ceil(reachable / perPage));
			const page = Math.min(requestedPage, pageCount);
			const slice = ranked.slice((page - 1) * perPage, page * perPage);

			return finishRanked(slice, total, page, pageCount, total > limit ? limit : undefined);
		}

		const [raw, total] = await Promise.all([
			rowsQuery(where)
				.orderBy(...order)
				.limit(perPage)
				.offset((requestedPage - 1) * perPage),
			countQuery(where)
		]);

		const pageCount = Math.max(1, Math.ceil(total / perPage));

		/*
		 * A link to a page past the end — a bookmark from before rows were
		 * removed — reads as "no results" rather than "no page seven". Re-reading
		 * the last page costs one query in a case that is rare by construction.
		 */
		if (raw.length === 0 && total > 0 && requestedPage > pageCount) {
			const last = await rowsQuery(where)
				.orderBy(...order)
				.limit(perPage)
				.offset((pageCount - 1) * perPage);
			return finish(await decorate(last), total, pageCount);
		}

		return finish(await decorate(raw), total, requestedPage);
	}

	/**
	 * How many rows each value of one filter would match, counted with every
	 * *other* filter applied.
	 *
	 * A facet that counted itself would report 1 for the tab you are on and 0
	 * for the rest, which is the one thing the numbers must not do. Because the
	 * filter is excluded, summing the result gives the unfiltered total.
	 */
	async function facet(
		url: URL,
		key: string,
		options: { where?: (SQL | undefined)[] } = {}
	): Promise<Record<string, number>> {
		const filter = Object.hasOwn(filters, key) ? filters[key] : undefined;
		/*
		 * A `custom` filter's `column` is a hint, not what it matches on — the
		 * campaigns `market` filter accepts a null country and a name inside
		 * `targetRegions` as well as an exact id. Grouping by the column would
		 * count something the filter does not, which is worse than no counts.
		 */
		if (!filter || filter.type === 'custom') return {};
		const column = 'column' in filter ? filter.column : undefined;
		if (!column) return {};

		const { searchConditions, filterConditions } = parse(url.searchParams);
		filterConditions.delete(key);

		const scope = (options.where ?? []).filter(Boolean) as SQL[];
		const where = and(...scope, ...searchConditions, ...filterConditions.values());

		const rows: { value: unknown; n: number }[] = await joins(
			db.select({ value: column, n: counted() }).from(table).$dynamic()
		)
			.where(where)
			.groupBy(column);

		const nullAs = filter.type === 'enum' || filter.type === 'enums' ? filter.nullAs : undefined;

		const counts: Record<string, number> = {};
		for (const row of rows) {
			/* A NULL group key belongs to whatever the column's default means, so
			   that the tallies still sum to the unfiltered total. */
			const key = row.value === null || row.value === undefined ? nullAs : String(row.value);
			if (key === undefined) continue;
			counts[key] = (counts[key] ?? 0) + Number(row.n);
		}

		/* A group filter is asked about by group name, not by the column values
		   the groups are made of, so the tallies are folded the same way. */
		if (filter.type === 'group') {
			const folded: Record<string, number> = {};
			for (const [name, members] of Object.entries(filter.groups)) {
				folded[name] = members.length
					? members.reduce((sum, member) => sum + (counts[member] ?? 0), 0)
					: Object.values(counts).reduce((sum, n) => sum + n, 0);
			}
			return folded;
		}

		return counts;
	}

	/**
	 * The total this listing would return with some of its filters dropped.
	 *
	 * `facet` answers "how many for each value of one filter", which is what a
	 * set of chips needs — except for the chip that means *no* filter. Summing a
	 * facet gives the total under every *other* filter, so the "all markets"
	 * chip built that way silently reports "briefs in the market you already
	 * chose". This asks the question that chip is actually asking.
	 *
	 * Also the only honest way to count a `custom` filter, which `facet` refuses.
	 */
	async function countWithout(
		url: URL,
		keys: string[],
		options: { where?: (SQL | undefined)[] } = {}
	): Promise<number> {
		const { searchConditions, filterConditions } = parse(url.searchParams);
		for (const key of keys) filterConditions.delete(key);

		const scope = (options.where ?? []).filter(Boolean) as SQL[];
		return countQuery(and(...scope, ...searchConditions, ...filterConditions.values()));
	}

	return { run, facet, countWithout, parse };
}
