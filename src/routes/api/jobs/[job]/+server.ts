import { json } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { JobBusyError, isJobName, recentJobRuns, runJob } from '$lib/server/jobs';
import type { RequestEvent, RequestHandler } from './$types';

/**
 * The maintenance jobs, over the loopback, for cron.
 *
 * `POST /api/jobs/verify-socials` runs that job and answers with what it did;
 * `GET` answers with the last runs of every job. The server has no
 * `node_modules` to run the equivalent scripts with, so this is how they are
 * scheduled at all — see `src/lib/server/jobs` for the crontab lines.
 *
 * Two locks, because one is never enough for an endpoint that writes:
 *
 * 1. **A token.** `JOB_TOKEN` in the server's `.env`, sent as a bearer. Without
 *    it configured the route answers 503 rather than running anything, so a
 *    machine that has not been set up cannot be nudged into a sweep.
 * 2. **No proxy hops.** Node listens on `127.0.0.1` and every public request
 *    reaches it through Cloudflare and LiteSpeed, which add `X-Forwarded-For`.
 *    A request carrying one did not come from this machine's cron, whatever
 *    token it has, so it is refused.
 */

/** Compares without leaking where two strings first differ. */
function tokenMatches(presented: string, expected: string): boolean {
	const a = Buffer.from(presented);
	const b = Buffer.from(expected);
	/* `timingSafeEqual` throws on a length mismatch, which would itself be the
	   leak; the lengths are compared first and the result folded in. */
	return a.length === b.length && timingSafeEqual(a, b);
}

function authorise({ request }: RequestEvent): Response | null {
	const expected = (env.JOB_TOKEN ?? '').trim();
	if (expected.length < 16) {
		return json(
			{ ok: false, error: 'JOB_TOKEN is not configured on this server' },
			{ status: 503 }
		);
	}

	if (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')) {
		return json({ ok: false, error: 'not available through the proxy' }, { status: 403 });
	}

	const header = request.headers.get('authorization') ?? '';
	const presented = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
	if (!tokenMatches(presented, expected)) {
		return json({ ok: false, error: 'bad or missing job token' }, { status: 401 });
	}

	return null;
}

export const POST: RequestHandler = async (event) => {
	const refusal = authorise(event);
	if (refusal) return refusal;

	const name = event.params.job;
	if (!isJobName(name)) {
		return json({ ok: false, error: `no such job: ${name}` }, { status: 404 });
	}

	/* `?write=0` rehearses: the job reports what it would have done and changes
	   nothing. The first `prune-uploads` on a machine deserves one. */
	const write = !['0', 'false', 'no'].includes(
		(event.url.searchParams.get('write') ?? '').toLowerCase()
	);

	try {
		const result = await runJob(name, write);
		/* A failed job answers 200 with `ok: false`: cron reads the body into a
		   log, and a curl exit code cannot say which job failed or why. */
		return json({ job: name, write, ...result });
	} catch (err) {
		if (err instanceof JobBusyError) {
			return json({ ok: false, job: name, error: err.message }, { status: 409 });
		}
		throw err;
	}
};

export const GET: RequestHandler = async (event) => {
	const refusal = authorise(event);
	if (refusal) return refusal;

	/* `GET /api/jobs/runs` is the whole log; any other name filters to it. */
	const name = event.params.job;
	const runs = await recentJobRuns();
	return json({
		ok: true,
		runs: name === 'runs' ? runs : runs.filter((run) => run.job === name)
	});
};
