/**
 * Asks every platform whether the handles on file are real accounts.
 *
 *   npm run verify:socials                       # report, write nothing
 *   npm run verify:socials -- --write            # store each verdict on the row
 *   npm run verify:socials -- --write --limit=50
 *   npm run verify:socials -- --stale=30         # only rows not checked in 30 days
 *   npm run verify:socials -- --platform=TikTok
 *
 * Why a sweep as well as the check the channels form runs: the form only ever
 * sees a row as it is being written. An account that was real in March can be
 * deleted, renamed or banned in June, and nothing about the row changes when it
 * happens — the follower count the marketplace prices against goes on sitting
 * there looking authoritative. This is what notices.
 *
 * What it does not do: judge. `not_found` is written to the row and reported
 * here, and nothing is hidden, unpublished or deleted on the strength of it.
 * Four of the seven platforms cannot be checked anonymously at all — see the
 * table in `src/lib/server/social-check.ts` — and a creator whose Instagram
 * cannot be verified has done nothing wrong. Acting on the verdict is a
 * person's job, from this report.
 *
 * Re-running is cheap and safe. `--stale` is the flag for a scheduled run: with
 * `--stale=30` a row checked inside the last month is skipped, so a nightly
 * sweep spreads the work rather than asking every platform about every handle
 * every night.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { and, asc, eq, isNull, lt, or } from 'drizzle-orm';
import * as t from '../src/lib/server/db/schema';
import { checkSocialAccount, isCheckablePlatform } from '../src/lib/server/social-check';
import { normaliseHandle, type LinkStatus } from '../src/lib/domain/social-link';

/* ------------------------------------------------------------------ *
 * Arguments
 * ------------------------------------------------------------------ */

const args = process.argv.slice(2);
const flag = (name: string): string | undefined =>
	args
		.find((arg) => arg.startsWith(`--${name}=`))
		?.split('=')
		.slice(1)
		.join('=');

const write = args.includes('--write');
const limit = Number(flag('limit') ?? 0);
const staleDays = Number(flag('stale') ?? 0);
const onlyPlatform = flag('platform')?.toLowerCase();

/**
 * Politeness. These are other people's servers, and a few hundred handles going
 * out as fast as the event loop allows is the shape of traffic that gets an IP
 * blocked — which would turn every later verdict into `unknown`.
 */
const DELAY_MS = 500;
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const connection = await mysql.createConnection(url);
const db = drizzle(connection, { schema: t, mode: 'default' });

/** Rows worth asking about: live, not deleted, and stale if a window was given. */
const staleBefore = staleDays ? new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000) : undefined;

const rows = await db
	.select({
		id: t.socialAccounts.id,
		handle: t.socialAccounts.handle,
		platform: t.platforms.name,
		status: t.socialAccounts.linkStatus,
		checkedAt: t.socialAccounts.linkCheckedAt,
		creator: t.creators.username
	})
	.from(t.socialAccounts)
	.innerJoin(t.platforms, eq(t.platforms.id, t.socialAccounts.platformId))
	.innerJoin(t.creators, eq(t.creators.id, t.socialAccounts.creatorId))
	.where(
		and(
			isNull(t.socialAccounts.deletedAt),
			isNull(t.creators.deletedAt),
			staleBefore
				? or(
						isNull(t.socialAccounts.linkCheckedAt),
						lt(t.socialAccounts.linkCheckedAt, staleBefore)
					)
				: undefined
		)
	)
	.orderBy(asc(t.socialAccounts.id));

const queue = rows
	.filter((row) => !onlyPlatform || row.platform.toLowerCase() === onlyPlatform)
	.slice(0, limit || undefined);

console.log(
	`→ ${queue.length} of ${rows.length} channel${rows.length === 1 ? '' : 's'}` +
		(write ? '' : ' (dry run — pass --write to store the verdicts)')
);

const tally: Record<LinkStatus | 'skipped', number> = {
	unchecked: 0,
	found: 0,
	not_found: 0,
	unknown: 0,
	skipped: 0
};
const missing: string[] = [];

for (const row of queue) {
	/* A platform with no strategy would come back `unknown` after no request at
	   all; saying so once here beats writing the same non-answer onto the row. */
	/* Stored handles carry the `@` as often as not; printing the normalised one
	   keeps the report readable and matches what was actually looked up. */
	const handle = normaliseHandle(row.handle);

	if (!isCheckablePlatform(row.platform)) {
		tally.skipped++;
		console.log(`  ·  ${row.creator} / ${row.platform} @${handle} — not checkable`);
		continue;
	}

	const check = await checkSocialAccount(row.platform, row.handle);
	tally[check.status]++;

	const mark = check.status === 'found' ? '✓' : check.status === 'not_found' ? '✗' : '?';
	console.log(`  ${mark}  ${row.creator} / ${row.platform} @${handle} — ${check.detail}`);

	if (check.status === 'not_found') {
		missing.push(`${row.creator} / ${row.platform} @${handle} — ${check.url}`);
	}

	if (write) {
		await db
			.update(t.socialAccounts)
			.set({ linkStatus: check.status, linkCheckedAt: new Date() })
			.where(eq(t.socialAccounts.id, row.id));
	}

	await sleep(DELAY_MS);
}

console.log(
	`\n→ found ${tally.found}, missing ${tally.not_found}, ` +
		`could not tell ${tally.unknown}, not checkable ${tally.skipped}`
);

if (missing.length) {
	console.log('\n→ handles the platform says do not exist:');
	for (const line of missing) console.log(`  ${line}`);
	console.log('\n  Nothing was hidden or removed. These are for a person to look at.');
}

await connection.end();
