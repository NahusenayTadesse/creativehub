/**
 * Applies everything in `drizzle/` that has not been applied yet.
 *
 * This is what a deploy runs. `drizzle-kit push` — which is what this project
 * used before — diffs the schema against the live database and rewrites it on
 * the spot: there is no record of what ran, no way back, and no way to tell
 * two environments apart. A committed migration is reviewable, repeatable and
 * reversible; `push` is none of the three.
 *
 * A database that predates this directory was created by `push` and already
 * holds every table, so applying `0000` would fail on "table already exists".
 * `npm run db:baseline` marks it as applied without running it — see there.
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const connection = await mysql.createConnection({ uri: url, multipleStatements: true });
const db = drizzle(connection);

console.log('→ applying migrations from drizzle/');
await migrate(db, { migrationsFolder: './drizzle' });
console.log('✓ up to date');

await connection.end();
