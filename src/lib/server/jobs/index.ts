import { desc, eq } from 'drizzle-orm';
import { db, insertedId } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { FILES_DIR } from '$lib/server/serveFile';
import { runVerifySocials } from './verify-socials';
import { runPruneUploads } from './prune-uploads';
import { runRefreshGeoip } from './refresh-geoip';
import type { JobResult } from './types';

/**
 * The maintenance jobs, and the machinery that runs one safely.
 *
 * These used to be command-line scripts only, which meant they ran when
 * somebody remembered — the server has no `node_modules` to run them with, so
 * they could not be put in its crontab at all. Now cron on the box calls the
 * app over the loopback (`POST /api/jobs/<name>`), because the app already has
 * the dependencies, the database and `FILES_DIR`. The scripts still work and
 * call exactly this code.
 *
 * Three rules hold the arrangement up:
 *
 * 1. **Every job is resumable.** Each takes a time budget and reads its queue
 *    from the database, so a run cut short is not a run lost — the next one
 *    picks up the same oldest-first work.
 * 2. **No two runs of a job overlap.** One process serves this app, so an
 *    in-flight map is enough; a second call is told the job is busy rather than
 *    being queued behind it.
 * 3. **Every run leaves a record.** A job that has been failing for a fortnight
 *    looks exactly like one that is working until somebody can see `job_runs`.
 */

export type JobName = 'verify-socials' | 'prune-uploads' | 'refresh-geoip';

/** What cron gets if it names a job that does not exist. */
export const JOB_NAMES: JobName[] = ['verify-socials', 'prune-uploads', 'refresh-geoip'];

export const isJobName = (value: string): value is JobName =>
	(JOB_NAMES as string[]).includes(value);

/**
 * How long a job may run before it stops starting new work.
 *
 * Comfortably inside any proxy's patience, and short enough that cron's next
 * tick is never waiting on the last one. `verify-socials` pauses half a second
 * between requests to other people's servers, so this is roughly ninety
 * handles a run — more than a day's worth of staleness at any plausible size.
 */
const BUDGET_MS = 50_000;

const runners: Record<JobName, (write: boolean) => Promise<JobResult>> = {
	'verify-socials': (write) => runVerifySocials(db, { write, staleDays: 30, budgetMs: BUDGET_MS }),
	'prune-uploads': (write) => runPruneUploads(db, { root: FILES_DIR, write }),
	'refresh-geoip': (write) => runRefreshGeoip({ write })
};

/* Not in the module scope proper: in development Vite re-evaluates modules on
   reload, and a second copy of this map would not see the first one's run. */
const state = globalThis as typeof globalThis & { __jobsInFlight?: Set<string> };
const inFlight = (state.__jobsInFlight ??= new Set<string>());

export class JobBusyError extends Error {
	constructor(job: JobName) {
		super(`${job} is already running`);
		this.name = 'JobBusyError';
	}
}

/**
 * Runs one job, records it, and never leaves the lock behind.
 *
 * A failed job is a recorded failure rather than a thrown one: cron should see
 * a 200 with `ok: false` and the message, because a non-zero curl exit tells
 * whoever reads the mail nothing about which job or why.
 */
export async function runJob(
	job: JobName,
	/**
	 * False runs the job as a rehearsal: it reports what it would have done and
	 * changes nothing. Worth one call before the first `prune-uploads` on a
	 * machine, since that one deletes files.
	 */
	write = true
): Promise<JobResult & { ok: boolean; runId: number }> {
	if (inFlight.has(job)) throw new JobBusyError(job);
	inFlight.add(job);

	/* Everything after the lock is taken lives inside the try, including
	   opening the run record. Writing that row outside it cost an afternoon
	   once: the insert threw on a database missing the table, the `finally`
	   was never reached, and the job answered "already running" until the
	   process was restarted. */
	let runId = 0;
	try {
		const started = await db
			.insert(t.jobRuns)
			.values({ job: write ? job : `${job} (rehearsal)`, startedAt: new Date() });
		runId = insertedId(started);

		const result = await runners[job](write);
		await db
			.update(t.jobRuns)
			.set({
				finishedAt: new Date(),
				ok: true,
				examined: result.examined,
				changed: result.changed,
				stoppedEarly: result.stoppedEarly,
				note: result.note.slice(0, 500)
			})
			.where(eq(t.jobRuns.id, runId));
		return { ...result, ok: true, runId };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`Job ${job} failed:`, err);
		/* No run id means the failure was opening the record itself, and there
		   is nothing to close — the log line above is the whole report. */
		if (runId) {
			await db
				.update(t.jobRuns)
				.set({ finishedAt: new Date(), ok: false, note: message.slice(0, 500) })
				.where(eq(t.jobRuns.id, runId))
				.catch((secondary) => console.error(`Job ${job}: could not record failure:`, secondary));
		}
		return {
			ok: false,
			runId,
			examined: 0,
			changed: 0,
			stoppedEarly: false,
			note: message
		};
	} finally {
		inFlight.delete(job);
	}
}

/** The last few runs of each job, newest first — what an operator wants to see. */
export async function recentJobRuns(limit = 20) {
	return db.select().from(t.jobRuns).orderBy(desc(t.jobRuns.startedAt)).limit(limit);
}
