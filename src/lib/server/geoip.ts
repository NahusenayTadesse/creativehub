import fs from 'node:fs';
import path from 'node:path';
import { Reader, type CountryResponse } from 'mmdb-lib';
import { env } from '$env/dynamic/private';
import { FILES_DIR } from '$lib/server/serveFile';

/**
 * The country an IP address is in, from a database file on this machine.
 *
 * The file is DB-IP's free "IP to Country Lite" (CC BY 4.0 — the privacy page
 * carries the credit the licence asks for). Nothing is sent anywhere: the
 * lookup is a walk through a tree held in memory, and an address never leaves
 * the process. The `refresh-geoip` job fetches the month's edition.
 *
 * A missing or unreadable file is not an error. It means nobody is located by
 * address — which is exactly how the site behaved before this existed — and it
 * is said once, not on every request.
 */

export const GEOIP_DB_PATH = path.resolve(
	env.GEOIP_DB_PATH || path.join(FILES_DIR, 'geoip', 'dbip-country-lite.mmdb')
);

/**
 * How often the file is looked at again. The database is replaced monthly, in
 * place, and a restart should not be what it takes to start reading the new
 * one — but a `stat` per request is more than a monthly file deserves.
 */
const RECHECK_MS = 10 * 60_000;

let reader: Reader<CountryResponse> | null = null;
let loadedMtime = 0;
let checkedAt = 0;
let reportedMissing = false;

function currentReader(): Reader<CountryResponse> | null {
	const now = Date.now();
	if (now - checkedAt < RECHECK_MS) return reader;
	checkedAt = now;

	try {
		const { mtimeMs } = fs.statSync(GEOIP_DB_PATH);
		if (!reader || mtimeMs !== loadedMtime) {
			reader = new Reader<CountryResponse>(fs.readFileSync(GEOIP_DB_PATH));
			loadedMtime = mtimeMs;
			reportedMissing = false;
		}
	} catch (err) {
		/* Keep a database that was already loaded: a file half-way through being
		   replaced is a reason to wait for the next check, not to forget. */
		if (!reader && !reportedMissing) {
			reportedMissing = true;
			console.warn(
				JSON.stringify({
					level: 'warn',
					at: new Date().toISOString(),
					message: 'geoip: no country database, so signed-out readers are not located',
					path: GEOIP_DB_PATH,
					error: err instanceof Error ? err.message : String(err),
					hint: 'Run scripts/geoip-update.sh with this path.'
				})
			);
		}
	}
	return reader;
}

/** ISO 3166-1 alpha-2, upper case, or null when the address is not in the file. */
export function countryCodeFor(address: string): string | null {
	const db = currentReader();
	if (!db) return null;
	try {
		return db.get(address)?.country?.iso_code?.toUpperCase() ?? null;
	} catch {
		/* Not an address at all — a proxy that sent something odd. */
		return null;
	}
}
