import fs from 'node:fs';
import path from 'node:path';
import { sql, type SQL } from 'drizzle-orm';
import type { RowDataPacket } from 'mysql2';
import type { Database } from '$lib/server/db/rollups';
import type { JobOptions, JobResult } from './types';

/**
 * Finds files on disk that no row points at, and optionally removes them.
 *
 * Deletes in this app are soft, on purpose: a removed campaign keeps its
 * applications, and a removed creator keeps the frozen `termsSnapshot` on their
 * completed bookings. That means a delete must *not* take the file with it —
 * the row can come back. What it also means is that files only ever accumulate.
 *
 * So reclaiming them is a deliberate act rather than a side effect, and it is
 * this: read every column that stores a filename, subtract that set from what
 * is on disk, and remove the difference.
 *
 * Shared by `npm run uploads:prune` and the `prune-uploads` job.
 */

/** Files younger than this are never touched, whatever the database says. */
const GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Every column that can hold an uploaded file name.
 *
 * The upload paths in the app are `contentCrud`'s `fileFields` — the gallery
 * and category pictures — the brand marks and hero picture on `site_settings`,
 * and verification evidence. The rest are listed because they accept *either*
 * an upload or an external URL, and a column that never holds one costs a
 * single harmless query here, whereas a column left off this list means live
 * files counted as orphans. Missing columns are reported and skipped, not
 * assumed.
 */
const FILE_COLUMNS: [table: string, column: string][] = [
	['gallery_slides', 'image'],
	['hero_slides', 'image'],
	['categories', 'image'],
	['partners', 'logo'],
	['site_settings', 'hero_image'],
	['site_settings', 'logo_wordmark'],
	['site_settings', 'logo_wordmark_dark'],
	['site_settings', 'logo_mark'],
	['site_settings', 'logo_partners'],
	['verification_requests', 'document_url'],
	['stat_proofs', 'screenshot'],
	['creators', 'avatar'],
	['creators', 'cover'],
	['organizations', 'logo'],
	['portfolio_items', 'url'],
	['social_accounts', 'profile_url'],
	['blog_posts', 'featured_image'],
	['blog_posts', 'og_image'],
	['blog_post_images', 'image']
];

/**
 * Columns whose *text* mentions uploads rather than naming one.
 *
 * An article body is HTML, and a picture dropped into it is an `<img>` inside
 * that markup — there is no column holding its name. Left off this list, every
 * inline picture in the journal is an orphan by the definition above, and a
 * single applied run empties every published article of its illustrations while
 * the rows still point at them.
 */
const FILE_TEXT_COLUMNS: [table: string, column: string][] = [['blog_posts', 'body']];

/**
 * The rows a raw SELECT returned.
 *
 * `db.execute` is typed for writes — its first element is a `ResultSetHeader` —
 * but MySQL hands back an array of rows for a SELECT, which is what these
 * information_schema and dynamic-column queries are. The cast is the narrowing
 * drizzle cannot do for a query it never parsed.
 */
const selectRows = async (db: Database, query: SQL): Promise<RowDataPacket[]> =>
	(await db.execute(query))[0] as unknown as RowDataPacket[];

/** Every `/files/<name>` and `/files/private/<name>` mentioned in some text. */
const namesIn = (text: string): string[] =>
	[...text.matchAll(/\/files\/(?:private\/)?([A-Za-z0-9._-]+)/g)].map((match) => match[1]);

export type PruneUploadsOptions = JobOptions & {
	/** The uploads directory. Defaults to the app's `FILES_DIR`. */
	root: string;
	/** Override the grace period. Tests pass 0. */
	graceMs?: number;
};

export type PruneUploadsResult = JobResult & {
	onDisk: number;
	referenced: number;
	orphans: string[];
	bytes: number;
};

export async function runPruneUploads(
	db: Database,
	options: PruneUploadsOptions
): Promise<PruneUploadsResult> {
	const { root, write = false, onProgress } = options;
	const graceMs = options.graceMs ?? GRACE_MS;

	const empty = { examined: 0, changed: 0, stoppedEarly: false, onDisk: 0, referenced: 0 };
	if (!fs.existsSync(root)) {
		return { ...empty, orphans: [], bytes: 0, note: `nothing to do — ${root} does not exist` };
	}

	/* Which of the columns above actually exist in this database. Listing a
	   column the schema has since renamed must not silently widen the set of
	   files nothing points at. */
	const columnRows = await selectRows(
		db,
		sql`SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`
	);
	const present = new Set(columnRows.map((row) => `${row.TABLE_NAME}.${row.COLUMN_NAME}`));

	const referenced = new Set<string>();

	for (const [table, column] of FILE_COLUMNS) {
		if (!present.has(`${table}.${column}`)) {
			onProgress?.(`· skipping ${table}.${column} — not in this database`);
			continue;
		}
		const rows = await selectRows(
			db,
			sql`SELECT DISTINCT ${sql.identifier(column)} AS value FROM ${sql.identifier(table)}
			    WHERE ${sql.identifier(column)} IS NOT NULL AND ${sql.identifier(column)} <> ''`
		);
		for (const row of rows) {
			/* Stored as `abc.png` or `private/abc.png`; normalise to the base name
			   so a file moved between visibilities is never counted as an orphan. */
			referenced.add(path.basename(String(row.value)));
		}
	}

	for (const [table, column] of FILE_TEXT_COLUMNS) {
		if (!present.has(`${table}.${column}`)) {
			onProgress?.(`· skipping ${table}.${column} — not in this database`);
			continue;
		}
		const rows = await selectRows(
			db,
			sql`SELECT ${sql.identifier(column)} AS value FROM ${sql.identifier(table)}
			    WHERE ${sql.identifier(column)} IS NOT NULL AND ${sql.identifier(column)} <> ''`
		);
		for (const row of rows) {
			for (const name of namesIn(String(row.value))) referenced.add(name);
		}
	}

	const onDisk: { file: string; full: string; mtime: number; size: number }[] = [];
	for (const dir of [root, path.join(root, 'private')]) {
		if (!fs.existsSync(dir)) continue;
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			if (!entry.isFile()) continue;
			const full = path.join(dir, entry.name);
			const stat = fs.statSync(full);
			onDisk.push({ file: entry.name, full, mtime: stat.mtimeMs, size: stat.size });
		}
	}

	const now = Date.now();
	const orphans = onDisk.filter(
		(entry) => !referenced.has(entry.file) && now - entry.mtime > graceMs
	);
	const bytes = orphans.reduce((sum, entry) => sum + entry.size, 0);

	for (const orphan of orphans) {
		onProgress?.(`  ${write ? 'removing' : 'would remove'} ${orphan.full}`);
		if (write) fs.rmSync(orphan.full, { force: true });
	}

	const megabytes = (bytes / 1024 / 1024).toFixed(1);
	return {
		examined: onDisk.length,
		changed: write ? orphans.length : 0,
		stoppedEarly: false,
		onDisk: onDisk.length,
		referenced: referenced.size,
		orphans: orphans.map((orphan) => orphan.full),
		bytes,
		note:
			`${onDisk.length} on disk · ${referenced.size} referenced · ` +
			`${orphans.length} orphaned (${megabytes} MB)` +
			(write ? ' · removed' : ' · nothing deleted, this was a rehearsal')
	};
}
