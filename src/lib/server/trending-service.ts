import { and, asc, desc, eq, gte, inArray, isNull, ne, notInArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { liveSocialFilter, ratingReviewFilter } from '$lib/server/db/rollups';
import {
	TRENDING_SIGNALS,
	WEIGHT_COLUMN,
	compareCandidates,
	decayWeight,
	newcomerValue,
	scoreCandidates,
	verificationValue,
	type ScoredCandidate,
	type SignalValues,
	type TrendingSignal,
	type TrendingWeights
} from '$lib/domain/trending';

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
	minScore: number;
	minFollowers: number;
	minRating: number;
	minVerification: (typeof t.verificationLevelEnum)[number];
	requireAvailable: boolean;
	requireChannel: boolean;
	requireActivity: boolean;
	maxPerCategory: number;
	maxPerCountry: number;
	maxTenureDays: number;
	cooldownDays: number;
	pinnedFirst: boolean;
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
	minScore: 0,
	minFollowers: 0,
	minRating: 0,
	minVerification: 'unverified',
	requireAvailable: false,
	requireChannel: true,
	requireActivity: false,
	maxPerCategory: 0,
	maxPerCountry: 0,
	maxTenureDays: 0,
	cooldownDays: 0,
	pinnedFirst: true,
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

/** The saved config merged over the defaults — always complete, never null. */
export async function getTrendingConfigValues(): Promise<
	TrendingConfigValues & { id: number | null; lastRunAt: Date | null }
> {
	const row = await getTrendingConfig();
	if (!row) return { ...TRENDING_DEFAULTS, id: null, lastRunAt: null };
	return { ...TRENDING_DEFAULTS, ...row, id: row.id, lastRunAt: row.lastRunAt };
}

/** The config row, created from the defaults on first use. */
export async function ensureTrendingConfig(actorId?: string | null): Promise<TrendingConfigRow> {
	const existing = await getTrendingConfig();
	if (existing) return existing;
	await db.insert(t.trendingConfig).values({ ...TRENDING_DEFAULTS, createdBy: actorId ?? null });
	const created = await getTrendingConfig();
	if (!created) throw new Error('trending config could not be created');
	return created;
}

export const weightsOf = (config: Partial<TrendingConfigValues>): TrendingWeights =>
	Object.fromEntries(
		TRENDING_SIGNALS.map((key) => [
			key,
			Math.max(0, Number((config as any)[WEIGHT_COLUMN[key]] ?? 0))
		])
	) as TrendingWeights;

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

const isLive = (override: { expiresAt: Date | null }, now: Date) =>
	!override.expiresAt || override.expiresAt.getTime() > now.getTime();

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
	categoryIds: number[];
	verificationLevel: string;
	availability: string;
	followers: number;
	channelCount: number;
	values: SignalValues;
	/** Why this creator cannot be on the board, or null when they can. */
	excludedReason: string | null;
};

/**
 * Every published creator with the ten raw signals measured for them.
 *
 * The activity signals are summed in application code rather than SQL because
 * each event is decayed by its own age — a query that returned a plain count
 * per creator would have thrown away the timestamps the decay needs. The rows
 * pulled are only those inside the window, which is what keeps this bounded.
 */
export async function gatherCandidates(
	config: TrendingConfigValues,
	now: Date = new Date()
): Promise<Candidate[]> {
	const windowStart = new Date(now.getTime() - Math.max(1, config.windowDays) * 86_400_000);
	const halfLife = Math.max(0, config.halfLifeDays);
	const ageDays = (at: Date | string | null) =>
		at ? (now.getTime() - new Date(at).getTime()) / 86_400_000 : Infinity;

	const creators = await db
		.select({
			id: t.creators.id,
			username: t.creators.username,
			fullName: t.creators.fullName,
			avatar: t.creators.avatar,
			countryId: t.creators.countryId,
			countryName: t.countries.name,
			score: t.creators.score,
			totalReach: t.creators.totalReach,
			averageRating: t.creators.averageRating,
			verificationLevel: t.creators.verificationLevel,
			availability: t.creators.availability,
			createdAt: t.creators.createdAt
		})
		.from(t.creators)
		.leftJoin(t.countries, eq(t.countries.id, t.creators.countryId))
		.where(
			and(
				eq(t.creators.isActive, true),
				isNull(t.creators.deletedAt),
				eq(t.creators.isPublished, true)
			)
		);

	if (!creators.length) return [];
	const ids = creators.map((row) => row.id);

	const [socials, categories, bookings, applications, reviews, saves] = await Promise.all([
		db
			.select({
				creatorId: t.socialAccounts.creatorId,
				followers: t.socialAccounts.followers,
				engagementRate: t.socialAccounts.engagementRate
			})
			.from(t.socialAccounts)
			.where(and(inArray(t.socialAccounts.creatorId, ids), liveSocialFilter())),
		db
			.select({
				creatorId: t.creatorCategories.creatorId,
				categoryId: t.creatorCategories.categoryId
			})
			.from(t.creatorCategories)
			.where(inArray(t.creatorCategories.creatorId, ids)),
		db
			.select({ creatorId: t.bookings.creatorId, createdAt: t.bookings.createdAt })
			.from(t.bookings)
			.where(
				and(
					inArray(t.bookings.creatorId, ids),
					gte(t.bookings.createdAt, windowStart),
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
					gte(t.applications.createdAt, windowStart),
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
					gte(t.reviews.createdAt, windowStart),
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
					gte(t.savedCreators.createdAt, windowStart),
					eq(t.savedCreators.isActive, true),
					isNull(t.savedCreators.deletedAt)
				)
			)
	]);

	/** Sum of one event type per creator, each event decayed by its own age. */
	const decayedTotals = (rows: { creatorId: number; createdAt: Date | string }[]) => {
		const totals = new Map<number, number>();
		for (const row of rows) {
			const weight = decayWeight(ageDays(row.createdAt), halfLife);
			totals.set(row.creatorId, (totals.get(row.creatorId) ?? 0) + weight);
		}
		return totals;
	};

	const bookingTotals = decayedTotals(bookings);
	const applicationTotals = decayedTotals(applications);
	const reviewTotals = decayedTotals(reviews);
	const saveTotals = decayedTotals(saves);

	const minVerificationRank = VERIFICATION_ORDER.indexOf(config.minVerification);

	return creators.map((creator) => {
		const mine = socials.filter((row) => row.creatorId === creator.id);
		const followers = mine.reduce((sum, row) => sum + row.followers, 0);
		const engagement = mine.length
			? mine.reduce((sum, row) => sum + row.engagementRate, 0) / mine.length
			: 0;

		const values: SignalValues = {
			score: creator.score,
			reach: creator.totalReach || followers,
			engagement,
			bookings: round(bookingTotals.get(creator.id) ?? 0),
			applications: round(applicationTotals.get(creator.id) ?? 0),
			reviews: round(reviewTotals.get(creator.id) ?? 0),
			rating: creator.averageRating,
			saves: round(saveTotals.get(creator.id) ?? 0),
			newcomer: round(newcomerValue(ageDays(creator.createdAt))),
			verification: verificationValue(creator.verificationLevel)
		};

		const activity = values.bookings + values.applications + values.reviews + values.saves;
		const verificationRank = VERIFICATION_ORDER.indexOf(creator.verificationLevel);

		let excludedReason: string | null = null;
		if (creator.score < config.minScore) excludedReason = 'min_score';
		else if ((creator.totalReach || followers) < config.minFollowers) excludedReason = 'min_reach';
		else if (creator.averageRating < config.minRating) excludedReason = 'min_rating';
		else if (verificationRank < minVerificationRank) excludedReason = 'min_verification';
		else if (config.requireChannel && mine.length === 0) excludedReason = 'no_channel';
		else if (config.requireAvailable && creator.availability !== 'available') {
			excludedReason = 'unavailable';
		} else if (config.requireActivity && activity <= 0) excludedReason = 'no_activity';

		return {
			creatorId: creator.id,
			username: creator.username,
			fullName: creator.fullName,
			avatar: creator.avatar,
			countryId: creator.countryId,
			countryName: creator.countryName,
			categoryIds: categories.filter((c) => c.creatorId === creator.id).map((c) => c.categoryId),
			verificationLevel: creator.verificationLevel,
			availability: creator.availability,
			followers: creator.totalReach || followers,
			channelCount: mine.length,
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
	candidate: Candidate;
	scored: ScoredCandidate | null;
	/** Set when an operator instruction, not the numbers, put this creator here. */
	note: string | null;
};

export type BoardResult = {
	entries: BoardEntry[];
	/** Everything that was ranked, best first — the tail is the bench. */
	ranked: (BoardEntry | (Omit<BoardEntry, 'rank'> & { rank: null }))[];
	stats: {
		creators: number;
		eligible: number;
		pinned: number;
		blocked: number;
		resting: number;
		/** Eligible creators kept off the board by a diversity cap. */
		cappedOut: number;
		exclusions: Record<string, number>;
	};
};

type BuildOptions = {
	config: TrendingConfigValues;
	overrides: OverrideRow[];
	now?: Date;
	/** Creators currently resting, from `trending_cooldowns`. */
	restingIds?: Set<number>;
	candidates?: Candidate[];
};

/**
 * Produces the board without touching a row.
 *
 * The order of operations is the policy, and it is deliberate: blocks beat
 * everything, rest beats the algorithm but not a pin, pins take their slots,
 * and the diversity caps are applied last against the ranked remainder. Any
 * other order lets a cap silently drop a creator an operator pinned by hand.
 */
export async function buildBoard(options: BuildOptions): Promise<BoardResult> {
	const { config, overrides } = options;
	const now = options.now ?? new Date();
	const candidates = options.candidates ?? (await gatherCandidates(config, now));
	const restingIds = options.restingIds ?? new Set<number>();

	const live = overrides.filter((override) => isLive(override, now));
	const blocked = new Set(live.filter((o) => o.kind === 'block').map((o) => o.creatorId));
	const pins = live
		.filter((o) => o.kind === 'pin')
		.sort((a, b) => (a.position || 999) - (b.position || 999) || a.id - b.id);
	const boosts = new Map(live.filter((o) => o.kind === 'boost').map((o) => [o.creatorId, o]));
	const noteFor = new Map(live.map((o) => [o.creatorId, o.note ?? null]));

	const byId = new Map(candidates.map((candidate) => [candidate.creatorId, candidate]));
	const exclusions: Record<string, number> = {};
	const countExclusion = (reason: string) => {
		exclusions[reason] = (exclusions[reason] ?? 0) + 1;
	};

	/* A blocked creator is off the board in every mode, including manual: a block
	   is the strongest thing an operator can say and it should not be undone by
	   a checkbox someone forgot to untick. */
	const pool = candidates.filter((candidate) => {
		if (blocked.has(candidate.creatorId)) {
			countExclusion('blocked');
			return false;
		}
		if (candidate.excludedReason) {
			countExclusion(candidate.excludedReason);
			return false;
		}
		return true;
	});

	const slots = Math.max(1, config.slots);
	const entries: BoardEntry[] = [];
	const taken = new Set<number>();

	const push = (
		candidate: Candidate,
		source: BoardEntry['source'],
		scored: ScoredCandidate | null
	) => {
		if (taken.has(candidate.creatorId) || entries.length >= slots) return;
		taken.add(candidate.creatorId);
		entries.push({
			creatorId: candidate.creatorId,
			rank: entries.length + 1,
			source,
			score: scored?.score ?? 0,
			baseScore: scored?.baseScore ?? 0,
			multiplier: scored?.multiplier ?? 1,
			candidate,
			scored,
			note: noteFor.get(candidate.creatorId) ?? null
		});
	};

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

		return {
			entries,
			ranked: entries,
			stats: {
				creators: candidates.length,
				eligible: pool.length,
				pinned: 0,
				blocked: blocked.size,
				resting: 0,
				cappedOut: 0,
				exclusions
			}
		};
	}

	/* Rotation rest applies to the algorithm only — an operator pinning someone
	   is overriding exactly this kind of rule on purpose. */
	const pinnedIds = new Set(
		config.mode === 'hybrid' ? pins.map((pin) => pin.creatorId).filter((id) => byId.has(id)) : []
	);

	const rankable = pool.filter((candidate) => {
		if (restingIds.has(candidate.creatorId) && !pinnedIds.has(candidate.creatorId)) {
			countExclusion('resting');
			return false;
		}
		return true;
	});

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
	).sort(compareCandidates);

	const scoredById = new Map(scored.map((row) => [row.creatorId, row]));

	/* Pins first, in the order the operator gave them. `pinnedFirst` off still
	   guarantees the slot — it just lets the algorithm decide who leads. */
	if (config.mode === 'hybrid' && config.pinnedFirst) {
		for (const pin of pins) {
			const candidate = byId.get(pin.creatorId);
			if (candidate && !blocked.has(pin.creatorId)) {
				push(candidate, 'pinned', scoredById.get(pin.creatorId) ?? null);
			}
		}
	}

	const perCategory = new Map<number, number>();
	const perCountry = new Map<number, number>();
	const countsFor = (candidate: Candidate) => ({
		categories: candidate.categoryIds,
		country: candidate.countryId
	});

	/* Seed the caps with whatever the pins already used up, or a pin plus a cap
	   of one would let a second creator from the same category straight in. */
	for (const entry of entries) {
		const { categories, country } = countsFor(entry.candidate);
		for (const categoryId of categories) {
			perCategory.set(categoryId, (perCategory.get(categoryId) ?? 0) + 1);
		}
		if (country) perCountry.set(country, (perCountry.get(country) ?? 0) + 1);
	}

	let cappedOut = 0;
	const ranked: BoardResult['ranked'] = [...entries];

	for (const row of scored) {
		const candidate = byId.get(row.creatorId);
		if (!candidate || taken.has(row.creatorId)) continue;

		const isPinned = pinnedIds.has(row.creatorId);
		const { categories, country } = countsFor(candidate);

		/* "At most three per category" has to mean three, so a creator carrying a
		   saturated category is skipped even if their other categories have room. */
		const categoryFull =
			!isPinned &&
			config.maxPerCategory > 0 &&
			categories.some((id) => (perCategory.get(id) ?? 0) >= config.maxPerCategory);
		const countryFull =
			!isPinned &&
			config.maxPerCountry > 0 &&
			!!country &&
			(perCountry.get(country) ?? 0) >= config.maxPerCountry;

		if (categoryFull || countryFull) {
			cappedOut++;
			countExclusion(categoryFull ? 'category_cap' : 'country_cap');
			ranked.push({
				creatorId: row.creatorId,
				rank: null,
				source: 'algorithm',
				score: row.score,
				baseScore: row.baseScore,
				multiplier: row.multiplier,
				candidate,
				scored: row,
				note: null
			});
			continue;
		}

		if (entries.length < slots) {
			push(candidate, isPinned ? 'pinned' : 'algorithm', row);
			for (const id of categories) perCategory.set(id, (perCategory.get(id) ?? 0) + 1);
			if (country) perCountry.set(country, (perCountry.get(country) ?? 0) + 1);
			ranked.push(entries[entries.length - 1]);
		} else {
			ranked.push({
				creatorId: row.creatorId,
				rank: null,
				source: 'algorithm',
				score: row.score,
				baseScore: row.baseScore,
				multiplier: row.multiplier,
				candidate,
				scored: row,
				note: null
			});
		}
	}

	/* A pin that the caps or the slot count would have squeezed out still gets
	   its seat: it was promised one. */
	if (config.mode === 'hybrid' && !config.pinnedFirst) {
		for (const pin of pins) {
			const candidate = byId.get(pin.creatorId);
			if (!candidate || taken.has(pin.creatorId) || blocked.has(pin.creatorId)) continue;
			if (entries.length >= slots) entries.pop();
			push(candidate, 'pinned', scoredById.get(pin.creatorId) ?? null);
		}
		entries.sort((a, b) => b.score - a.score || a.creatorId - b.creatorId);
		entries.forEach((entry, index) => (entry.rank = index + 1));
	}

	return {
		entries,
		ranked,
		stats: {
			creators: candidates.length,
			eligible: pool.length,
			pinned: entries.filter((entry) => entry.source === 'pinned').length,
			blocked: blocked.size,
			resting: exclusions.resting ?? 0,
			cappedOut,
			exclusions
		}
	};
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
	const values = { ...TRENDING_DEFAULTS, ...config } as TrendingConfigValues;

	if (config.isFrozen) {
		return { runId: null, entryCount: 0, changedCount: 0, stats: emptyStats(), skipped: 'frozen' };
	}

	const [overrides, previous, resting] = await Promise.all([
		db.select().from(t.trendingOverrides).where(isNull(t.trendingOverrides.deletedAt)),
		db.select().from(t.trendingEntries),
		loadCooldowns(now)
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

	const board = await buildBoard({ config: values, overrides, now, restingIds: resting });

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
		const id = Number((insert as any).insertId ?? (insert as any)[0]?.insertId ?? 0) || null;

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
						baseScore: entry.baseScore
					},
					runId: id,
					/* Tenure is measured from the first appearance, not this run, or
					   rotation would never fire for anyone who never drops off. */
					firstRankedAt: firstRanked.get(entry.creatorId) ?? now,
					computedAt: now
				}))
			);
		}

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

	return { runId, entryCount: board.entries.length, changedCount, stats: board.stats };
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
			countryName: t.countries.name,
			countryFlag: t.countries.flag
		})
		.from(t.trendingEntries)
		.innerJoin(t.creators, eq(t.creators.id, t.trendingEntries.creatorId))
		.leftJoin(t.countries, eq(t.countries.id, t.creators.countryId))
		.orderBy(asc(t.trendingEntries.rank));
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
	exclusions: {}
});

/** The knobs as they stood for a run, minus the bookkeeping columns. */
const snapshotOf = (values: TrendingConfigValues): Record<string, unknown> =>
	Object.fromEntries(Object.keys(TRENDING_DEFAULTS).map((key) => [key, (values as any)[key]]));

const round = (value: number) => Math.round(value * 100) / 100;

export type { TrendingSignal };
