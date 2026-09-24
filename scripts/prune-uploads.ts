/**
 * Finds files on disk that no row points at, and optionally removes them.
 *
 *   npm run uploads:prune            # list what would go, delete nothing
 *   npm run uploads:prune -- --apply # actually remove them
 *
 * The sweep itself lives in `src/lib/server/jobs/prune-uploads.ts`, which is
 * also what cron runs through `POST /api/jobs/prune-uploads`. This file is the
 * hand-operated front of it, and the one that defaults to deleting nothing.
 *
 * Deletes in this app are soft, on purpose: a removed campaign keeps its
 * applications, and a removed creator keeps the frozen `termsSnapshot` on their
 * completed bookings. So a file outliving its row is normal, and reclaiming it
 * is a deliberate act rather than a side effect.
 */

import 'dotenv/config';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as t from '../src/lib/server/db/schema';
import { runPruneUploads } from '../src/lib/server/jobs/prune-uploads';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const apply = process.argv.includes('--apply');
const root = path.resolve(process.env.FILES_DIR ?? '.tempFiles');

const connection = await mysql.createConnection(url);
const db = drizzle(connection, { schema: t, mode: 'default' });

const result = await runPruneUploads(db, {
	root,
	write: apply,
	onProgress: (line) => console.log(line)
});

console.log(`\n${result.note}`);
if (!apply && result.orphans.length) {
	console.log('Re-run with --apply to remove them.');
}

await connection.end();
