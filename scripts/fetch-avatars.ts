/**
 * Downloads the scraped avatars once and points the creator rows at the copies.
 *
 *   npm run fetch:avatars                    # report what it would do, touch nothing
 *   npm run fetch:avatars -- --write         # download, store, and link
 *   npm run fetch:avatars -- --write --limit=10
 *   npm run fetch:avatars -- --write --via=digital   # request from that host's IP
 *
 * Why store them rather than keep the link in the column:
 *
 * The CSV's avatars are `unavatar.io` URLs, and hotlinking them would mean every
 * visitor's browser asking a third party for 132 pictures on every page — slow
 * (1.4-5.6s uncached), rate limited, and it hands that third party the IP of
 * everyone who opens the site. Fetched once into the upload directory, they are
 * ours: served by `/files/<name>`, cached like any other upload, and still there
 * the day unavatar is not.
 *
 * What it will not do:
 *
 * `unavatar.io/instagram/…` answers 403 to anyone without a paid plan, and 102
 * of the 132 rows are Instagram. Those are reported as `paywalled` and left
 * alone — the drawn placeholder in `$lib/domain/placeholder.ts` is what shows
 * for them, which is the same thing they showed before. The free tier is also
 * capped per IP per day; a 429 stops the run rather than hammering, and the next
 * run picks up where this one left off.
 *
 * Re-running is safe and cheap. A creator whose file is already in the upload
 * directory is never re-fetched, and a creator who has since been given a real
 * uploaded avatar — by an operator in the dashboard, or by the creator on their
 * own profile — is never overwritten.
 */
import 'dotenv/config';
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import Papa from 'papaparse';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import * as t from '../src/lib/server/db/schema';
import { AVATAR_COLUMNS, mapCreatorRows, type CsvRow } from '../src/lib/domain/creator-import';

/* ------------------------------------------------------------------ *
 * Arguments
 * ------------------------------------------------------------------ */

const execFile = promisify(execFileCallback);

const args = process.argv.slice(2);
const flag = (name: string): string | undefined =>
	args
		.find((arg) => arg.startsWith(`--${name}=`))
		?.split('=')
		.slice(1)
		.join('=');

const csvPath = resolve(
	flag('file') ?? 'african_creator_influencers_132_with_avatars - Creators.csv'
);
const limit = Number(flag('limit') ?? 0);
const write = args.includes('--write');
/** An SSH host to make the requests from, when this machine's quota is gone. */
const via = flag('via');

/**
 * The upload root, by the same rule `serveFile.ts` uses.
 *
 * It is repeated rather than imported: that module reads `$env/dynamic/private`,
 * which only exists inside a SvelteKit build, and a script run through tsx
 * cannot resolve it. The two must agree, so if the default there ever moves,
 * it moves here too.
 */
const FILES_DIR = resolve(process.env.FILES_DIR ?? '.tempFiles');

/** Politeness, and the thing that keeps a free quota alive a little longer. */
const DELAY_MS = 400;
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/* ------------------------------------------------------------------ *
 * What came back
 * ------------------------------------------------------------------ */

/**
 * The extensions a stored picture may have, and the bytes each one starts with.
 *
 * `saveUploadedFile` does this properly for uploads and cannot be imported here
 * for the same `$env` reason as above. The check matters for the same reason it
 * matters there: `Content-Type` is the sender's claim, and this writes into the
 * directory the site serves from.
 */
const IMAGE_TYPES: { ext: string; magic: number[] }[] = [
	{ ext: '.jpg', magic: [0xff, 0xd8, 0xff] },
	{ ext: '.png', magic: [0x89, 0x50, 0x4e, 0x47] },
	/* RIFF….WEBP — the four bytes at offset 8 are checked separately below. */
	{ ext: '.webp', magic: [0x52, 0x49, 0x46, 0x46] }
];

const MAX_BYTES = 8 * 1024 * 1024;

/** The extension for these bytes, or null when they are not a picture we store. */
function extensionFor(bytes: Uint8Array): string | null {
	for (const { ext, magic } of IMAGE_TYPES) {
		if (magic.some((byte, i) => bytes[i] !== byte)) continue;
		if (ext === '.webp' && Buffer.from(bytes.subarray(8, 12)).toString('ascii') !== 'WEBP') {
			continue;
		}
		return ext;
	}
	return null;
}

type Outcome =
	| { state: 'stored'; file: string; bytes: number }
	| { state: 'reused'; file: string }
	/** Dry run only: would be fetched, and was not. */
	| { state: 'planned' }
	| { state: 'paywalled' }
	| { state: 'ratelimited'; retryAfter: number }
	| { state: 'failed'; why: string };

/** The name a creator's avatar is stored under, whatever extension it turns out to have. */
const storedName = (username: string, ext: string) => `${username}-avatar${ext}`;

/** An earlier run's file for this creator, if one is already on disk. */
function alreadyStored(username: string, dir: string[]): string | null {
	const prefix = `${username}-avatar.`;
	return dir.find((name) => name.startsWith(prefix)) ?? null;
}

/** Status and body, however the bytes were obtained. */
type Fetched = { status: number; body: Uint8Array; retryAfter: number; contentType: string };

/** Nothing but an unavatar-shaped URL is ever handed to a shell. */
const SAFE_URL = /^https:\/\/[A-Za-z0-9._~:/?#@!$&()*+,;=%-]+$/;

/**
 * The same request, made from somewhere else.
 *
 * The free quota is counted per IP, and one machine's is one machine's. When
 * `--via` names an SSH host, curl runs there and the bytes come back over the
 * connection — so a laptop that has spent its allowance can keep going on the
 * server's, and every byte still goes through the checks below rather than
 * being written straight to disk by a shell loop.
 *
 * `-w '%{http_code}'` appends the status to the body, which is why the last
 * three bytes are peeled off before anything looks at the picture.
 */
async function fetchVia(host: string, url: string): Promise<Fetched> {
	if (!SAFE_URL.test(url)) throw new Error(`refusing to send this URL through a shell: ${url}`);
	const { stdout } = await execFile(
		'ssh',
		['-o', 'BatchMode=yes', host, `curl -sS --max-time 30 -w '%{http_code}' '${url}'`],
		{ encoding: 'buffer', maxBuffer: MAX_BYTES + 1024 }
	);
	const status = Number(stdout.subarray(-3).toString('ascii'));
	return {
		status: Number.isFinite(status) ? status : 0,
		body: new Uint8Array(stdout.subarray(0, -3)),
		/* Not worth a second round trip: the run stops on 429 either way. */
		retryAfter: 0,
		contentType: ''
	};
}

async function fetchHere(url: string): Promise<Fetched> {
	const response = await fetch(url, {
		headers: { 'User-Agent': 'creator-network avatar import' },
		signal: AbortSignal.timeout(30_000)
	});
	return {
		status: response.status,
		body: new Uint8Array(await response.arrayBuffer()),
		retryAfter: Number(response.headers.get('retry-after') ?? 0),
		contentType: response.headers.get('content-type') ?? '?'
	};
}

async function fetchAvatar(url: string, username: string): Promise<Outcome> {
	let response: Fetched;
	try {
		response = via ? await fetchVia(via, url) : await fetchHere(url);
	} catch (error) {
		return { state: 'failed', why: error instanceof Error ? error.message : String(error) };
	}

	if (response.status === 429) return { state: 'ratelimited', retryAfter: response.retryAfter };
	/* unavatar answers 403 with `EPRO` for a provider the plan does not cover. */
	if (response.status === 403) return { state: 'paywalled' };
	if (response.status < 200 || response.status > 299) {
		return { state: 'failed', why: `http ${response.status}` };
	}

	const bytes = response.body;
	if (bytes.byteLength > MAX_BYTES) {
		return { state: 'failed', why: `${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB, too large` };
	}
	const ext = extensionFor(bytes);
	if (!ext) return { state: 'failed', why: `not an image (${response.contentType})` };

	const file = storedName(username, ext);
	if (write) writeFileSync(join(FILES_DIR, file), bytes);
	return { state: 'stored', file, bytes: bytes.byteLength };
}

/* ------------------------------------------------------------------ *
 * Read the CSV through the same mapping the import used
 * ------------------------------------------------------------------ */

/**
 * Both halves come out of the mapper rather than off the row.
 *
 * The username has to: the import derived it, and a second derivation here that
 * disagreed by one character would link a picture to nobody. The avatar comes
 * with it because the mapper already resolved which of the column's two names
 * this export used — and because rows the mapper rejects have no creator to
 * link to, so pairing the two lists by position would quietly go one out of
 * step at the first rejection.
 */
function creatorsWithAvatars() {
	const parsed = Papa.parse<CsvRow>(readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, ''), {
		header: true,
		skipEmptyLines: true
	});
	const fields = parsed.meta.fields ?? [];
	if (!AVATAR_COLUMNS.some((column) => fields.includes(column))) {
		throw new Error(`${csvPath} has no avatar column (${AVATAR_COLUMNS.join(' or ')})`);
	}

	return mapCreatorRows(parsed.data)
		.creators.map(({ creator }) => ({ username: creator.username, url: creator.avatar }))
		.filter((entry): entry is { username: string; url: string } => Boolean(entry.url))
		.slice(0, limit || undefined);
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

const wanted = creatorsWithAvatars();
console.log(`${csvPath}: ${wanted.length} creators with an avatar link`);
console.log(`files → ${FILES_DIR}${write ? '' : '  (dry run — nothing is written)'}\n`);

if (write) mkdirSync(FILES_DIR, { recursive: true });
const onDisk = existsSync(FILES_DIR) ? readdirSync(FILES_DIR) : [];

const results: { username: string; outcome: Outcome }[] = [];
let stopped: number | null = null;

/**
 * Providers that have already answered "paid plan only" this run.
 *
 * The gate is on the provider, not the handle, so the first 403 settles it for
 * every other row on that provider. Asking anyway is not just noise: a refusal
 * still costs a request against the daily cap, and with 102 of the 132 rows on
 * Instagram the cap would be gone long before the fetchable ones came up.
 */
const paywalledProviders = new Set<string>();
const providerOf = (url: string) => url.split('/')[3] ?? '';

for (const { username, url } of wanted) {
	const existing = alreadyStored(username, onDisk);
	if (existing) {
		results.push({ username, outcome: { state: 'reused', file: existing } });
		continue;
	}
	/*
	 * A dry run makes no requests. It would otherwise spend the day's quota on
	 * bytes it throws away, and leave the real run with nothing left to fetch —
	 * "touch nothing" has to include the thing that is actually scarce here.
	 */
	if (!write) {
		results.push({ username, outcome: { state: 'planned' } });
		continue;
	}
	if (paywalledProviders.has(providerOf(url))) {
		results.push({ username, outcome: { state: 'paywalled' } });
		continue;
	}

	const outcome = await fetchAvatar(url, username);
	results.push({ username, outcome });

	if (outcome.state === 'ratelimited') {
		/* Every further request would get the same answer, so stop and say when
		   the quota comes back. The next run resumes from here. */
		stopped = outcome.retryAfter;
		break;
	}
	if (outcome.state === 'paywalled') paywalledProviders.add(providerOf(url));
	if (outcome.state === 'stored') onDisk.push(outcome.file);
	await sleep(DELAY_MS);
}

const by = (state: Outcome['state']) => results.filter((r) => r.outcome.state === state);
const usable = results.filter(
	(r) => r.outcome.state === 'stored' || r.outcome.state === 'reused'
) as { username: string; outcome: { state: 'stored' | 'reused'; file: string } }[];

if (!write) console.log(`  to fetch   ${by('planned').length}`);
else console.log(`  stored     ${by('stored').length}`);
console.log(`  reused     ${by('reused').length}   (already on disk)`);
if (write) {
	console.log(`  paywalled  ${by('paywalled').length}   (provider needs a paid unavatar plan)`);
	console.log(`  failed     ${by('failed').length}`);
}
for (const { username, outcome } of by('failed')) {
	console.log(`    ! ${username}: ${(outcome as { why: string }).why}`);
}
if (paywalledProviders.size) {
	console.log(`    (not asked again for: ${[...paywalledProviders].join(', ')})`);
}
if (stopped !== null) {
	/* `--via` reads the body, not the headers, so the wait is often unknown. */
	const when = stopped ? `in about ${(stopped / 3600).toFixed(1)}h` : 'when the daily cap resets';
	const left = wanted.length - results.length;
	console.log(
		`\n  rate limited — stopped with ${left} left to try.` +
			` The quota returns ${when}; re-run then and it continues.`
	);
}

/* ------------------------------------------------------------------ *
 * Link
 * ------------------------------------------------------------------ */

async function link() {
	if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
	const target = new URL(process.env.DATABASE_URL);
	console.log(`\n→ linking in ${target.hostname}:${target.port || 3306}${target.pathname}`);

	const pool = mysql.createPool(process.env.DATABASE_URL);
	const db = drizzle(pool, { schema: t, mode: 'default' });

	let linked = 0;
	let missing = 0;
	let kept = 0;
	try {
		for (const { username, outcome } of usable) {
			const rows = await db
				.select({ id: t.creators.id, avatar: t.creators.avatar })
				.from(t.creators)
				.where(eq(t.creators.username, username))
				.limit(1);

			if (!rows.length) {
				missing++;
				continue;
			}
			const current = rows[0].avatar ?? '';
			if (current === outcome.file) {
				kept++;
				continue;
			}
			/*
			 * Only a scrape gets replaced. A value with no scheme is a stored
			 * upload — an operator's or the creator's own picture — and this
			 * script has no business overwriting it with a download.
			 */
			if (current && !current.includes(':')) {
				kept++;
				continue;
			}
			await db
				.update(t.creators)
				.set({ avatar: outcome.file })
				.where(eq(t.creators.id, rows[0].id));
			linked++;
		}
	} finally {
		await pool.end();
	}

	console.log(`  linked     ${linked}`);
	console.log(`  unchanged  ${kept}   (already linked, or has an upload of its own)`);
	if (missing) console.log(`  no creator row for ${missing} username(s) — import them first`);
}

if (!write) {
	console.log(`\n  dry run — no requests were made. Pass --write to download, store and link.`);
} else if (usable.length) {
	await link();
} else {
	console.log(`\n  nothing to link.`);
}
