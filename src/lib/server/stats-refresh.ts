import { and, asc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import * as t from './db/schema';
import { liveSocialFilter, type Database } from './db/rollups';
import { recalcCreatorReach, recalcCreatorScore } from './db/creator-score';
import { normaliseHandle } from '../domain/social-link';
import {
	fetchTelegramStats,
	fetchYouTubeStats,
	statsPlatform,
	type StatsFetch,
	type StatsResult
} from './platform-stats';
import { connectionFor, fetchConnectedTikTokStats, tiktokCredentials } from './tiktok';

/**
 * Brings the channels a platform will describe up to date.
 *
 * Takes `db` and the keys as arguments — the scheduler in the app reads them
 * from the environment, `scripts/refresh-stats.ts` from the shell — so this is
 * the one definition of what a refresh writes.
 *
 * What it writes, per channel it asks about:
 * - always `stats_fetched_at` and `stats_fetch_detail`, so a failing channel is
 *   not asked again every hour;
 * - on success, the follower count with source `platform`, and the engagement
 *   rate likewise when the platform gave one. A rate it did not give is left
 *   exactly as it was, source and all.
 *
 * `updated_at` on the channel and the creator is left alone: a follower count
 * moving is not somebody editing the profile. `followers_updated_at` is the
 * column that says when the number changed.
 *
 * ## Three platforms, two kinds of credential
 *
 * YouTube and Telegram are asked with one key belonging to this app, so every
 * channel on those platforms is askable the moment the key is set. TikTok is
 * asked with a token belonging to the creator, granted per channel — so a
 * TikTok row is only in the queue once its owner has connected it, which is
 * why the select below joins `platform_connections` rather than filtering on
 * a key. See `tiktok.ts`.
 */

export type RefreshOptions = {
	youtubeKey?: string;
	telegramToken?: string;
	/** Channels asked within this many hours are skipped. Default 24. */
	staleHours?: number;
	/** Most channels asked in one run. Default 200 — 600 YouTube quota units of 10,000. */
	limit?: number;
	/** `platforms.name`, to confine a run to one. */
	platform?: string;
	/** False reports what the platforms say and writes nothing. Default true. */
	write?: boolean;
	now?: Date;
	/** Pause between requests, so a run is a trickle rather than a burst. */
	delayMs?: number;
	fetchImpl?: StatsFetch;
	log?: (line: string) => void;
};

export type RefreshReport = {
	asked: number;
	updated: number;
	failed: number;
	/** Platforms that stopped the run early for everyone — a spent quota, a bad key. */
	stopped: Record<string, string>;
	/** Platforms this run would have asked, had a key been configured. */
	unconfigured: string[];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function refreshPlatformStats(
	db: Database,
	options: RefreshOptions = {}
): Promise<RefreshReport> {
	const now = options.now ?? new Date();
	const write = options.write ?? true;
	const log = options.log ?? (() => {});
	const staleBefore = new Date(now.getTime() - (options.staleHours ?? 24) * 60 * 60 * 1000);

	const keys = {
		youtube: options.youtubeKey?.trim() || null,
		telegram: options.telegramToken?.trim() || null,
		/* Not a key but the app's own TikTok registration: without it no grant can
		   be renewed, so connected channels are as unaskable as an unkeyed one. */
		tiktok: tiktokCredentials()
	};

	const report: RefreshReport = { asked: 0, updated: 0, failed: 0, stopped: {}, unconfigured: [] };

	/*
	 * Only platforms with a key are selected. Selecting the others and skipping
	 * them would be worse than wasteful: they are never marked as asked, so they
	 * sort first every run and fill `limit` before a configured channel is reached.
	 */
	const askable = ['youtube', 'telegram', 'tiktok'] as const;
	const wanted = (options.platform ? [options.platform.trim().toLowerCase()] : [...askable]).filter(
		(name): name is (typeof askable)[number] => (askable as readonly string[]).includes(name)
	);
	report.unconfigured = wanted.filter((kind) => !keys[kind]);
	const configured = wanted.filter((kind) => keys[kind]);
	if (!configured.length) return report;

	const queue = await db
		.select({
			id: t.socialAccounts.id,
			creatorId: t.socialAccounts.creatorId,
			handle: t.socialAccounts.handle,
			followers: t.socialAccounts.followers,
			platform: t.platforms.name,
			creator: t.creators.username,
			/* Null for every platform but TikTok, and for a TikTok channel nobody
			   has connected — which the filter below excludes from the queue. */
			connectionId: t.platformConnections.id
		})
		.from(t.socialAccounts)
		.innerJoin(t.platforms, eq(t.platforms.id, t.socialAccounts.platformId))
		.innerJoin(t.creators, eq(t.creators.id, t.socialAccounts.creatorId))
		.leftJoin(t.platformConnections, eq(t.platformConnections.socialAccountId, t.socialAccounts.id))
		.where(
			and(
				liveSocialFilter(),
				isNull(t.creators.deletedAt),
				/* Lower-cased, the way `statsPlatform` matches, and in SQL rather than
				   after, so `limit` counts channels that will actually be asked. */
				inArray(sql`lower(${t.platforms.name})`, configured),
				/* A TikTok row without a grant is not askable, and selecting it would
				   fill `limit` with channels this run is going to skip. */
				or(
					sql`lower(${t.platforms.name}) <> 'tiktok'`,
					sql`${t.platformConnections.id} is not null`
				),
				or(
					isNull(t.socialAccounts.statsFetchedAt),
					lt(t.socialAccounts.statsFetchedAt, staleBefore)
				)
			)
		)
		/* Never asked first, then longest ago. */
		.orderBy(
			sql`${t.socialAccounts.statsFetchedAt} is not null`,
			asc(t.socialAccounts.statsFetchedAt)
		)
		.limit(Math.max(1, options.limit ?? 200));

	/**
	 * One channel, whichever platform it is on.
	 *
	 * TikTok is reached through the creator's stored grant rather than a key, so
	 * its branch re-reads the connection row: the queue carries only the id,
	 * because the token columns have no business travelling with a listing.
	 */
	async function ask(
		kind: 'youtube' | 'telegram' | 'tiktok',
		row: { id: number; connectionId: number | null },
		handle: string
	): Promise<StatsResult> {
		if (kind === 'youtube') return fetchYouTubeStats(handle, keys.youtube!, options.fetchImpl);
		if (kind === 'telegram') return fetchTelegramStats(handle, keys.telegram!, options.fetchImpl);

		const connection = await connectionFor(db, row.id);
		if (!connection) return { ok: false, detail: 'not_connected' };
		return fetchConnectedTikTokStats(db, connection, keys.tiktok!, options.fetchImpl, now);
	}

	const touched = new Set<number>();

	for (const row of queue) {
		const kind = statsPlatform(row.platform);
		if (!kind || !keys[kind] || report.stopped[kind]) continue;

		const handle = normaliseHandle(row.handle);
		const result: StatsResult = await ask(kind, row, handle);

		/* A failure that is about us says nothing about this channel. Leave the
		   row unmarked, so the next run asks again once the key or quota is back. */
		if (!result.ok && result.stop) {
			report.stopped[kind] = result.detail;
			log(`  ■  ${row.platform} stopped — ${result.detail}`);
			continue;
		}

		report.asked++;

		if (result.ok) {
			report.updated++;
			const rate = result.engagementRate === null ? '' : `, ${result.engagementRate}% engagement`;
			log(
				`  ✓  ${row.creator} / ${row.platform} @${handle} — ${row.followers} → ${result.followers}${rate}`
			);
		} else {
			report.failed++;
			log(`  ?  ${row.creator} / ${row.platform} @${handle} — ${result.detail}`);
		}

		if (write) {
			await db
				.update(t.socialAccounts)
				.set({
					statsFetchedAt: now,
					statsFetchDetail: result.detail.slice(0, 80),
					...(result.ok
						? {
								followers: result.followers,
								followersSource: 'platform' as const,
								followersUpdatedAt: now,
								...(result.engagementRate === null
									? {}
									: {
											engagementRate: result.engagementRate,
											engagementSource: 'platform' as const,
											engagementUpdatedAt: now
										})
							}
						: {}),
					updatedAt: sql`${t.socialAccounts.updatedAt}`
				})
				.where(eq(t.socialAccounts.id, row.id));

			if (result.ok) touched.add(row.creatorId);
		}

		if (options.delayMs) await sleep(options.delayMs);
	}

	/* Reach is the sum of channels and engagement feeds the score, so every
	   creator whose figures moved is re-derived once, after all their channels. */
	for (const creatorId of touched) {
		await recalcCreatorReach(db, creatorId, { background: true });
		await recalcCreatorScore(db, creatorId, { background: true });
	}

	return report;
}
