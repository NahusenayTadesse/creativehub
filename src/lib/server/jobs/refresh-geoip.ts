import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { GEOIP_DB_PATH } from '$lib/server/geoip';
import type { JobOptions, JobResult } from './types';

/**
 * Fetches DB-IP's free "IP to Country Lite" database, which is what places a
 * signed-out reader in a country.
 *
 * DB-IP publishes a new edition at the start of each month at a predictable
 * address, and the old one keeps working — an out-of-date file is wrong about
 * addresses that changed hands, not broken. So this runs monthly and a failure
 * is recorded rather than raised.
 *
 * There is a `scripts/geoip-update.sh` that does the same thing in bash, for a
 * machine with no app running. It is not what cron uses: a shell script on the
 * server is a file the deploy does not ship, and the last one of those sat
 * unnoticed at four months stale.
 *
 * Licensed CC BY 4.0 — the privacy page carries the credit.
 */

/** The marker a MaxMind database ends with. Anything else is an error page. */
const MAXMIND_MARKER = Buffer.from('\xab\xcd\xefMaxMind.com', 'binary');

const edition = (date: Date) =>
	`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

export type RefreshGeoipResult = JobResult & { path: string; bytes: number };

export async function runRefreshGeoip(
	options: JobOptions & { target?: string } = {}
): Promise<RefreshGeoipResult> {
	const { write = false, onProgress } = options;
	const target = options.target ?? GEOIP_DB_PATH;

	/* This month's edition, or last month's in the first days of a month before
	   the new one is up. */
	const now = new Date();
	const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
	const months = [edition(now), edition(lastMonth)];

	const failures: string[] = [];

	for (const month of months) {
		const url = `https://download.db-ip.com/free/dbip-country-lite-${month}.mmdb.gz`;
		onProgress?.(`· trying ${url}`);

		let body: Buffer;
		try {
			const response = await fetch(url);
			if (!response.ok) {
				failures.push(`${month}: HTTP ${response.status}`);
				continue;
			}
			body = Buffer.from(await response.arrayBuffer());
		} catch (err) {
			failures.push(`${month}: ${err instanceof Error ? err.message : String(err)}`);
			continue;
		}

		let unpacked: Buffer;
		try {
			unpacked = zlib.gunzipSync(body);
		} catch {
			failures.push(`${month}: not gzip — probably an error page`);
			continue;
		}

		/* A truncated download or an error page must never replace a database
		   that works. */
		if (!unpacked.includes(MAXMIND_MARKER)) {
			failures.push(`${month}: did not unpack to a MaxMind database`);
			continue;
		}

		const megabytes = (unpacked.length / 1024 / 1024).toFixed(1);
		if (!write) {
			return {
				examined: 1,
				changed: 0,
				stoppedEarly: false,
				path: target,
				bytes: unpacked.length,
				note: `${month} edition available (${megabytes} MB) · nothing written, this was a rehearsal`
			};
		}

		/* Written beside the target and renamed over it, so a reader mid-lookup
		   never sees half a database. The reader notices the new mtime by
		   itself, within ten minutes and without a restart. */
		fs.mkdirSync(path.dirname(target), { recursive: true });
		const temporary = `${target}.${process.pid}.tmp`;
		fs.writeFileSync(temporary, unpacked, { mode: 0o644 });
		fs.renameSync(temporary, target);

		return {
			examined: 1,
			changed: 1,
			stoppedEarly: false,
			path: target,
			bytes: unpacked.length,
			note: `${month} edition → ${target} (${megabytes} MB)`
		};
	}

	throw new Error(`no edition could be downloaded — ${failures.join('; ')}`);
}
