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
 * is on disk, and report the difference.
 *
 *   npm run uploads:prune            # list what would go, delete nothing
 *   npm run uploads:prune -- --apply # actually remove them
 *
 * A grace period keeps very recent files regardless of what the database says,
 * because an upload that has been written but whose row is still being
 * validated is not an orphan — it is a race.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

/** Files younger than this are never touched, whatever the database says. */
const GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Every column that can hold an uploaded file name.
 *
 * The two upload paths in the app are `contentCrud`'s `fileFields` — declared
 * only for the homepage gallery today — and verification evidence. The rest are
 * listed because they accept *either* an upload or an external URL, and a
 * column that never holds one costs a single harmless query here, whereas a
 * column left off this list means live files counted as orphans. Missing
 * columns are reported and skipped, not assumed.
 */
const FILE_COLUMNS: [table: string, column: string][] = [
	['gallery_slides', 'image'],
	['verification_requests', 'document_url'],
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
 * single `--apply` empties every published article of its illustrations while
 * the rows still point at them.
 */
const FILE_TEXT_COLUMNS: [table: string, column: string][] = [['blog_posts', 'body']];

/** Every `/files/<name>` and `/files/private/<name>` mentioned in some text. */
const namesIn = (text: string): string[] =>
	[...text.matchAll(/\/files\/(?:private\/)?([A-Za-z0-9._-]+)/g)].map((match) => match[1]);

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const apply = process.argv.includes('--apply');
const root = path.resolve(process.env.FILES_DIR ?? '.tempFiles');

if (!fs.existsSync(root)) {
	console.log(`Nothing to do — ${root} does not exist.`);
	process.exit(0);
}

const connection = await mysql.createConnection(url);

/* Which of the columns above actually exist in this database. Listing a column
   the schema has since renamed must not silently widen the delete set. */
const [columnRows] = await connection.query<mysql.RowDataPacket[]>(
	`SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`
);
const present = new Set(columnRows.map((row) => `${row.TABLE_NAME}.${row.COLUMN_NAME}`));

const referenced = new Set<string>();
for (const [table, column] of FILE_COLUMNS) {
	if (!present.has(`${table}.${column}`)) {
		console.warn(`· skipping ${table}.${column} — not in this database`);
		continue;
	}
	const [rows] = await connection.query<mysql.RowDataPacket[]>(
		`SELECT DISTINCT \`${column}\` AS value FROM \`${table}\` WHERE \`${column}\` IS NOT NULL AND \`${column}\` <> ''`
	);
	for (const row of rows) {
		/* Stored as `abc.png` or `private/abc.png`; normalise to the base name so
		   a file moved between visibilities is never counted as an orphan. */
		referenced.add(path.basename(String(row.value)));
	}
}

for (const [table, column] of FILE_TEXT_COLUMNS) {
	if (!present.has(`${table}.${column}`)) {
		console.warn(`· skipping ${table}.${column} — not in this database`);
		continue;
	}
	const [rows] = await connection.query<mysql.RowDataPacket[]>(
		`SELECT \`${column}\` AS value FROM \`${table}\` WHERE \`${column}\` IS NOT NULL AND \`${column}\` <> ''`
	);
	for (const row of rows) {
		for (const name of namesIn(String(row.value))) referenced.add(name);
	}
}

await connection.end();

const onDisk: { file: string; full: string; mtime: number }[] = [];
for (const dir of [root, path.join(root, 'private')]) {
	if (!fs.existsSync(dir)) continue;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isFile()) continue;
		const full = path.join(dir, entry.name);
		onDisk.push({ file: entry.name, full, mtime: fs.statSync(full).mtimeMs });
	}
}

const now = Date.now();
const orphans = onDisk.filter(
	(entry) => !referenced.has(entry.file) && now - entry.mtime > GRACE_MS
);
const bytes = orphans.reduce((sum, entry) => sum + fs.statSync(entry.full).size, 0);

console.log(
	`\n${onDisk.length} file(s) on disk · ${referenced.size} referenced · ${orphans.length} orphaned` +
		` (${(bytes / 1024 / 1024).toFixed(1)} MB)`
);

for (const orphan of orphans)
	console.log(`  ${apply ? 'removing' : 'would remove'} ${orphan.full}`);

if (!apply) {
	console.log('\nNothing was deleted. Re-run with --apply to remove them.');
} else {
	for (const orphan of orphans) fs.rmSync(orphan.full, { force: true });
	console.log(`\nRemoved ${orphans.length} file(s).`);
}
