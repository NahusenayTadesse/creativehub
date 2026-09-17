import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, notInArray } from 'drizzle-orm';
import { db, insertedId } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { liveSocialFilter, ratingReviewFilter } from '$lib/server/db/rollups';
import {
	LANE_LIMIT_COLUMN,
	TRENDING_LANE_KINDS,
	TRENDING_SIGNALS,
	WEIGHT_COLUMN,
	FOLLOWER_TIERS,
	buildLanes,
	compareCandidates,
	decayWeight,
	effectiveLocalRanking,
	followerTier,
	growthPercent,
	measureAudience,
	momentumValue,
	smoothedRating,
	tierLabel,
	laneLocalRank,
	localBonus,
	matchesLocation,
	newcomerValue,
	scoreCandidates,
	verificationValue,
	type Audience,
	type BuiltLane,
	type ChannelFigures,
	type CreatorLocation,
	type FollowerTier,
	type LaneCandidate,
	type LaneFacet,
	type LaneLimits,
	type LaneOptions,
	type ScoredCandidate,
	type SignalValues,
	type TrendingSignal,
	type TrendingWeights
} from '$lib/domain/trending';
import { getRequestEvent } from '$app/server';
import { getViewerLocation } from '$lib/server/viewer-location';

/**
 * Building, previewing and publishing the trending board.
 *
 * The rule this module exists to keep: the board an operator previews and the
 * board the homepage serves come out of the same function. `buildBoard` never
 * writes; `publishBoard` writes what `buildBoard` returned. A preview that ran
 * its own slightly different query would be worse than no preview at all.
 */

/** Every knob the ranking reads, with none of the bookkeeping columns. */
export type TrendingConfigValues = {
	mode: (typeof t.trendingModeEnum)[number];
	slots: number;
	windowDays: number;
	halfLifeDays: number;
	normalization: (typeof t.trendingNormalizationEnum)[number];
	weightScore: number;
	weightReach: number;
	weightEngagement: number;
	weightBookings: number;
	weightApplications: number;
	weightReviews: number;
	weightRating: number;
	weightSaves: number;
	weightNewcomer: number;
	weightVerification: number;
	weightEngagedAudience: number;
	weightGrowth: number;
	weightConfirmed: number;
	weightMomentum: number;
	weightResponsiveness: number;
	weightReliability: number;
	reachMode: (typeof t.trendingReachModeEnum)[number];
	engagementMode: (typeof t.trendingEngagementModeEnum)[number];
	audiencePlatformIds: number[];
	engagementCap: number;
	unconfirmedDiscount: number;
	growthConfirmedOnly: boolean;
	ratingPriorReviews: number;
	minScore: number;
	minFollowers: number;
	minRating: number;
	minVerification: (typeof t.verificationLevelEnum)[number];
	requireAvailable: boolean;
	requireChannel: boolean;
	requireActivity: boolean;
	maxFollowers: number;
	followerTiers: FollowerTier[];
	minChannelFollowers: number;
	minEngagementRate: number;
	maxEngagementRate: number;
	requirePlatformIds: number[];
	requireConfirmedStats: boolean;
	maxStatsAgeDays: number;
	requireClaimed: boolean;
	minCompletedBookings: number;
	minResponseRate: number;
	minProfileAgeDays: number;
	maxProfileAgeDays: number;
	includeCategoryIds: number[];
	excludeCategoryIds: number[];
	maxPerCategory: number;
	maxPerCountry: number;
	maxPerCity: number;
	maxPerTier: number;
	maxPerPlatform: number;
	incumbentBonus: number;
	maxNewPerRun: number;
	newcomerSlots: number;
	newcomerMaxAgeDays: number;
	maxTenureDays: number;
	cooldownDays: number;
	pinnedFirst: boolean;
	/** 0 — "every market" — rather than null, so a `<select>` can carry it. */
	countryId: number;
	localRanking: (typeof t.trendingLocalRankingEnum)[number];
	localMatch: (typeof t.trendingLocalMatchEnum)[number];
	localBoost: number;
	laneSlots: number;
	laneMinSize: number;
	lanePoolSize: number;
	maxCategoryLanes: number;
	maxCountryLanes: number;
	maxRegionLanes: number;
	maxCityLanes: number;
	maxPlatformLanes: number;
	maxLanguageLanes: number;
	maxTierLanes: number;
	laneLocalFirst: boolean;
	autoRefresh: boolean;
	refreshIntervalMinutes: number;
	isFrozen: boolean;
};

/** The knobs, as they stand before an operator has ever opened the screen. */
export const TRENDING_DEFAULTS: TrendingConfigValues = {
	mode: 'hybrid',
	slots: 12,
	windowDays: 30,
	halfLifeDays: 7,
	normalization: 'percentile',
	weightScore: 20,
	weightReach: 10,
	weightEngagement: 15,
	weightBookings: 15,
	weightApplications: 5,
	weightReviews: 5,
	weightRating: 10,
	weightSaves: 5,
	weightNewcomer: 5,
	weightVerification: 10,
	/* The signals added later start at nothing, so an existing board ranks
	   exactly as it did until an operator decides otherwise. */
	weightEngagedAudience: 0,
	weightGrowth: 0,
	weightConfirmed: 0,
	weightMomentum: 0,
	weightResponsiveness: 0,
	weightReliability: 0,
	reachMode: 'total',
	engagementMode: 'average',
	audiencePlatformIds: [],
	engagementCap: 0,
	unconfirmedDiscount: 0,
	growthConfirmedOnly: true,
	ratingPriorReviews: 0,
	minScore: 0,
	minFollowers: 0,
	minRating: 0,
	minVerification: 'unverified',
	requireAvailable: false,
	requireChannel: true,
	requireActivity: false,
	maxFollowers: 0,
	followerTiers: [],
	minChannelFollowers: 0,
	minEngagementRate: 0,
	maxEngagementRate: 0,
	requirePlatformIds: [],
	requireConfirmedStats: false,
	maxStatsAgeDays: 0,
	requireClaimed: false,
	minCompletedBookings: 0,
	minResponseRate: 0,
	minProfileAgeDays: 0,
	maxProfileAgeDays: 0,
	includeCategoryIds: [],
	excludeCategoryIds: [],
	maxPerCategory: 0,
	maxPerCountry: 0,
	maxPerCity: 0,
	maxPerTier: 0,
	maxPerPlatform: 0,
	incumbentBonus: 0,
	maxNewPerRun: 0,
	newcomerSlots: 0,
	newcomerMaxAgeDays: 30,
	maxTenureDays: 0,
	cooldownDays: 0,
	pinnedFirst: true,
	countryId: 0,
	localRanking: 'off',
	localMatch: 'country',
	localBoost: 15,
	laneSlots: 8,
	laneMinSize: 4,
	lanePoolSize: 120,
	maxCategoryLanes: 6,
	maxCountryLanes: 3,
	maxRegionLanes: 0,
	maxCityLanes: 0,
	maxPlatformLanes: 3,
	maxLanguageLanes: 0,
	maxTierLanes: 0,
	laneLocalFirst: true,
	autoRefresh: false,
	refreshIntervalMinutes: 360,
	isFrozen: false
};

export type TrendingConfigRow = typeof t.trendingConfig.$inferSelect;

/** The saved config, or the defaults when nobody has saved one yet. */
export async function getTrendingConfig(): Promise<TrendingConfigRow | null> {
	const rows = await db.select().from(t.trendingConfig).orderBy(asc(t.trendingConfig.id)).limit(1);
	return rows.at(0) ?? null;
}

/**
 * A list column as the ranking wants it.
 *
 * JSON columns come back parsed from MySQL and as text from a MariaDB that
 * stores JSON as `LONGTEXT`, and a config snapshot in a run row has been
 * through `JSON.stringify` once already. All three end up here.
 */
export function listOf<T extends string | number>(value: unknown, as: 'number' | 'string'): T[] {
	let raw = value;
	if (typeof raw === 'string') {
		try {
			raw = JSON.parse(raw);
		} catch {
			return [];
		}
	}
	if (!Array.isArray(raw)) return [];
	const items = raw.map((item) => (as === 'number' ? Number(item) : String(item)));
	return items.filter((item) =>
		typeof item === 'number' ? Number.isInteger(item) && item > 0 : item !== ''
	) as T[];
}

/** Every list-valued knob, normalised — see `listOf`. */
export const withLists = <C extends TrendingConfigValues>(config: C): C => ({
	...config,
	audiencePlatformIds: listOf<number>(config.audiencePlatformIds, 'number'),
	requirePlatformIds: listOf<number>(config.requirePlatformIds, 'number'),
	includeCategoryIds: listOf<number>(config.includeCategoryIds, 'number'),
	excludeCategoryIds: listOf<number>(config.excludeCategoryIds, 'number'),
	followerTiers: listOf<string>(config.followerTiers, 'string').filter(
		(tier): tier is FollowerTier => (FOLLOWER_TIERS as readonly string[]).includes(tier)
	)
});

/** The saved config merged over the defaults — always complete, never null. */
export async function getTrendingConfigValues(): Promise<
	TrendingConfigValues & { id: number | null; lastRunAt: Date | null }
> {
	const row = await getTrendingConfig();
	if (!row) return { ...TRENDING_DEFAULTS, id: null, lastRunAt: null };
	return {
		...withLists({
			...TRENDING_DEFAULTS,
			...row,
			/* The column is a nullable foreign key; the form and the ranking both
			   want a number, and 0 is the "every market" the select offers. */
			countryId: row.countryId ?? 0
		} as TrendingConfigValues),
		id: row.id,
		lastRunAt: row.lastRunAt
	};
}

/** The config row, created from the defaults on first use. */
export async function ensureTrendingConfig(actorId?: string | null): Promise<TrendingConfigRow> {
	const existing = await getTrendingConfig();
	if (existing) return existing;
	/* `countryId` is 0 in the defaults because that is what the select posts;
	   the column is a foreign key, where "no market" has to be null. */
	const { countryId, ...defaults } = TRENDING_DEFAULTS;
	await db
		.insert(t.trendingConfig)
		.values({ ...defaults, countryId: countryId || null, createdBy: actorId ?? null });
	const created = await getTrendingConfig();
	if (!created) throw new Error('trending config could not be created');
	return created;
}

export const weightsOf = (config: Partial<TrendingConfigValues>): TrendingWeights =>
	Object.fromEntries(
		TRENDING_SIGNALS.map((key) => [
			key,
			Math.max(0, Number(config[WEIGHT_COLUMN[key] as keyof TrendingConfigValues] ?? 0))
		])
	) as TrendingWeights;

/** The lane knobs, read out of the config the same way the weights are. */
export const laneOptionsOf = (config: Partial<TrendingConfigValues>): LaneOptions => ({
	slots: Number(config.laneSlots ?? TRENDING_DEFAULTS.laneSlots),
	minSize: Number(config.laneMinSize ?? TRENDING_DEFAULTS.laneMinSize),
	poolSize: Number(config.lanePoolSize ?? TRENDING_DEFAULTS.lanePoolSize),
	limits: Object.fromEntries(
		TRENDING_LANE_KINDS.map((kind) => [
			kind,
			Math.max(0, Number(config[LANE_LIMIT_COLUMN[kind] as keyof TrendingConfigValues] ?? 0))
		])
	) as LaneLimits
});

const VERIFICATION_ORDER = ['unverified', 'social_verified', 'identity_verified', 'cn_verified'];

/* ------------------------------------------------------------------ *
 * Overrides
 * ------------------------------------------------------------------ */

export type OverrideRow = typeof t.trendingOverrides.$inferSelect;

/**
 * Standing operator instructions that are still in force.
 *
 * An expired override is left in the table rather than deleted — the operator
 * who set a two-week pin should be able to see that it ran out rather than
 * wonder whether they imagined setting it.
 */
export async function listTrendingOverrides() {
	return db
		.select({
			id: t.trendingOverrides.id,
			creatorId: t.trendingOverrides.creatorId,
			kind: t.trendingOverrides.kind,
			position: t.trendingOverrides.position,
			multiplier: t.trendingOverrides.multiplier,
			note: t.trendingOverrides.note,
			startsAt: t.trendingOverrides.startsAt,
			expiresAt: t.trendingOverrides.expiresAt,
			createdAt: t.trendingOverrides.createdAt,
			username: t.creators.username,
			fullName: t.creators.fullName,
			avatar: t.creators.avatar,
			isPublished: t.creators.isPublished
		})
		.from(t.trendingOverrides)
		.innerJoin(t.creators, eq(t.creators.id, t.trendingOverrides.creatorId))
		.where(isNull(t.trendingOverrides.deletedAt))
		.orderBy(asc(t.trendingOverrides.position), asc(t.trendingOverrides.id));
}

/** In force: started, and not yet run out. */
export const isLive = (override: { startsAt: Date | null; expiresAt: Date | null }, now: Date) =>
	(!override.startsAt || override.startsAt.getTime() <= now.getTime()) &&
	(!override.expiresAt || override.expiresAt.getTime() > now.getTime());

/* ------------------------------------------------------------------ *
 * Signal gathering
 * ------------------------------------------------------------------ */

export type Candidate = {
	creatorId: number;
	username: string;
	fullName: string;
	avatar: string | null;
	countryId: number | null;
	countryName: string | null;
	regionId: number | null;
	city: string | null;
	primaryPlatformId: number | null;
	categoryIds: number[];
	/** Every group this creator would appear in — see `buildLanes`. */
	facets: LaneFacet[];
	verificationLevel: string;
	availability: string;
	/** The audience the board counts, as stated — what floors, caps and tiers read. */
	followers: number;
	tier: FollowerTier;
	audience: Audience;
	channelCount: number;
	/** How old the profile is, in days. */
	ageDays: number;
	values: SignalValues;
	/** Why this creator cannot be on the board, or null when they can. */
	excludedReason: string | null;
};

/**
 * The groups one creator belongs to.
 *
 * Every lane the homepage can offer is produced here, so adding a way to slice
 * the board — by language, by size band — is a few lines in one function
 * rather than a new query, a new table and a new strip. A facet with no label
 * is dropped: a chip reading "undefined" is worse than one fewer chip.
 */
function facetsOf(creator: {
	categories: { categoryId: number; categoryName: string }[];
	languages: { languageId: number; languageName: string }[];
	channels: { platformId: number; platformName: string | null }[];
	countryId: number | null;
	countryName: string | null;
	regionId: number | null;
	regionName: string | null;
	city: string | null;
	tier: FollowerTier;
}): LaneFacet[] {
	const facets: LaneFacet[] = [];
	const add = (
		kind: LaneFacet['kind'],
		refId: number | null,
		refKey: string | null,
		label: string | null
	) => {
		if (!label?.trim()) return;
		facets.push({ kind, refId, refKey, label: label.trim() });
	};

	for (const row of creator.categories) add('category', row.categoryId, null, row.categoryName);
	add('country', creator.countryId, null, creator.countryName);
	add('region', creator.regionId, null, creator.regionName);
	/* A city has no reference table, so the lane is keyed on the name folded to
	   lower case — "Addis Ababa" and "addis ababa" are one lane, not two. */
	if (creator.city?.trim()) {
		add('city', null, creator.city.trim().toLowerCase(), creator.city);
	}
	/* Distinct: a creator with two TikTok channels belongs to the TikTok lane
	   once, and counting them twice would let one account fill a lane's slots. */
	const seenPlatforms = new Set<number>();
	for (const channel of creator.channels) {
		if (seenPlatforms.has(channel.platformId)) continue;
		seenPlatforms.add(channel.platformId);
		add('platform', channel.platformId, null, channel.platformName);
	}
	for (const row of creator.languages) add('language', row.languageId, null, row.languageName);
	/* Keyed on the band, and labelled for whoever runs the board. Readers see
	   the label in their own language — `listTrendingLanes` re-labels by key. */
	add('tier', null, creator.tier, tierLabel(creator.tier));

	return facets;
}

const DAY_MS = 86_400_000;

const isConfirmed = (source: string) => source === 'platform' || source === 'proof';

/**
 * Every published creator with every raw signal measured for them.
 *
 * The activity signals are summed in application code rather than SQL because
 * each event is decayed by its own age — a query that returned a plain count
 * per creator would have thrown away the timestamps the decay needs. Rows are
 * pulled from two windows back, not one: momentum compares this window with
 * the one before it.
 */
export async function gatherCandidates(
	config: TrendingConfigValues,
	now: Date = new Date()
): Promise<Candidate[]> {
	const lists = withLists(config);
	const windowMs = Math.max(1, config.windowDays) * DAY_MS;
	const windowStart = new Date(now.getTime() - windowMs);
	const previousStart = new Date(now.getTime() - 2 * windowMs);
	const halfLife = Math.max(0, config.halfLifeDays);
	const ageDays = (at: Date | string | null) =>
		at ? (now.getTime() - new Date(at).getTime()) / DAY_MS : Infinity;

	const creators = await db
		.select({
			id: t.creators.id,
			userId: t.creators.userId,
			isClaimed: t.creators.isClaimed,
			username: t.creators.username,
			fullName: t.creators.fullName,
			avatar: t.creators.avatar,
			countryId: t.creators.countryId,
			countryName: t.countries.name,
			regionId: t.creators.regionId,
			regionName: t.regions.name,
			city: t.creators.city,
			primaryPlatformId: t.creators.primaryPlatformId,
			score: t.creators.score,
			totalReach: t.creators.totalReach,
			averageRating: t.creators.averageRating,
			reviewsCount: t.creators.reviewsCount,
			completedBookings: t.creators.completedBookings,
			responseRate: t.creators.responseRate,
			onTimeRate: t.creators.onTimeRate,
			verificationLevel: t.creators.verificationLevel,
			availability: t.creators.availability,
			createdAt: t.creators.createdAt
		})
		.from(t.creators)
		.leftJoin(t.countries, eq(t.countries.id, t.creators.countryId))
		.leftJoin(t.regions, eq(t.regions.id, t.creators.regionId))
		.where(
			and(
				eq(t.creators.isActive, true),
				isNull(t.creators.deletedAt),
				eq(t.creators.isPublished, true)
			)
		);

	if (!creators.length) return [];
	const ids = creators.map((row) => row.id);
	const baselineDay = windowStart.toISOString().slice(0, 10);

	const [socials, categories, languages, bookings, applications, reviews, saves, snapshots] =
		await Promise.all([
			/* The platform is joined rather than looked up later because a lane
			   carries its label as a snapshot, and a channel with no live platform
			   row is a channel no lane should be cut on. */
			db
				.select({
					id: t.socialAccounts.id,
					creatorId: t.socialAccounts.creatorId,
					followers: t.socialAccounts.followers,
					engagementRate: t.socialAccounts.engagementRate,
					followersSource: t.socialAccounts.followersSource,
					engagementSource: t.socialAccounts.engagementSource,
					followersUpdatedAt: t.socialAccounts.followersUpdatedAt,
					platformId: t.socialAccounts.platformId,
					platformName: t.platforms.name
				})
				.from(t.socialAccounts)
				.leftJoin(t.platforms, eq(t.platforms.id, t.socialAccounts.platformId))
				.where(and(inArray(t.socialAccounts.creatorId, ids), liveSocialFilter())),
			db
				.select({
					creatorId: t.creatorCategories.creatorId,
					categoryId: t.creatorCategories.categoryId,
					categoryName: t.categories.name
				})
				.from(t.creatorCategories)
				.innerJoin(t.categories, eq(t.categories.id, t.creatorCategories.categoryId))
				.where(inArray(t.creatorCategories.creatorId, ids)),
			db
				.select({
					creatorId: t.creatorLanguages.creatorId,
					languageId: t.creatorLanguages.languageId,
					languageName: t.languages.name
				})
				.from(t.creatorLanguages)
				.innerJoin(t.languages, eq(t.languages.id, t.creatorLanguages.languageId))
				.where(inArray(t.creatorLanguages.creatorId, ids)),
			db
				.select({ creatorId: t.bookings.creatorId, createdAt: t.bookings.createdAt })
				.from(t.bookings)
				.where(
					and(
						inArray(t.bookings.creatorId, ids),
						gte(t.bookings.createdAt, previousStart),
						/* A cancelled booking is not demand — it is demand that fell over. */
						ne(t.bookings.status, 'cancelled'),
						isNull(t.bookings.deletedAt)
					)
				),
			db
				.select({ creatorId: t.applications.creatorId, createdAt: t.applications.createdAt })
				.from(t.applications)
				.where(
					and(
						inArray(t.applications.creatorId, ids),
						gte(t.applications.createdAt, previousStart),
						ne(t.applications.status, 'withdrawn'),
						isNull(t.applications.deletedAt)
					)
				),
			db
				.select({ creatorId: t.reviews.creatorId, createdAt: t.reviews.createdAt })
				.from(t.reviews)
				.where(
					and(
						inArray(t.reviews.creatorId, ids),
						gte(t.reviews.createdAt, previousStart),
						/* The same definition the public rating uses, so a five-star week
						   here and the average on the profile cannot disagree. */
						ratingReviewFilter()
					)
				),
			db
				.select({ creatorId: t.savedCreators.creatorId, createdAt: t.savedCreators.createdAt })
				.from(t.savedCreators)
				.where(
					and(
						inArray(t.savedCreators.creatorId, ids),
						gte(t.savedCreators.createdAt, previousStart),
						eq(t.savedCreators.isActive, true),
						isNull(t.savedCreators.deletedAt)
					)
				),
			/* Every snapshot up to today, oldest first. The baseline for growth is
			   the last one on or before the window opened, or the first inside it
			   for a channel that is newer than the window. */
			db
				.select({
					socialAccountId: t.socialAccountSnapshots.socialAccountId,
					followers: t.socialAccountSnapshots.followers,
					followersSource: t.socialAccountSnapshots.followersSource,
					recordedOn: t.socialAccountSnapshots.recordedOn
				})
				.from(t.socialAccountSnapshots)
				.where(
					and(
						inArray(t.socialAccountSnapshots.creatorId, ids),
						lte(t.socialAccountSnapshots.recordedOn, now.toISOString().slice(0, 10))
					)
				)
				.orderBy(asc(t.socialAccountSnapshots.recordedOn))
		]);

	const inWindow = (at: Date | string) => new Date(at).getTime() >= windowStart.getTime();

	/** Sum of one event type per creator, each event decayed by its own age. */
	const decayedTotals = (rows: { creatorId: number; createdAt: Date | string }[]) => {
		const totals = new Map<number, number>();
		for (const row of rows) {
			if (!inWindow(row.createdAt)) continue;
			const weight = decayWeight(ageDays(row.createdAt), halfLife);
			totals.set(row.creatorId, (totals.get(row.creatorId) ?? 0) + weight);
		}
		return totals;
	};

	const bookingTotals = decayedTotals(bookings);
	const applicationTotals = decayedTotals(applications);
	const reviewTotals = decayedTotals(reviews);
	const saveTotals = decayedTotals(saves);

	/* Plain counts per window for momentum — decay would make the earlier
	   window look smaller simply for being earlier. */
	const windowCounts = new Map<number, { current: number; previous: number }>();
	for (const row of [...bookings, ...applications, ...reviews, ...saves]) {
		const counts = windowCounts.get(row.creatorId) ?? { current: 0, previous: 0 };
		if (inWindow(row.createdAt)) counts.current++;
		else counts.previous++;
		windowCounts.set(row.creatorId, counts);
	}

	/* The baseline snapshot per channel: last on or before the window opened,
	   else the first one inside it. */
	const baseline = new Map<number, { followers: number; followersSource: string }>();
	for (const snapshot of snapshots) {
		const current = baseline.get(snapshot.socialAccountId);
		if (snapshot.recordedOn <= baselineDay || !current) {
			baseline.set(snapshot.socialAccountId, snapshot);
		}
	}

	/* The platform-wide average rating, over creators who have one — the prior
	   `ratingPriorReviews` pulls every rating towards. */
	const rated = creators.filter((creator) => creator.reviewsCount > 0);
	const priorMean = rated.length
		? rated.reduce((sum, creator) => sum + creator.averageRating, 0) / rated.length
		: 0;

	const minVerificationRank = VERIFICATION_ORDER.indexOf(config.minVerification);
	const allowedPlatforms = new Set(lists.audiencePlatformIds);
	const requiredPlatforms = new Set(lists.requirePlatformIds);
	const includeCategories = new Set(lists.includeCategoryIds);
	const excludeCategories = new Set(lists.excludeCategoryIds);
	const allowedTiers = new Set(lists.followerTiers);

	/*
	 * The board used to read reach off `creators.total_reach`, which for an
	 * imported profile is the researcher's combined estimate rather than the sum
	 * of its channels. While the audience settings are all at their defaults
	 * that figure is still what is read, so saving this screen without touching
	 * them re-ranks nobody. Any audience setting switches to the channels.
	 */
	const audienceIsDefault =
		config.reachMode === 'total' && !allowedPlatforms.size && config.unconfirmedDiscount <= 0;

	return creators.map((creator) => {
		const mine = socials.filter((row) => row.creatorId === creator.id);
		const myCategories = categories.filter((row) => row.creatorId === creator.id);
		const myLanguages = languages.filter((row) => row.creatorId === creator.id);

		const audience = measureAudience(mine as ChannelFigures[], {
			reachMode: config.reachMode,
			engagementMode: config.engagementMode,
			platformIds: lists.audiencePlatformIds,
			engagementCap: config.engagementCap,
			unconfirmedDiscount: config.unconfirmedDiscount,
			primaryPlatformId: creator.primaryPlatformId
		});

		const followers = audienceIsDefault ? creator.totalReach || audience.reach : audience.reach;
		const scoredReach = audienceIsDefault ? followers : audience.scoredReach;
		const tier = followerTier(followers);

		/* Growth, over the channels the audience settings count. */
		let growthNow = 0;
		let growthBase = 0;
		for (const channel of mine) {
			if (allowedPlatforms.size && !allowedPlatforms.has(channel.platformId)) continue;
			const base = baseline.get(channel.id);
			if (!base) continue;
			if (
				config.growthConfirmedOnly &&
				!(isConfirmed(channel.followersSource) && isConfirmed(base.followersSource))
			) {
				continue;
			}
			growthNow += channel.followers;
			growthBase += base.followers;
		}

		const counts = windowCounts.get(creator.id) ?? { current: 0, previous: 0 };
		const profileAge = ageDays(creator.createdAt);

		const values: SignalValues = {
			score: creator.score,
			reach: scoredReach,
			engagement: audience.scoredEngagement,
			engagedAudience: audience.engagedAudience,
			growth: growthPercent(growthNow, growthBase),
			confirmed: audience.confirmedShare,
			bookings: round(bookingTotals.get(creator.id) ?? 0),
			applications: round(applicationTotals.get(creator.id) ?? 0),
			reviews: round(reviewTotals.get(creator.id) ?? 0),
			rating: smoothedRating(
				creator.averageRating,
				creator.reviewsCount,
				priorMean,
				config.ratingPriorReviews
			),
			saves: round(saveTotals.get(creator.id) ?? 0),
			momentum: momentumValue(counts.current, counts.previous),
			responsiveness: creator.responseRate ?? 0,
			reliability: creator.onTimeRate ?? 0,
			newcomer: round(newcomerValue(profileAge)),
			verification: verificationValue(creator.verificationLevel)
		};

		const activity = values.bookings + values.applications + values.reviews + values.saves;
		const verificationRank = VERIFICATION_ORDER.indexOf(creator.verificationLevel);
		const categoryIds = myCategories.map((row) => row.categoryId);
		const claimed = creator.isClaimed || !!creator.userId;
		const staleBefore = now.getTime() - config.maxStatsAgeDays * DAY_MS;

		/*
		 * The first rule broken is the reason given. Market and category come
		 * first because "not in this country" is what an operator wants told, not
		 * "score too low"; the audience rules come before the rest because they
		 * are the ones this screen is most often used to tune.
		 */
		const reasons: [broken: boolean, reason: string][] = [
			[!!config.countryId && creator.countryId !== config.countryId, 'outside_market'],
			[categoryIds.some((id) => excludeCategories.has(id)), 'excluded_category'],
			[
				includeCategories.size > 0 && !categoryIds.some((id) => includeCategories.has(id)),
				'not_in_categories'
			],
			[config.requireClaimed && !claimed, 'unclaimed'],
			[config.requireChannel && mine.length === 0, 'no_channel'],
			[
				requiredPlatforms.size > 0 && !mine.some((row) => requiredPlatforms.has(row.platformId)),
				'no_platform'
			],
			[followers < config.minFollowers, 'min_reach'],
			[config.maxFollowers > 0 && followers > config.maxFollowers, 'max_reach'],
			[allowedTiers.size > 0 && !allowedTiers.has(tier), 'tier'],
			[
				config.minChannelFollowers > 0 && audience.largestChannel < config.minChannelFollowers,
				'min_channel_followers'
			],
			[
				config.minEngagementRate > 0 && audience.engagement < config.minEngagementRate,
				'min_engagement'
			],
			[
				config.maxEngagementRate > 0 && audience.engagement > config.maxEngagementRate,
				'max_engagement'
			],
			[config.requireConfirmedStats && audience.confirmedShare <= 0, 'unconfirmed_stats'],
			[
				config.maxStatsAgeDays > 0 &&
					(!audience.freshestUpdate || audience.freshestUpdate.getTime() < staleBefore),
				'stale_stats'
			],
			[creator.score < config.minScore, 'min_score'],
			[creator.averageRating < config.minRating, 'min_rating'],
			[verificationRank < minVerificationRank, 'min_verification'],
			[creator.completedBookings < config.minCompletedBookings, 'min_bookings'],
			/* Measured creators only: most profiles have no response rate yet, and
			   excluding all of them would empty the board to punish nobody. */
			[
				config.minResponseRate > 0 &&
					creator.responseRate !== null &&
					creator.responseRate < config.minResponseRate,
				'min_response_rate'
			],
			[config.minProfileAgeDays > 0 && profileAge < config.minProfileAgeDays, 'profile_too_new'],
			[config.maxProfileAgeDays > 0 && profileAge > config.maxProfileAgeDays, 'profile_too_old'],
			[config.requireAvailable && creator.availability !== 'available', 'unavailable'],
			[config.requireActivity && activity <= 0, 'no_activity']
		];
		const excludedReason = reasons.find(([broken]) => broken)?.[1] ?? null;

		return {
			creatorId: creator.id,
			username: creator.username,
			fullName: creator.fullName,
			avatar: creator.avatar,
			countryId: creator.countryId,
			countryName: creator.countryName,
			regionId: creator.regionId,
			city: creator.city,
			primaryPlatformId: creator.primaryPlatformId,
			categoryIds,
			facets: facetsOf({
				categories: myCategories,
				languages: myLanguages,
				channels: mine,
				countryId: creator.countryId,
				countryName: creator.countryName,
				regionId: creator.regionId,
				regionName: creator.regionName,
				city: creator.city,
				tier
			}),
			verificationLevel: creator.verificationLevel,
			availability: creator.availability,
			followers,
			tier,
			audience,
			channelCount: mine.length,
			ageDays: round(profileAge),
			values,
			excludedReason
		};
	});
}

/* ------------------------------------------------------------------ *
 * Board construction
 * ------------------------------------------------------------------ */

export type BoardEntry = {
	creatorId: number;
	rank: number;
	source: 'pinned' | 'algorithm' | 'manual';
	score: number;
	baseScore: number;
	multiplier: number;
	/** Points added for already holding a slot — see `incumbentBonus`. */
	bonus: number;
	candidate: Candidate;
	scored: ScoredCandidate | null;
	/** Set when an operator instruction, not the numbers, put this creator here. */
	note: string | null;
	/** Holds a slot kept for newcomers rather than one earned outright. */
	reserved?: boolean;
};

/** Why a ranked creator is on the bench rather than the board. */
export type BenchReason =
	| 'slots'
	| 'category_cap'
	| 'country_cap'
	| 'city_cap'
	| 'tier_cap'
	| 'platform_cap'
	| 'churn_limit';

export type BenchRow = Omit<BoardEntry, 'rank'> & { rank: null; benchReason: BenchReason };

export type BoardResult = {
	entries: BoardEntry[];
	/** Everything that was ranked, board first and then the bench, best first. */
	ranked: (BoardEntry | BenchRow)[];
	/** Everyone who never reached the ranking, and the rule that stopped them. */
	excluded: { candidate: Candidate; reason: string }[];
	stats: {
		creators: number;
		eligible: number;
		pinned: number;
		blocked: number;
		resting: number;
		/** Eligible creators kept off the board by a diversity cap. */
		cappedOut: number;
		/** Creators who would have entered but for the limit on newcomers per run. */
		churnHeld: number;
		/** Slots filled from the newcomer reservation. */
		newcomersReserved: number;
		exclusions: Record<string, number>;
	};
};

type BuildOptions = {
	config: TrendingConfigValues;
	overrides: OverrideRow[];
	now?: Date;
	/** Creators currently resting, from `trending_cooldowns`. */
	restingIds?: Set<number>;
	/** Creators on the live board — what the incumbent bonus and the churn limit read. */
	incumbentIds?: Set<number>;
	candidates?: Candidate[];
};

/**
 * Produces the board without touching a row.
 *
 * The order of operations is the policy, and it is deliberate:
 *
 * 1. blocks beat everything, and eligibility rules beat the ranking;
 * 2. rest beats the algorithm but not a pin;
 * 3. pins take their slots;
 * 4. the ranking fills the rest, highest first, skipping whoever a diversity
 *    cap or the per-run limit on new faces rules out;
 * 5. reserved newcomer slots are honoured last, by displacing the lowest
 *    algorithm entries — never a pin.
 *
 * Any other order lets a cap silently drop a creator an operator pinned by
 * hand, or lets the newcomer reservation be undone by the cap that follows it.
 */
export async function buildBoard(options: BuildOptions): Promise<BoardResult> {
	const { config, overrides } = options;
	const now = options.now ?? new Date();
	const candidates = options.candidates ?? (await gatherCandidates(config, now));
	const restingIds = options.restingIds ?? new Set<number>();
	const incumbentIds = options.incumbentIds ?? new Set<number>();

	const live = overrides.filter((override) => isLive(override, now));
	const blocked = new Set(live.filter((o) => o.kind === 'block').map((o) => o.creatorId));
	const pins = live
		.filter((o) => o.kind === 'pin')
		.sort((a, b) => (a.position || 999) - (b.position || 999) || a.id - b.id);
	const boosts = new Map(live.filter((o) => o.kind === 'boost').map((o) => [o.creatorId, o]));
	const noteFor = new Map(live.map((o) => [o.creatorId, o.note ?? null]));

	const byId = new Map(candidates.map((candidate) => [candidate.creatorId, candidate]));
	const exclusions: Record<string, number> = {};
	const excluded: BoardResult['excluded'] = [];
	const exclude = (candidate: Candidate, reason: string) => {
		exclusions[reason] = (exclusions[reason] ?? 0) + 1;
		excluded.push({ candidate, reason });
	};

	/* A blocked creator is off the board in every mode, including manual: a block
	   is the strongest thing an operator can say and it should not be undone by
	   a checkbox someone forgot to untick. */
	const pool = candidates.filter((candidate) => {
		if (blocked.has(candidate.creatorId)) {
			exclude(candidate, 'blocked');
			return false;
		}
		if (candidate.excludedReason) {
			exclude(candidate, candidate.excludedReason);
			return false;
		}
		return true;
	});

	const slots = Math.max(1, config.slots);
	const entries: BoardEntry[] = [];
	const bench: BenchRow[] = [];
	const taken = new Set<number>();

	const entryOf = (
		candidate: Candidate,
		source: BoardEntry['source'],
		scored: ScoredCandidate | null,
		bonus: number
	) => ({
		creatorId: candidate.creatorId,
		source,
		score: scored?.score ?? 0,
		baseScore: scored?.baseScore ?? 0,
		multiplier: scored?.multiplier ?? 1,
		bonus,
		candidate,
		scored,
		note: noteFor.get(candidate.creatorId) ?? null
	});

	const push = (
		candidate: Candidate,
		source: BoardEntry['source'],
		scored: ScoredCandidate | null,
		bonus = 0
	) => {
		if (taken.has(candidate.creatorId) || entries.length >= slots) return false;
		taken.add(candidate.creatorId);
		entries.push({ ...entryOf(candidate, source, scored, bonus), rank: entries.length + 1 });
		return true;
	};

	const stats = (): BoardResult['stats'] => ({
		creators: candidates.length,
		eligible: pool.length,
		pinned: entries.filter((entry) => entry.source === 'pinned').length,
		blocked: blocked.size,
		resting: exclusions.resting ?? 0,
		cappedOut: bench.filter((row) => row.benchReason.endsWith('_cap')).length,
		churnHeld: bench.filter((row) => row.benchReason === 'churn_limit').length,
		newcomersReserved: entries.filter((entry) => entry.reserved).length,
		exclusions
	});

	/* Manual mode: whatever an operator ticked on the creator record, in score
	   order. No signal is read, which is the whole point of the mode. */
	if (config.mode === 'manual') {
		const ticked = await db
			.select({ id: t.creators.id })
			.from(t.creators)
			.where(
				and(
					eq(t.creators.isTrending, true),
					eq(t.creators.isPublished, true),
					eq(t.creators.isActive, true),
					isNull(t.creators.deletedAt)
				)
			)
			.orderBy(desc(t.creators.score));

		for (const row of ticked) {
			const candidate = byId.get(row.id);
			if (candidate && !blocked.has(row.id)) push(candidate, 'manual', null);
		}

		return { entries, ranked: entries, excluded, stats: stats() };
	}

	/* Rotation rest applies to the algorithm only — an operator pinning someone
	   is overriding exactly this kind of rule on purpose. */
	const pinnedIds = new Set(
		config.mode === 'hybrid' ? pins.map((pin) => pin.creatorId).filter((id) => byId.has(id)) : []
	);

	const rankable = pool.filter((candidate) => {
		if (restingIds.has(candidate.creatorId) && !pinnedIds.has(candidate.creatorId)) {
			exclude(candidate, 'resting');
			return false;
		}
		return true;
	});

	/*
	 * The incumbent bonus is added after the weighted score and any boost, in
	 * points, so "worth five points" means the same thing whatever the weights
	 * are — and it is kept apart in the breakdown rather than folded in.
	 */
	const bonusFor = (creatorId: number) =>
		incumbentIds.has(creatorId) ? Math.max(0, config.incumbentBonus) : 0;

	const scored = scoreCandidates(
		rankable.map((candidate) => ({
			creatorId: candidate.creatorId,
			values: candidate.values,
			multiplier: boosts.get(candidate.creatorId)?.multiplier ?? 1
		})),
		{
			weights: weightsOf(config),
			normalization: config.normalization
		}
	)
		.map((row) => {
			const bonus = bonusFor(row.creatorId);
			return bonus ? { ...row, score: round(row.score + bonus) } : row;
		})
		.sort(compareCandidates);

	const scoredById = new Map(scored.map((row) => [row.creatorId, row]));

	/* Pins first, in the order the operator gave them. `pinnedFirst` off still
	   guarantees the slot — it just lets the algorithm decide who leads. */
	if (config.mode === 'hybrid' && config.pinnedFirst) {
		for (const pin of pins) {
			const candidate = byId.get(pin.creatorId);
			if (candidate && !blocked.has(pin.creatorId)) {
				push(candidate, 'pinned', scoredById.get(pin.creatorId) ?? null, bonusFor(pin.creatorId));
			}
		}
	}

	/* ---------------- Diversity caps ---------------- */

	type CapKey = 'category' | 'country' | 'city' | 'tier' | 'platform';
	const capLimit: Record<CapKey, number> = {
		category: config.maxPerCategory,
		country: config.maxPerCountry,
		city: config.maxPerCity,
		tier: config.maxPerTier,
		platform: config.maxPerPlatform
	};
	const used = new Map<string, number>();
	/* Every group a creator uses a cap place in. A city is keyed on the folded
	   name, like its lane; a creator with no primary platform uses no platform
	   place, as one with no country uses no country place. */
	const groupsOf = (candidate: Candidate): [CapKey, string][] => {
		const groups: [CapKey, string][] = candidate.categoryIds.map((id) => ['category', `${id}`]);
		if (candidate.countryId) groups.push(['country', `${candidate.countryId}`]);
		if (candidate.city?.trim()) groups.push(['city', candidate.city.trim().toLowerCase()]);
		groups.push(['tier', candidate.tier]);
		if (candidate.primaryPlatformId) groups.push(['platform', `${candidate.primaryPlatformId}`]);
		return groups;
	};
	const takePlaces = (candidate: Candidate) => {
		for (const [key, value] of groupsOf(candidate)) {
			used.set(`${key}:${value}`, (used.get(`${key}:${value}`) ?? 0) + 1);
		}
	};
	/* "At most three per category" has to mean three, so a creator carrying a
	   saturated category is skipped even if their other categories have room.
	   The first full cap found is the one reported. */
	const capReached = (candidate: Candidate): BenchReason | null => {
		for (const [key, value] of groupsOf(candidate)) {
			const limit = capLimit[key];
			if (limit > 0 && (used.get(`${key}:${value}`) ?? 0) >= limit) {
				return `${key}_cap` as BenchReason;
			}
		}
		return null;
	};

	/* Seed the caps with whatever the pins already used up, or a pin plus a cap
	   of one would let a second creator from the same category straight in. */
	for (const entry of entries) takePlaces(entry.candidate);

	const benchRow = (row: ScoredCandidate, candidate: Candidate, reason: BenchReason): BenchRow => ({
		...entryOf(candidate, 'algorithm', row, bonusFor(row.creatorId)),
		rank: null,
		benchReason: reason
	});

	/* ---------------- The ranking ---------------- */

	/*
	 * The limit on new faces only means something against a board that already
	 * exists. On the first run there are no incumbents, and applying it would
	 * publish a board of three when twelve were asked for.
	 */
	const newLimit =
		config.maxNewPerRun > 0 && incumbentIds.size > 0 ? config.maxNewPerRun : Infinity;
	let newcomersAdmitted = 0;
	const heldBack: { row: ScoredCandidate; candidate: Candidate }[] = [];

	for (const row of scored) {
		const candidate = byId.get(row.creatorId);
		if (!candidate || taken.has(row.creatorId)) continue;

		const isPinned = pinnedIds.has(row.creatorId);
		const cap = isPinned ? null : capReached(candidate);
		if (cap) {
			exclusions[cap] = (exclusions[cap] ?? 0) + 1;
			bench.push(benchRow(row, candidate, cap));
			continue;
		}

		if (entries.length >= slots) {
			bench.push(benchRow(row, candidate, 'slots'));
			continue;
		}

		const isNewFace = !isPinned && !incumbentIds.has(row.creatorId);
		if (isNewFace && newcomersAdmitted >= newLimit) {
			heldBack.push({ row, candidate });
			continue;
		}

		push(candidate, isPinned ? 'pinned' : 'algorithm', row, bonusFor(row.creatorId));
		takePlaces(candidate);
		if (isNewFace) newcomersAdmitted++;
	}

	/* The limit steadies the board; it is not meant to leave slots empty. If the
	   incumbents could not fill it, the held-back creators take what is left, in
	   score order, and only the rest wait for a later run. */
	for (const { row, candidate } of heldBack) {
		if (entries.length < slots && !capReached(candidate)) {
			push(candidate, 'algorithm', row, bonusFor(row.creatorId));
			takePlaces(candidate);
		} else {
			exclusions.churn_limit = (exclusions.churn_limit ?? 0) + 1;
			bench.push(benchRow(row, candidate, 'churn_limit'));
		}
	}

	/* ---------------- Reserved newcomer slots ---------------- */

	const isNewcomer = (candidate: Candidate) =>
		candidate.ageDays <= Math.max(0, config.newcomerMaxAgeDays);
	const wanted = Math.min(Math.max(0, config.newcomerSlots), slots);
	let short = wanted - entries.filter((entry) => isNewcomer(entry.candidate)).length;

	if (short > 0) {
		/* Only from the bench that was benched for room — slots or the per-run
		   limit. A creator a diversity cap ruled out stays ruled out. */
		const hopefuls = bench
			.filter(
				(row) =>
					(row.benchReason === 'slots' || row.benchReason === 'churn_limit') &&
					isNewcomer(row.candidate)
			)
			.sort((a, b) => b.score - a.score);

		for (const hopeful of hopefuls) {
			if (short <= 0) break;
			if (entries.length >= slots) {
				/* The lowest-placed algorithm entry that is not itself a newcomer. */
				const victimIndex = entries.findLastIndex(
					(entry) => entry.source === 'algorithm' && !entry.reserved && !isNewcomer(entry.candidate)
				);
				if (victimIndex < 0) break;
				const [victim] = entries.splice(victimIndex, 1);
				taken.delete(victim.creatorId);
				bench.push({ ...victim, rank: null, benchReason: 'slots' });
			}
			bench.splice(bench.indexOf(hopeful), 1);
			taken.add(hopeful.creatorId);
			const { benchReason: _benched, ...promoted } = hopeful;
			entries.push({ ...promoted, rank: entries.length + 1, reserved: true });
			short--;
		}
	}

	/* A pin that the caps or the slot count would have squeezed out still gets
	   its seat: it was promised one. */
	if (config.mode === 'hybrid' && !config.pinnedFirst) {
		for (const pin of pins) {
			const candidate = byId.get(pin.creatorId);
			if (!candidate || taken.has(pin.creatorId) || blocked.has(pin.creatorId)) continue;
			if (entries.length >= slots) {
				const victimIndex = entries.findLastIndex((entry) => entry.source !== 'pinned');
				if (victimIndex < 0) continue;
				const [victim] = entries.splice(victimIndex, 1);
				taken.delete(victim.creatorId);
				if (victim.scored) bench.push({ ...victim, rank: null, benchReason: 'slots' });
			}
			push(candidate, 'pinned', scoredById.get(pin.creatorId) ?? null, bonusFor(pin.creatorId));
		}
	}

	/* Final order. Pins that lead keep their operator order; everything else is
	   by score, so a reserved newcomer sits where their score puts them rather
	   than being tacked on the end. */
	const leading =
		config.mode === 'hybrid' && config.pinnedFirst
			? entries.filter((entry) => entry.source === 'pinned')
			: [];
	const rest = entries
		.filter((entry) => !leading.includes(entry))
		.sort((a, b) => b.score - a.score || a.creatorId - b.creatorId);
	const ordered = [...leading, ...rest];
	ordered.forEach((entry, index) => (entry.rank = index + 1));

	return {
		entries: ordered,
		ranked: [...ordered, ...bench.sort((a, b) => b.score - a.score || a.creatorId - b.creatorId)],
		excluded,
		stats: stats()
	};
}

/* ------------------------------------------------------------------ *
 * Lanes
 * ------------------------------------------------------------------ */

/**
 * The ranked pool as lane input.
 *
 * `ranked` is used rather than `entries` on purpose: a lane is allowed to be
 * eight creators deep in a category none of whom made a twelve-slot board, and
 * cutting lanes from the board alone would have made every lane a subset of
 * the same twelve faces.
 */
export const laneCandidatesOf = (board: BoardResult): LaneCandidate[] =>
	board.ranked.map((row) => ({
		creatorId: row.creatorId,
		score: row.score,
		source: row.source,
		facets: row.candidate.facets
	}));

/** The lanes a board would publish. Writes nothing — the preview uses this. */
export const laneBoardOf = (config: TrendingConfigValues, board: BoardResult): BuiltLane[] =>
	buildLanes(laneCandidatesOf(board), laneOptionsOf(config));

/* ------------------------------------------------------------------ *
 * Markets
 * ------------------------------------------------------------------ */

export type MarketBoard = { countryId: number; board: BoardResult; lanes: BuiltLane[] };

/**
 * One board per country, for the readers who are shown only their own.
 *
 * Each is `buildBoard` run again with every other country ruled out before
 * scoring — so a signal is normalised against that market's creators, its caps
 * and newcomer slots apply inside it, and it is as deep as the shared board
 * rather than whatever share of twelve slots that country happened to win.
 * A pin carries into its creator's own market and no other, since a pin skips
 * the eligibility rules that would otherwise have kept it out.
 *
 * A market with no one eligible publishes nothing, and a reader there is
 * served the shared board: an empty strip is not what "your country only"
 * should look like to someone from a country with no creators yet.
 */
export async function buildMarketBoards(options: {
	config: TrendingConfigValues;
	overrides: OverrideRow[];
	candidates: Candidate[];
	/** The shared board — manual mode has no ranking to redo, only this to cut. */
	shared: BoardResult;
	now?: Date;
	restingIds?: Set<number>;
	/** Each market's live board, for its own incumbent bonus and churn limit. */
	incumbents?: Map<number, Set<number>>;
}): Promise<MarketBoard[]> {
	const { config, candidates } = options;
	/* A board already restricted to one market has no other market to publish. */
	if (config.countryId) return [];

	const countryOf = new Map(
		candidates.map((candidate) => [candidate.creatorId, candidate.countryId])
	);
	const markets = [
		...new Set(
			candidates
				.filter((candidate) => candidate.countryId && !candidate.excludedReason)
				.map((candidate) => candidate.countryId as number)
		)
	].sort((a, b) => a - b);

	const laneOptions = laneOptionsOf(config);
	/* Everyone in a market's lanes is from that market, so its one country lane
	   would be the market's own board again under another name. */
	laneOptions.limits.country = 0;

	const boards: MarketBoard[] = [];
	for (const countryId of markets) {
		let board: BoardResult;
		if (config.mode === 'manual') {
			/* No signal is read in manual mode, so there is nothing to re-rank: the
			   market's board is its own ticked creators, in the shared order. */
			const entries = options.shared.entries
				.filter((entry) => entry.candidate.countryId === countryId)
				.map((entry, index) => ({ ...entry, rank: index + 1 }));
			board = { ...options.shared, entries, ranked: entries };
		} else {
			board = await buildBoard({
				config: { ...config, countryId },
				overrides: options.overrides.filter(
					(override) => override.kind !== 'pin' || countryOf.get(override.creatorId) === countryId
				),
				now: options.now,
				restingIds: options.restingIds,
				incumbentIds: options.incumbents?.get(countryId) ?? new Set(),
				candidates: candidates.map((candidate) =>
					candidate.excludedReason || candidate.countryId === countryId
						? candidate
						: { ...candidate, excludedReason: 'outside_market' }
				)
			});
		}
		if (board.entries.length) {
			boards.push({ countryId, board, lanes: buildLanes(laneCandidatesOf(board), laneOptions) });
		}
	}
	return boards;
}

/* ------------------------------------------------------------------ *
 * Publishing
 * ------------------------------------------------------------------ */

/** Creators whose rest has not run out yet. Expired rows are cleared first. */
export async function loadCooldowns(now: Date = new Date()): Promise<Set<number>> {
	const rows = await db
		.select({ creatorId: t.trendingCooldowns.creatorId })
		.from(t.trendingCooldowns)
		.where(gte(t.trendingCooldowns.restingUntil, now));
	return new Set(rows.map((row) => row.creatorId));
}

export type RunOptions = {
	actorId?: string | null;
	actorLabel?: string | null;
	trigger?: 'manual' | 'auto' | 'settings';
	note?: string | null;
};

export type RunResult = {
	runId: number | null;
	entryCount: number;
	laneCount: number;
	/** Markets that got a board of their own — see `buildMarketBoards`. */
	marketCount: number;
	changedCount: number;
	stats: BoardResult['stats'];
	skipped?: 'frozen';
};

/**
 * Recomputes and publishes the board.
 *
 * Everything the run writes — the entries, the rotation rests, the flag on
 * `creators` and the history row — goes in one transaction. A half-applied run
 * would leave the homepage listing creators the board no longer contains.
 */
export async function runTrending(options: RunOptions = {}): Promise<RunResult> {
	const started = Date.now();
	const now = new Date();
	const config = await ensureTrendingConfig(options.actorId);
	const values = withLists({
		...TRENDING_DEFAULTS,
		...config,
		countryId: config.countryId ?? 0
	} as TrendingConfigValues);

	if (config.isFrozen) {
		return {
			runId: null,
			entryCount: 0,
			laneCount: 0,
			marketCount: 0,
			changedCount: 0,
			stats: emptyStats(),
			skipped: 'frozen'
		};
	}

	const [overrides, previous, previousMarkets, resting, candidates] = await Promise.all([
		db.select().from(t.trendingOverrides).where(isNull(t.trendingOverrides.deletedAt)),
		db.select().from(t.trendingEntries),
		db
			.select({
				countryId: t.trendingMarketEntries.countryId,
				creatorId: t.trendingMarketEntries.creatorId
			})
			.from(t.trendingMarketEntries),
		loadCooldowns(now),
		/* Gathered once and shared: the market boards rank the same measurements
		   the shared board does, not a second reading taken moments later. */
		gatherCandidates(values, now)
	]);

	/*
	 * Rotation: a creator who has held a slot for longer than `maxTenureDays`
	 * steps down and rests. Without this the board is a lock-in — the accounts
	 * that trend get the traffic that keeps them trending.
	 */
	const rotateOut = new Map<number, Date>();
	if (values.maxTenureDays > 0) {
		const tenureCutoff = new Date(now.getTime() - values.maxTenureDays * 86_400_000);
		for (const entry of previous) {
			if (entry.firstRankedAt.getTime() <= tenureCutoff.getTime()) {
				rotateOut.set(
					entry.creatorId,
					new Date(now.getTime() + Math.max(1, values.cooldownDays) * 86_400_000)
				);
				resting.add(entry.creatorId);
			}
		}
	}

	const board = await buildBoard({
		config: values,
		overrides,
		now,
		restingIds: resting,
		incumbentIds: new Set(previous.map((entry) => entry.creatorId)),
		candidates
	});
	const lanes = laneBoardOf(values, board);

	/* Only published while some reader would be served one. Switching it on is
	   a settings save, and saving publishes, so there is no stale gap to fill. */
	const incumbents = new Map<number, Set<number>>();
	for (const entry of previousMarkets) {
		incumbents.set(
			entry.countryId,
			(incumbents.get(entry.countryId) ?? new Set()).add(entry.creatorId)
		);
	}
	const markets =
		effectiveLocalRanking(values.mode, values.localRanking) === 'only'
			? await buildMarketBoards({
					config: values,
					overrides,
					candidates,
					shared: board,
					now,
					restingIds: resting,
					incumbents
				})
			: [];

	const previousIds = new Set(previous.map((entry) => entry.creatorId));
	const nextIds = board.entries.map((entry) => entry.creatorId);
	const changedCount = nextIds.filter((id) => !previousIds.has(id)).length;
	const firstRanked = new Map(previous.map((entry) => [entry.creatorId, entry.firstRankedAt]));

	const runId = await db.transaction(async (tx) => {
		const insert = await tx.insert(t.trendingRuns).values({
			mode: values.mode,
			trigger: options.trigger ?? 'manual',
			actorId: options.actorId ?? null,
			actorLabel: options.actorLabel ?? null,
			candidateCount: board.stats.eligible,
			entryCount: board.entries.length,
			changedCount,
			durationMs: Date.now() - started,
			note: options.note ?? null,
			configSnapshot: snapshotOf(values)
		});
		const id = insertedId(insert) || null;

		await tx.delete(t.trendingEntries);
		if (board.entries.length) {
			await tx.insert(t.trendingEntries).values(
				board.entries.map((entry) => ({
					creatorId: entry.creatorId,
					rank: entry.rank,
					trendingScore: entry.score,
					source: entry.source,
					breakdown: {
						components: entry.scored?.components ?? [],
						multiplier: entry.multiplier,
						baseScore: entry.baseScore,
						bonus: entry.bonus
					},
					runId: id,
					/* Tenure is measured from the first appearance, not this run, or
					   rotation would never fire for anyone who never drops off. */
					firstRankedAt: firstRanked.get(entry.creatorId) ?? now,
					computedAt: now
				}))
			);
		}

		/* Lanes are rewritten wholesale rather than reconciled: they carry no
		   tenure and no history, and a lane that no longer has four creators in
		   it should vanish rather than linger with a stale membership. */
		await tx.delete(t.trendingLaneEntries);
		await tx.delete(t.trendingLanes);
		const laneSets: [marketCountryId: number | null, BuiltLane[]][] = [
			[null, lanes],
			...markets.map((market): [number, BuiltLane[]] => [market.countryId, market.lanes])
		];
		for (const [marketCountryId, set] of laneSets) {
			for (const [index, lane] of set.entries()) {
				const inserted = await tx.insert(t.trendingLanes).values({
					kind: lane.kind,
					refId: lane.refId,
					refKey: lane.refKey,
					label: lane.label,
					position: index + 1,
					size: lane.entries.length,
					topScore: lane.topScore,
					runId: id,
					marketCountryId,
					computedAt: now
				});
				const laneId = insertedId(inserted);
				await tx.insert(t.trendingLaneEntries).values(
					lane.entries.map((entry) => ({
						laneId,
						creatorId: entry.creatorId,
						rank: entry.rank,
						trendingScore: entry.score,
						source: entry.source
					}))
				);
			}
		}

		await tx.delete(t.trendingMarketEntries);
		const marketRows = markets.flatMap((market) =>
			market.board.entries.map((entry) => ({
				countryId: market.countryId,
				creatorId: entry.creatorId,
				rank: entry.rank,
				trendingScore: entry.score,
				source: entry.source,
				runId: id,
				computedAt: now
			}))
		);
		if (marketRows.length) await tx.insert(t.trendingMarketEntries).values(marketRows);

		for (const [creatorId, restingUntil] of rotateOut) {
			await tx
				.insert(t.trendingCooldowns)
				.values({ creatorId, restingUntil, reason: 'rotation' })
				.onDuplicateKeyUpdate({ set: { restingUntil, reason: 'rotation' } });
		}

		/* The flag every card, badge and discovery filter already reads is
		   rewritten from the board, so nothing downstream has to know this
		   machinery exists. */
		await tx
			.update(t.creators)
			.set({ isTrending: false })
			.where(
				nextIds.length
					? and(eq(t.creators.isTrending, true), notInArray(t.creators.id, nextIds))
					: eq(t.creators.isTrending, true)
			);
		if (nextIds.length) {
			await tx.update(t.creators).set({ isTrending: true }).where(inArray(t.creators.id, nextIds));
		}

		await tx
			.update(t.trendingConfig)
			.set({ lastRunAt: now })
			.where(eq(t.trendingConfig.id, config.id));

		return id;
	});

	return {
		runId,
		entryCount: board.entries.length,
		laneCount: lanes.length,
		marketCount: markets.length,
		changedCount,
		stats: board.stats
	};
}

/**
 * Runs the board if the schedule says it is due.
 *
 * There is no job runner in this deployment, so the public page that reads the
 * board is what notices it has gone stale. The work is not awaited by the page
 * — a visitor should never pay for a recompute — and a module-level lock keeps
 * concurrent requests from starting several at once.
 */
let refreshInFlight: Promise<unknown> | null = null;

export async function maybeAutoRefresh(): Promise<void> {
	if (refreshInFlight) return;

	const config = await getTrendingConfig();
	if (!config || !config.autoRefresh || config.isFrozen) return;

	const dueAfter = Math.max(5, config.refreshIntervalMinutes) * 60_000;
	if (config.lastRunAt && Date.now() - config.lastRunAt.getTime() < dueAfter) return;

	refreshInFlight = runTrending({ trigger: 'auto', actorLabel: 'Scheduler' })
		.catch((err) => console.error('Trending auto-refresh failed:', err))
		.finally(() => {
			refreshInFlight = null;
		});
}

/* ------------------------------------------------------------------ *
 * Reading the published board
 * ------------------------------------------------------------------ */

/** The live board with the creator detail the admin table shows. */
export async function listTrendingBoard() {
	return db
		.select({
			creatorId: t.trendingEntries.creatorId,
			rank: t.trendingEntries.rank,
			trendingScore: t.trendingEntries.trendingScore,
			source: t.trendingEntries.source,
			breakdown: t.trendingEntries.breakdown,
			firstRankedAt: t.trendingEntries.firstRankedAt,
			computedAt: t.trendingEntries.computedAt,
			username: t.creators.username,
			fullName: t.creators.fullName,
			avatar: t.creators.avatar,
			score: t.creators.score,
			totalReach: t.creators.totalReach,
			averageRating: t.creators.averageRating,
			verificationLevel: t.creators.verificationLevel,
			city: t.creators.city,
			countryName: t.countries.name,
			countryFlag: t.countries.flag
		})
		.from(t.trendingEntries)
		.innerJoin(t.creators, eq(t.creators.id, t.trendingEntries.creatorId))
		.leftJoin(t.countries, eq(t.countries.id, t.creators.countryId))
		.orderBy(asc(t.trendingEntries.rank));
}

/** One published lane and everyone in it, in lane order. */
export type PublishedLane = {
	id: number;
	kind: (typeof t.trendingLaneKindEnum)[number];
	refId: number | null;
	refKey: string | null;
	label: string;
	position: number;
	entries: { creatorId: number; rank: number; fullName: string; username: string }[];
};

/**
 * The lanes of the live board.
 *
 * One query for the lanes and one for their members rather than a join per
 * lane: there are at most a couple of dozen lanes, and the homepage is not the
 * place to find out how many round trips a strip of chips costs.
 */
export async function listPublishedLanes(
	/** A market's own lanes, or null for the lanes of the shared board. */
	marketCountryId: number | null = null
): Promise<PublishedLane[]> {
	const lanes = await db
		.select()
		.from(t.trendingLanes)
		.where(
			marketCountryId === null
				? isNull(t.trendingLanes.marketCountryId)
				: eq(t.trendingLanes.marketCountryId, marketCountryId)
		)
		.orderBy(asc(t.trendingLanes.position));
	if (!lanes.length) return [];

	const entries = await db
		.select({
			laneId: t.trendingLaneEntries.laneId,
			creatorId: t.trendingLaneEntries.creatorId,
			rank: t.trendingLaneEntries.rank,
			fullName: t.creators.fullName,
			username: t.creators.username
		})
		.from(t.trendingLaneEntries)
		.innerJoin(t.creators, eq(t.creators.id, t.trendingLaneEntries.creatorId))
		/* The lane was published against a creator who was live at the time; one
		   unpublished since should drop out of the strip without a recompute. */
		.where(and(eq(t.creators.isPublished, true), isNull(t.creators.deletedAt)))
		.orderBy(asc(t.trendingLaneEntries.laneId), asc(t.trendingLaneEntries.rank));

	return lanes.map((lane) => ({
		id: lane.id,
		kind: lane.kind,
		refId: lane.refId,
		refKey: lane.refKey,
		label: lane.label,
		position: lane.position,
		entries: entries
			.filter((entry) => entry.laneId === lane.id)
			.map(({ creatorId, rank, fullName, username }) => ({ creatorId, rank, fullName, username }))
	}));
}

/**
 * Moves the reader's own city, region and country to the front of the strip.
 *
 * Read-time rather than run-time, for the same reason the local boost is: one
 * board is published for everybody, and where the reader is is a fact about
 * this request. Returns the published order untouched when the operator has
 * the setting off or we could not tell where the reader is.
 */
export async function orderLanesForViewer<
	T extends { kind: string; refId: number | null; refKey: string | null; position: number }
>(lanes: T[]): Promise<T[]> {
	if (lanes.length < 2) return lanes;

	const config = await getTrendingConfig();
	if (!(config?.laneLocalFirst ?? TRENDING_DEFAULTS.laneLocalFirst)) return lanes;

	const viewer = await getViewerLocation();
	if (!viewer) return lanes;

	return [...lanes].sort(
		(a, b) => laneLocalRank(b, viewer) - laneLocalRank(a, viewer) || a.position - b.position
	);
}

/* ------------------------------------------------------------------ *
 * Ranking for the reader
 * ------------------------------------------------------------------ */

/**
 * What a creator's location is worth to the reader looking at this request,
 * or null when it is worth nothing.
 *
 * Null covers two situations that mean the same thing to a list — the operator
 * has the setting off, or we could not tell where the reader is — and
 * collapsing them here keeps every caller down to one branch: rank by this, or
 * leave the order alone.
 */
export async function getLocalRanker(): Promise<((creator: CreatorLocation) => number) | null> {
	const config = await getTrendingConfig();
	const mode = effectiveLocalRanking(
		config?.mode ?? TRENDING_DEFAULTS.mode,
		config?.localRanking ?? TRENDING_DEFAULTS.localRanking
	);
	if (mode === 'off') return null;

	const viewer = await getViewerLocation();
	if (!viewer) return null;

	/* `only` is about the reader's country, so it matches on the country — the
	   same line the market boards are drawn on. */
	const level = mode === 'only' ? 'country' : (config?.localMatch ?? TRENDING_DEFAULTS.localMatch);
	const points = config?.localBoost ?? TRENDING_DEFAULTS.localBoost;

	return (creator) => localBonus(matchesLocation(creator, viewer, level), mode, points);
}

/**
 * The market whose own board this reader is served, or null for the shared
 * board.
 *
 * Null unless the reader is to see their country only, we know which country
 * that is, and the last run published a board for it. The last condition is
 * the one that keeps a reader from a market with no creators — or a site whose
 * last run predates the setting — looking at an empty strip.
 *
 * Memoised on `locals`: the strip and its lanes both ask, in parallel.
 */
export function getViewerMarket(): Promise<number | null> {
	try {
		const { locals } = getRequestEvent();
		return (locals.trendingMarket ??= resolveViewerMarket());
	} catch {
		/* Outside a request — nobody is reading. */
		return Promise.resolve(null);
	}
}

async function resolveViewerMarket(): Promise<number | null> {
	const config = await getTrendingConfig();
	const mode = effectiveLocalRanking(
		config?.mode ?? TRENDING_DEFAULTS.mode,
		config?.localRanking ?? TRENDING_DEFAULTS.localRanking
	);
	if (mode !== 'only' || config?.countryId) return null;

	const viewer = await getViewerLocation();
	if (!viewer?.countryId) return null;

	const published = await db
		.select({ id: t.trendingMarketEntries.id })
		.from(t.trendingMarketEntries)
		.where(eq(t.trendingMarketEntries.countryId, viewer.countryId))
		.limit(1);
	return published.length ? viewer.countryId : null;
}

/** Creator ids in board order — how the public strip knows what comes first. */
export async function trendingOrder(): Promise<number[]> {
	const rows = await db
		.select({ creatorId: t.trendingEntries.creatorId })
		.from(t.trendingEntries)
		.orderBy(asc(t.trendingEntries.rank));
	return rows.map((row) => row.creatorId);
}

export async function listTrendingRuns(limit = 15) {
	return db.select().from(t.trendingRuns).orderBy(desc(t.trendingRuns.id)).limit(limit);
}

export async function listTrendingCooldowns() {
	return db
		.select({
			creatorId: t.trendingCooldowns.creatorId,
			restingUntil: t.trendingCooldowns.restingUntil,
			reason: t.trendingCooldowns.reason,
			username: t.creators.username,
			fullName: t.creators.fullName
		})
		.from(t.trendingCooldowns)
		.innerJoin(t.creators, eq(t.creators.id, t.trendingCooldowns.creatorId))
		.orderBy(asc(t.trendingCooldowns.restingUntil));
}

const emptyStats = (): BoardResult['stats'] => ({
	creators: 0,
	eligible: 0,
	pinned: 0,
	blocked: 0,
	resting: 0,
	cappedOut: 0,
	churnHeld: 0,
	newcomersReserved: 0,
	exclusions: {}
});

/** Saved weight presets, alphabetically. */
export async function listTrendingPresets() {
	return db
		.select({
			id: t.trendingPresets.id,
			name: t.trendingPresets.name,
			description: t.trendingPresets.description,
			weights: t.trendingPresets.weights
		})
		.from(t.trendingPresets)
		.orderBy(asc(t.trendingPresets.name));
}

/** The knobs as they stood for a run, minus the bookkeeping columns. */
const snapshotOf = (values: TrendingConfigValues): Record<string, unknown> =>
	Object.fromEntries(
		(Object.keys(TRENDING_DEFAULTS) as (keyof TrendingConfigValues)[]).map((key) => [
			key,
			values[key]
		])
	);

const round = (value: number) => Math.round(value * 100) / 100;

export type { BuiltLane, TrendingSignal };
