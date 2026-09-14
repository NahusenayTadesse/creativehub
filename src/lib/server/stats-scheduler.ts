import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { remeasureStaleCreators } from '$lib/server/db/creator-score';
import { refreshPlatformStats } from '$lib/server/stats-refresh';

/**
 * Keeps creator figures current without a job runner.
 *
 * There is no cron on the server and no `node_modules` to run a script with, so
 * the work runs inside the app process on a timer. Every hour it does two
 * things, each bounded and each restart-safe because what is stale is read
 * from the database rather than remembered:
 *
 * 1. asks YouTube and Telegram about channels not asked in the last day, when
 *    `YOUTUBE_API_KEY` / `TELEGRAM_BOT_TOKEN` are set;
 * 2. re-measures response and delivery figures for creators not measured in
 *    the last day, and rescores them — which is also how a change to the score
 *    formula reaches every existing profile.
 *
 * `STATS_REFRESH=off` turns it off; in development it is off unless
 * `STATS_REFRESH=on`, so `npm run dev` does not spend an API quota on reload.
 */

const HOUR = 60 * 60 * 1000;

/** Long enough that a deploy's health check and first requests go first. */
const FIRST_RUN_DELAY_MS = 2 * 60 * 1000;

/* On `globalThis` rather than in the module: Vite re-evaluates modules on
   reload in development, and each evaluation would otherwise start one more
   timer that nothing can reach to stop. */
const state = globalThis as typeof globalThis & {
	__statsScheduler?: { timers: ReturnType<typeof setTimeout>[]; running: boolean };
};

export function statsRefreshEnabled(): boolean {
	const setting = (env.STATS_REFRESH ?? '').trim().toLowerCase();
	if (setting === 'off') return false;
	return dev ? setting === 'on' : true;
}

export function startStatsScheduler() {
	if (state.__statsScheduler || !statsRefreshEnabled()) return;

	const scheduler = { timers: [] as ReturnType<typeof setTimeout>[], running: false };
	state.__statsScheduler = scheduler;

	const first = setTimeout(() => void runStatsRefresh(), FIRST_RUN_DELAY_MS);
	const every = setInterval(() => void runStatsRefresh(), HOUR);
	/* Neither may keep the process alive past a SIGTERM. */
	first.unref?.();
	every.unref?.();
	scheduler.timers.push(first, every);
}

/** One pass. Never throws: a failed run is a log line, and the next hour tries again. */
export async function runStatsRefresh() {
	const scheduler = state.__statsScheduler;
	if (scheduler?.running) return;
	if (scheduler) scheduler.running = true;

	const startedAt = Date.now();
	try {
		const platforms = await refreshPlatformStats(db, {
			youtubeKey: env.YOUTUBE_API_KEY,
			telegramToken: env.TELEGRAM_BOT_TOKEN,
			delayMs: 250
		});
		const remeasured = await remeasureStaleCreators(db);

		/* Only worth a line when something happened or something is wrong. */
		if (platforms.asked || remeasured || Object.keys(platforms.stopped).length) {
			console.log(
				JSON.stringify({
					level: 'info',
					event: 'stats_refresh',
					at: new Date().toISOString(),
					ms: Date.now() - startedAt,
					...platforms,
					remeasured
				})
			);
		}
	} catch (err) {
		console.error(
			JSON.stringify({
				level: 'error',
				event: 'stats_refresh',
				at: new Date().toISOString(),
				message: err instanceof Error ? err.message : String(err)
			})
		);
	} finally {
		if (scheduler) scheduler.running = false;
	}
}
