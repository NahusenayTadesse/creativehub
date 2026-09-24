/**
 * Asks every platform whether the handles on file are real accounts.
 *
 *   npm run verify:socials                       # report, write nothing
 *   npm run verify:socials -- --write            # store each verdict on the row
 *   npm run verify:socials -- --write --limit=50
 *   npm run verify:socials -- --stale=30         # only rows not checked in 30 days
 *   npm run verify:socials -- --platform=TikTok
 *
 * The sweep itself lives in `src/lib/server/jobs/verify-socials.ts`, which is
 * also what cron runs through `POST /api/jobs/verify-socials`. This file is the
 * hand-operated front of it: arguments, commentary, and a connection of its own
 * because a script has no app around it.
 *
 * What it does not do: judge. `not_found` is written to the row and reported
 * here, and nothing is hidden, unpublished or deleted on the strength of it.
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as t from '../src/lib/server/db/schema';
import { runVerifySocials } from '../src/lib/server/jobs/verify-socials';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined =>
	args
		.find((arg) => arg.startsWith(`--${name}=`))
		?.split('=')
		.slice(1)
		.join('=');

const write = args.includes('--write');

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const connection = await mysql.createConnection(url);
const db = drizzle(connection, { schema: t, mode: 'default' });

if (!write) console.log('→ dry run — pass --write to store the verdicts');

const result = await runVerifySocials(db, {
	write,
	limit: Number(flag('limit') ?? 0),
	staleDays: Number(flag('stale') ?? 0),
	platform: flag('platform'),
	onProgress: (line) => console.log(line)
});

console.log(`\n→ ${result.note}`);

if (result.missing.length) {
	console.log('\n→ handles the platform says do not exist:');
	for (const line of result.missing) console.log(`  ${line}`);
	console.log('\n  Nothing was hidden or removed. These are for a person to look at.');
}

await connection.end();
