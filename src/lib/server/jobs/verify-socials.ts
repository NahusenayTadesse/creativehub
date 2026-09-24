import { and, asc, eq, isNull, lt, or } from 'drizzle-orm';
import * as t from '$lib/server/db/schema';
import type { Database } from '$lib/server/db/rollups';
import { checkSocialAccount, isCheckablePlatform } from '$lib/server/social-check';
import { normaliseHandle, type LinkStatus } from '$lib/domain/social-link';
import { outOfTime, type JobOptions, type JobResult } from './types';

/**
 * Asks every platform whether the handles on file are still real accounts.
 *
 * Why a sweep as well as the check the channels form runs: the form only ever
 * sees a row as it is being written. An account that was real in March can be
 * deleted, renamed or banned in June, and nothing about the row changes when it
 * happens — the follower count the marketplace prices against goes on sitting
 * there looking authoritative. This is what notices.
 *
 * What it does not do: judge. `not_found` is written to the row and reported,
 * and nothing is hidden, unpublished or deleted on the strength of it. Four of
 * the seven platforms cannot be checked anonymously at all, and those record
 * `unknown`, which is a third answer rather than a soft "no".
 *
 * Shared by `npm run verify:socials` and the `verify-socials` job, so the sweep
 * a person runs by hand and the one cron runs are the same code.
 */

/**
 * Politeness. These are other people's servers, and a few hundred handles going
 * out as fast as the event loop allows is the shape of traffic that gets an IP
 * blocked — which would turn every later verdict into `unknown`.
 */
const DELAY_MS = 500;

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

export type VerifySocialsOptions = JobOptions & {
	/** Only rows not checked in this many days. 0 checks every row. */
	staleDays?: number;
	/** Only this platform, by name, case-insensitively. */
	platform?: string;
	/** Override the pause between requests. Tests pass 0. */
	delayMs?: number;
};

export type VerifySocialsResult = JobResult & {
	tally: Record<LinkStatus | 'skipped', number>;
	/** Handles the platform says do not exist, for a person to look at. */
	missing: string[];
};

export async function runVerifySocials(
	db: Database,
	options: VerifySocialsOptions = {}
): Promise<VerifySocialsResult> {
	const { staleDays = 0, platform, write = false, limit = 0, budgetMs, onProgress } = options;
	const delayMs = options.delayMs ?? DELAY_MS;
	const startedAt = Date.now();

	/* Rows worth asking about: live, not deleted, and stale if a window was
	   given. Oldest first, so an interrupted run resumes rather than restarts. */
	const staleBefore = staleDays
		? new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000)
		: undefined;

	const rows = await db
		.select({
			id: t.socialAccounts.id,
			handle: t.socialAccounts.handle,
			platform: t.platforms.name,
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
		.orderBy(asc(t.socialAccounts.linkCheckedAt), asc(t.socialAccounts.id));

	const queue = rows
		.filter((row) => !platform || row.platform.toLowerCase() === platform.toLowerCase())
		.slice(0, limit || undefined);

	const tally: Record<LinkStatus | 'skipped', number> = {
		unchecked: 0,
		found: 0,
		not_found: 0,
		unknown: 0,
		skipped: 0
	};
	const missing: string[] = [];
	let examined = 0;
	let changed = 0;
	let stoppedEarly = false;

	for (const row of queue) {
		if (outOfTime(startedAt, budgetMs)) {
			stoppedEarly = true;
			break;
		}

		/* Stored handles carry the `@` as often as not; the normalised one is
		   what was actually looked up, and what the report should show. */
		const handle = normaliseHandle(row.handle);

		/* A platform with no strategy would come back `unknown` after no request
		   at all; saying so once here beats writing that non-answer onto the row. */
		if (!isCheckablePlatform(row.platform)) {
			tally.skipped++;
			onProgress?.(`  ·  ${row.creator} / ${row.platform} @${handle} — not checkable`);
			continue;
		}

		examined++;
		const check = await checkSocialAccount(row.platform, row.handle);
		tally[check.status]++;

		const mark = check.status === 'found' ? '✓' : check.status === 'not_found' ? '✗' : '?';
		onProgress?.(`  ${mark}  ${row.creator} / ${row.platform} @${handle} — ${check.detail}`);

		if (check.status === 'not_found') {
			missing.push(`${row.creator} / ${row.platform} @${handle} — ${check.url}`);
		}

		if (write) {
			await db
				.update(t.socialAccounts)
				.set({ linkStatus: check.status, linkCheckedAt: new Date() })
				.where(eq(t.socialAccounts.id, row.id));
			changed++;
		}

		if (delayMs) await sleep(delayMs);
	}

	return {
		examined,
		changed,
		stoppedEarly,
		tally,
		missing,
		note:
			`${queue.length} queued · found ${tally.found}, missing ${tally.not_found}, ` +
			`could not tell ${tally.unknown}, not checkable ${tally.skipped}` +
			(stoppedEarly ? ' · stopped on the time budget' : '')
	};
}
