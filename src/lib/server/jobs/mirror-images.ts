import { sql, type SQL } from 'drizzle-orm';
import type { RowDataPacket } from 'mysql2';
import type { Database } from '$lib/server/db/rollups';
import { outOfTime, type JobOptions, type JobResult } from './types';

/**
 * Brings every picture the site shows onto its own server.
 *
 * Imports and early operator entry left some image columns holding somebody
 * else's URL — Instagram and TikTok CDN links carry an expiry stamp and break
 * within days, and the rest can vanish whenever their host decides. The site
 * no longer draws any of them (`hostedAssetUrl`), so until this job has run a
 * creator whose avatar is a link simply shows a placeholder.
 *
 * Each run takes a random handful of rows still holding a link, downloads the
 * picture, stores it like any upload and repoints the row. Random rather than
 * oldest-first so that a host that is only temporarily refusing cannot hold
 * the head of the queue for ever.
 *
 * A link that is gone for good — 401, 403, 404 or 410, or not a picture at all
 * — is cleared, so the row reads as "no picture" and stops being retried. A
 * refusal that may pass (429, a 5xx, a timeout) leaves the row as it was for
 * the next run.
 */

/** Every column that holds a picture the public can see. */
export const IMAGE_COLUMNS: [table: string, column: string][] = [
	['creators', 'avatar'],
	['creators', 'cover'],
	['organizations', 'logo'],
	['gallery_slides', 'image'],
	['partners', 'logo'],
	['categories', 'image'],
	['blog_posts', 'featured_image'],
	['blog_posts', 'og_image'],
	['blog_post_images', 'image'],
	['site_settings', 'logo_wordmark'],
	['site_settings', 'logo_wordmark_dark'],
	['site_settings', 'logo_mark'],
	['site_settings', 'logo_partners']
];

/** Answers from a host that mean the picture is not coming back. */
const GONE = new Set([401, 403, 404, 410]);

/** What the mirror step is handed, so this file needs no SvelteKit imports. */
export type Mirror = (url: string) => Promise<string>;

/** The shape of the error the mirror throws — see `UploadError` in upload.ts. */
type MirrorFailure = { reason?: string; status?: number };

export type MirrorImagesOptions = JobOptions & { mirror: Mirror };

const selectRows = async (db: Database, query: SQL): Promise<RowDataPacket[]> =>
	(await db.execute(query))[0] as unknown as RowDataPacket[];

export async function runMirrorImages(
	db: Database,
	options: MirrorImagesOptions
): Promise<JobResult & { cleared: number; waiting: number }> {
	const { mirror, write = false, budgetMs, onProgress } = options;
	const limit = options.limit && options.limit > 0 ? options.limit : 40;
	const startedAt = Date.now();

	let examined = 0;
	let changed = 0;
	let cleared = 0;
	let waiting = 0;
	let stoppedEarly = false;

	/* Which of the columns exist here. A database behind on migrations is
	   reported on and skipped, never assumed. */
	const present = new Set(
		(
			await selectRows(
				db,
				sql`SELECT CONCAT(TABLE_NAME, '.', COLUMN_NAME) AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`
			)
		).map((row) => String(row.name))
	);

	outer: for (const [table, column] of IMAGE_COLUMNS) {
		if (!present.has(`${table}.${column}`)) continue;
		const tableId = sql.identifier(table);
		const columnId = sql.identifier(column);
		const remote = sql`(${columnId} LIKE 'http://%' OR ${columnId} LIKE 'https://%' OR ${columnId} LIKE '//%')`;

		const [{ n }] = await selectRows(db, sql`SELECT COUNT(*) AS n FROM ${tableId} WHERE ${remote}`);
		waiting += Number(n);

		const rows = await selectRows(
			db,
			sql`SELECT id, ${columnId} AS value FROM ${tableId} WHERE ${remote} ORDER BY RAND() LIMIT ${limit}`
		);

		for (const row of rows) {
			if (outOfTime(startedAt, budgetMs) || examined >= limit) {
				stoppedEarly = true;
				break outer;
			}
			examined++;
			const url = String(row.value);

			if (!write) {
				onProgress?.(`would fetch ${table}.${column} #${row.id} ← ${url}`);
				continue;
			}

			try {
				const stored = await mirror(url);
				/* Only if the row still holds the link it held when read: an
				   operator who uploaded a picture meanwhile keeps theirs. */
				await db.execute(
					sql`UPDATE ${tableId} SET ${columnId} = ${stored} WHERE id = ${row.id} AND ${columnId} = ${url}`
				);
				changed++;
				onProgress?.(`${table}.${column} #${row.id} → ${stored}`);
			} catch (err) {
				const failure = (err ?? {}) as MirrorFailure;
				const gone =
					failure.reason === 'bad_type' ||
					failure.reason === 'content_mismatch' ||
					failure.reason === 'too_large' ||
					(failure.reason === 'unreachable' && GONE.has(failure.status ?? 0));
				if (gone) {
					await db.execute(
						sql`UPDATE ${tableId} SET ${columnId} = '' WHERE id = ${row.id} AND ${columnId} = ${url}`
					);
					cleared++;
					onProgress?.(
						`${table}.${column} #${row.id} cleared (${failure.status ?? failure.reason})`
					);
				} else {
					onProgress?.(
						`${table}.${column} #${row.id} left for later (${failure.status ?? failure.reason ?? 'error'})`
					);
				}
			}
		}
	}

	return {
		examined,
		changed,
		cleared,
		waiting,
		stoppedEarly,
		note: write
			? `stored ${changed}, cleared ${cleared} dead link(s), ${Math.max(0, waiting - changed - cleared)} remote picture(s) still waiting`
			: `${waiting} remote picture(s) waiting; rehearsal, nothing fetched`
	};
}
