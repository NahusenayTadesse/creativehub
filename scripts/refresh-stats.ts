/**
 * Refreshes creator figures by hand — the same pass the app runs every hour.
 *
 *   npm run stats:refresh                          # ask the platforms, write nothing
 *   npm run stats:refresh -- --write               # store what they say
 *   npm run stats:refresh -- --write --platform=YouTube --limit=20
 *   npm run stats:refresh -- --write --stale=0     # ask every channel, however recent
 *   npm run stats:refresh -- --scores              # re-measure and rescore every creator
 *
 * The app does this on its own (`src/lib/server/stats-scheduler.ts`), so this is
 * for the cases it cannot cover: trying a new `YOUTUBE_API_KEY` before putting it
 * on the server, rescoring everyone straight after a formula change rather than
 * over the next day, or running against the server's database through the tunnel
 * in the `run-scripts-against-server-db` notes.
 *
 * Keys come from the environment, as in the app: `YOUTUBE_API_KEY` and
 * `TELEGRAM_BOT_TOKEN`. A platform without one is reported and skipped.
 *
 * Without `--write` the platforms are still asked — that is the report — so a
 * dry run spends YouTube quota like a real one: 3 units a channel of 10,000 a day.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as t from '../src/lib/server/db/schema';
import { refreshPlatformStats } from '../src/lib/server/stats-refresh';
import { remeasureStaleCreators } from '../src/lib/server/db/creator-score';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined =>
	args
		.find((arg) => arg.startsWith(`--${name}=`))
		?.split('=')
		.slice(1)
		.join('=');

const write = args.includes('--write');
const scores = args.includes('--scores');
const limit = Number(flag('limit') ?? 200);
const staleHours = Number(flag('stale') ?? 24);
const platform = flag('platform');

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const connection = await mysql.createConnection(url);
const db = drizzle(connection, { schema: t, mode: 'default' });

try {
	if (scores) {
		/* Measuring writes the measured columns; there is no report-only version
		   of it, so `--scores` is its own flag rather than a side effect of `--write`. */
		console.log('→ re-measuring response and delivery figures, and rescoring every creator');
		const count = await remeasureStaleCreators(db, { all: true, limit: 100_000 });
		console.log(`  ${count} creator${count === 1 ? '' : 's'} rescored`);
	} else {
		console.log(
			`→ asking platforms about channels not asked in ${staleHours}h` +
				(write ? '' : ' (dry run — pass --write to store the figures)')
		);

		const report = await refreshPlatformStats(db, {
			youtubeKey: process.env.YOUTUBE_API_KEY,
			telegramToken: process.env.TELEGRAM_BOT_TOKEN,
			staleHours,
			limit,
			platform,
			write,
			delayMs: 300,
			log: (line) => console.log(line)
		});

		console.log(
			`\n→ asked ${report.asked}: ${report.updated} updated, ${report.failed} could not be read`
		);
		for (const kind of report.unconfigured) {
			const variable = kind === 'youtube' ? 'YOUTUBE_API_KEY' : 'TELEGRAM_BOT_TOKEN';
			console.log(`  ${kind}: skipped — ${variable} is not set`);
		}
		for (const [kind, detail] of Object.entries(report.stopped)) {
			console.log(`  ${kind}: stopped early — ${detail}. The rest are asked on the next run.`);
		}
	}
} finally {
	await connection.end();
}
