/**
 * Making a slug unique in its own table.
 *
 * A slug is part of a permalink, so two rules matter more than prettiness: it
 * must contain nothing that changes meaning when a browser or a mail client
 * percent-encodes it — that is `slugify`, in `$lib/slug.ts` — and it must be
 * unique in its table, which is this. `uniqueSlug` asks the database rather
 * than guessing, and it takes the row being edited as an exception so that
 * saving a post without renaming it does not append `-2`.
 */

import { and, eq, ne } from 'drizzle-orm';
import type { AnyMySqlColumn, MySqlTable } from 'drizzle-orm/mysql-core';
import { db } from '$lib/server/db';
import { slugify } from '$lib/slug';

/* Re-exported so a server module needing both has one import to make. */
export { slugify };

/**
 * A slug for `value` that no other row in `table` is using.
 *
 * `ignoreId` is the row being saved: without it, an edit that leaves the title
 * alone would find its own slug taken and rename the page out from under every
 * link to it.
 */
export async function uniqueSlug(
	table: MySqlTable,
	column: AnyMySqlColumn,
	idColumn: AnyMySqlColumn,
	value: string,
	options: { ignoreId?: number; fallback?: string } = {}
): Promise<string> {
	const base = slugify(value, options.fallback ?? 'item');
	const { ignoreId = 0 } = options;

	let candidate = base;
	let suffix = 1;

	/* Bounded by the number of rows that genuinely share a title, which is a
	   handful — the loop cannot spin, because each pass either returns or
	   moves to a candidate no earlier pass tried. */
	while (true) {
		const clash = await db
			.select({ id: idColumn })
			.from(table)
			.where(ignoreId ? and(eq(column, candidate), ne(idColumn, ignoreId)) : eq(column, candidate))
			.limit(1);
		if (!clash.length) return candidate;
		candidate = `${base}-${++suffix}`;
	}
}
