/**
 * Records the migrations in `drizzle/` as applied, without running them.
 *
 * For one situation only: a database whose tables were created by
 * `drizzle-kit push` before this project kept migrations. Its schema already
 * matches `0000`, so running `0000` would fail on "table already exists" — but
 * with no row in `__drizzle_migrations`, every deploy would keep trying.
 *
 * Run this once against such a database. On an empty database run
 * `npm run db:migrate` instead; this would leave it with a migration history
 * and no tables.
 *
 * Pass a tag to stop early:  `npm run db:baseline -- 0000_initial_schema`
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const upTo = process.argv[2];
const journal = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json', 'utf8')) as {
	entries: { tag: string; when: number }[];
};

const connection = await mysql.createConnection(url);

await connection.query(`
	CREATE TABLE IF NOT EXISTS \`__drizzle_migrations\` (
		id SERIAL PRIMARY KEY,
		hash text NOT NULL,
		created_at bigint
	)
`);

const [rows] = await connection.query<mysql.RowDataPacket[]>(
	'SELECT hash FROM `__drizzle_migrations`'
);
const applied = new Set(rows.map((row) => String(row.hash)));

let recorded = 0;
for (const entry of journal.entries) {
	const sql = fs.readFileSync(`drizzle/${entry.tag}.sql`, 'utf8');
	const hash = crypto.createHash('sha256').update(sql).digest('hex');

	if (applied.has(hash)) {
		console.log(`· ${entry.tag} already recorded`);
	} else {
		await connection.execute(
			'INSERT INTO `__drizzle_migrations` (hash, created_at) VALUES (?, ?)',
			[hash, entry.when]
		);
		console.log(`✓ ${entry.tag} recorded as applied`);
		recorded++;
	}

	if (upTo && entry.tag === upTo) break;
}

console.log(
	recorded
		? `\n${recorded} migration(s) baselined. Nothing was run against the schema.`
		: '\nNothing to baseline.'
);

await connection.end();
