import * as m from '$lib/paraglide/messages';

/**
 * The trending ranking, as arithmetic only.
 *
 * Everything here is pure: give it the same numbers and it returns the same
 * board. The gathering of those numbers — which bookings count, which channels
 * are live, who is pinned — lives in $lib/server/trending-service.ts, and the
 * admin screen renders the breakdown this module produces, so the ranking an
 * operator is shown is the one that actually ran.
 */

export const TRENDING_SIGNALS = [
	'score',
	'reach',
	'engagement',
	'engagedAudience',
	'growth',
	'confirmed',
	'bookings',
	'applications',
	'reviews',
	'rating',
	'saves',
	'momentum',
	'responsiveness',
	'reliability',
	'newcomer',
	'verification'
] as const;

export type TrendingSignal = (typeof TRENDING_SIGNALS)[number];

/** The `trending_config` column each signal's weight is stored in. */
export const WEIGHT_COLUMN = {
	score: 'weightScore',
	reach: 'weightReach',
	engagement: 'weightEngagement',
	engagedAudience: 'weightEngagedAudience',
	growth: 'weightGrowth',
	confirmed: 'weightConfirmed',
	bookings: 'weightBookings',
	applications: 'weightApplications',
	reviews: 'weightReviews',
	rating: 'weightRating',
	saves: 'weightSaves',
	momentum: 'weightMomentum',
	responsiveness: 'weightResponsiveness',
	reliability: 'weightReliability',
	newcomer: 'weightNewcomer',
	verification: 'weightVerification'
} as const satisfies Record<TrendingSignal, string>;

export type TrendingWeights = Record<TrendingSignal, number>;
export type SignalValues = Record<TrendingSignal, number>;

/**
 * Labels and one-line explanations for the admin screen.
 *
 * A function, not a constant: the locale is per request, and a message read at
 * module scope would freeze whichever locale happened to load this file first.
 */
export const trendingSignalMeta = () =>
	[
		{ key: 'score', label: m.at_signal_score(), help: m.at_signal_score_help() },
		{ key: 'reach', label: m.at_signal_reach(), help: m.at_signal_reach_help() },
		{ key: 'engagement', label: m.at_signal_engagement(), help: m.at_signal_engagement_help() },
		{
			key: 'engagedAudience',
			label: m.at_signal_engaged_audience(),
			help: m.at_signal_engaged_audience_help()
		},
		{ key: 'growth', label: m.at_signal_growth(), help: m.at_signal_growth_help() },
		{ key: 'confirmed', label: m.at_signal_confirmed(), help: m.at_signal_confirmed_help() },
		{ key: 'bookings', label: m.at_signal_bookings(), help: m.at_signal_bookings_help() },
		{
			key: 'applications',
			label: m.at_signal_applications(),
			help: m.at_signal_applications_help()
		},
		{ key: 'reviews', label: m.at_signal_reviews(), help: m.at_signal_reviews_help() },
		{ key: 'rating', label: m.at_signal_rating(), help: m.at_signal_rating_help() },
		{ key: 'saves', label: m.at_signal_saves(), help: m.at_signal_saves_help() },
		{ key: 'momentum', label: m.at_signal_momentum(), help: m.at_signal_momentum_help() },
		{
			key: 'responsiveness',
			label: m.at_signal_responsiveness(),
			help: m.at_signal_responsiveness_help()
		},
		{
			key: 'reliability',
			label: m.at_signal_reliability(),
			help: m.at_signal_reliability_help()
		},
		{ key: 'newcomer', label: m.at_signal_newcomer(), help: m.at_signal_newcomer_help() },
		{
			key: 'verification',
			label: m.at_signal_verification(),
			help: m.at_signal_verification_help()
		}
	] as const satisfies ReadonlyArray<{ key: TrendingSignal; label: string; help: string }>;

/**
 * The groups the signal sliders are shown in, so sixteen of them read as four
 * questions — how big, how trusted, how in demand, how dependable — rather than
 * as one undifferentiated column.
 */
export const TRENDING_SIGNAL_GROUPS = [
	{ key: 'audience', signals: ['reach', 'engagement', 'engagedAudience', 'growth', 'confirmed'] },
	{ key: 'demand', signals: ['bookings', 'applications', 'saves', 'momentum'] },
	{ key: 'quality', signals: ['score', 'reviews', 'rating', 'responsiveness', 'reliability'] },
	{ key: 'profile', signals: ['newcomer', 'verification'] }
] as const satisfies ReadonlyArray<{ key: string; signals: readonly TrendingSignal[] }>;

/** A full weight set with every signal named, so a preset can never leave one stale. */
const weights = (set: Partial<TrendingWeights>): TrendingWeights =>
	Object.fromEntries(TRENDING_SIGNALS.map((key) => [key, set[key] ?? 0])) as TrendingWeights;

/** Preset weightings an operator can drop in instead of moving sixteen sliders. */
export const trendingPresets = () =>
	[
		{
			key: 'balanced',
			label: m.at_preset_balanced(),
			description: m.at_preset_balanced_help(),
			weights: weights({
				score: 20,
				reach: 10,
				engagement: 15,
				bookings: 15,
				applications: 5,
				reviews: 5,
				rating: 10,
				saves: 5,
				newcomer: 5,
				verification: 10
			})
		},
		{
			key: 'momentum',
			label: m.at_preset_momentum(),
			description: m.at_preset_momentum_help(),
			weights: weights({
				score: 5,
				engagement: 10,
				bookings: 20,
				applications: 10,
				reviews: 10,
				rating: 5,
				saves: 15,
				momentum: 20,
				newcomer: 5
			})
		},
		{
			key: 'audience',
			label: m.at_preset_audience(),
			description: m.at_preset_audience_help(),
			weights: weights({
				score: 5,
				reach: 25,
				engagement: 20,
				engagedAudience: 25,
				confirmed: 10,
				rating: 5,
				saves: 5,
				verification: 5
			})
		},
		{
			key: 'rising',
			label: m.at_preset_rising(),
			description: m.at_preset_rising_help(),
			weights: weights({
				engagement: 15,
				engagedAudience: 10,
				growth: 30,
				confirmed: 5,
				saves: 10,
				momentum: 20,
				newcomer: 10
			})
		},
		{
			key: 'quality',
			label: m.at_preset_quality(),
			description: m.at_preset_quality_help(),
			weights: weights({
				score: 15,
				engagement: 5,
				confirmed: 10,
				bookings: 10,
				reviews: 10,
				rating: 20,
				responsiveness: 10,
				reliability: 10,
				verification: 10
			})
		},
		{
			key: 'discovery',
			label: m.at_preset_discovery(),
			description: m.at_preset_discovery_help(),
			weights: weights({
				score: 10,
				engagement: 20,
				bookings: 5,
				applications: 15,
				reviews: 5,
				rating: 5,
				saves: 10,
				newcomer: 30
			})
		}
	] as const;

/**
 * `log` compresses before it compares: min–max over log₁₀(1 + value). It keeps
 * real distances, as `minmax` does, without letting one account with ten
 * million followers push everyone else's reach to zero.
 */
export type TrendingNormalization = 'percentile' | 'minmax' | 'log';

/* ------------------------------------------------------------------ *
 * Location
 * ------------------------------------------------------------------ */

export type TrendingLocalRanking = 'off' | 'boost' | 'first' | 'only';
export type TrendingLocalMatch = 'country' | 'region' | 'city';

/**
 * What the reader's location actually does, once the board's mode has had its
 * say.
 *
 * `automatic` is the mode an operator picks to take their hands off the board,
 * and there the location counts for the most it can: a reader in a market we
 * publish a board for sees that market's board alone. The other modes keep the
 * operator's own choice.
 */
export function effectiveLocalRanking(
	mode: string,
	localRanking: TrendingLocalRanking
): TrendingLocalRanking {
	return mode === 'automatic' ? 'only' : localRanking;
}

/** Where a reader is, as much of it as could be worked out. */
export type ViewerLocation = {
	countryId: number | null;
	regionId: number | null;
	city: string | null;
};

/** Where a creator is, as the cards and the board already carry it. */
export type CreatorLocation = {
	countryId: number | null;
	regionId: number | null;
	city: string | null;
};

const sameCity = (a: string | null, b: string | null) =>
	!!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Whether this creator counts as the reader's own.
 *
 * The match level is a ceiling, not a demand. A reader whose city we never
 * learned would match nobody at `city`, and answering "no local creators" to
 * someone whose country we do know is worse than answering it a level wider —
 * so each level falls back to the next one out.
 */
export function matchesLocation(
	creator: CreatorLocation,
	viewer: ViewerLocation,
	level: TrendingLocalMatch
): boolean {
	if (level === 'city' && viewer.city) return sameCity(creator.city, viewer.city);
	if ((level === 'city' || level === 'region') && viewer.regionId !== null) {
		return creator.regionId === viewer.regionId;
	}
	return viewer.countryId !== null && creator.countryId === viewer.countryId;
}

/**
 * A bonus no genuine score can reach, so `first` really means first.
 *
 * The alternative — sorting on a boolean and then on the score — would mean a
 * second comparator for every list that wants this, and the two would drift.
 */
export const LOCAL_FIRST_BONUS = 1_000_000;

/**
 * What a local match adds to a creator's ordering score.
 *
 * Both callers rank on a 0–100 scale — the platform score on discovery, the
 * board position on the homepage strip — so the operator's `boost` is in the
 * same units on both, and "worth fifteen points" means one thing.
 *
 * `only` orders like `first`. The trending strip honours it by serving the
 * market's own board instead; a list that is not the board — discovery, or the
 * shared board for a reader whose market has none — must not go empty because
 * of it, so local creators simply lead.
 */
export function localBonus(isLocal: boolean, mode: TrendingLocalRanking, points: number): number {
	if (!isLocal || mode === 'off') return 0;
	return mode === 'first' || mode === 'only' ? LOCAL_FIRST_BONUS : Math.max(0, points);
}

/**
 * A board position as a 0–100 score, so a bonus can be added to it.
 *
 * Rank is used rather than the stored trending score because the two disagree
 * on purpose: a pinned creator holds slot one whatever they scored. Ordering
 * on the position keeps the operator's arrangement intact inside each group.
 */
export function positionScore(rank: number, size: number): number {
	if (size <= 1) return 100;
	return (100 * (size - rank)) / (size - 1);
}

/**
 * How much an event that happened `ageDays` ago still counts.
 *
 * A booking from this morning and one from three weeks ago are both "inside
 * the 30-day window", and counting them the same is what makes a trending list
 * read like an all-time list. With a 7-day half-life the older one counts an
 * eighth as much. A half-life of 0 turns this off.
 */
export function decayWeight(ageDays: number, halfLifeDays: number): number {
	if (halfLifeDays <= 0) return 1;
	return Math.pow(0.5, Math.max(0, ageDays) / halfLifeDays);
}

/** Verification level as a 0–1 signal. */
export function verificationValue(level: string): number {
	switch (level) {
		case 'cn_verified':
			return 1;
		case 'identity_verified':
			return 0.7;
		case 'social_verified':
			return 0.4;
		default:
			return 0;
	}
}

/** How new the profile is, on a 90-day slope. Fresh supply gets a look-in. */
export function newcomerValue(ageDays: number, horizonDays = 90): number {
	if (horizonDays <= 0) return 0;
	return Math.max(0, 1 - Math.max(0, ageDays) / horizonDays);
}

/**
 * Maps a signal's raw values onto 0–1 across the whole candidate pool.
 *
 * A constant signal — every candidate identical — maps to a flat 0.5 rather
 * than 0 or 1. It shifts every score by the same amount and so changes no
 * ordering, which is the honest answer when a signal cannot tell candidates
 * apart; mapping it to 0 would silently discard the weight an operator set.
 */
export function normalizeValues(values: number[], method: TrendingNormalization): number[] {
	const n = values.length;
	if (n === 0) return [];
	if (n === 1) return [values[0] > 0 ? 1 : 0];

	if (method === 'log') {
		/* Sign-aware, because growth can be negative: -50% and +50% should sit
		   either side of zero, not both collapse onto the log of a positive. */
		return normalizeValues(
			values.map((v) => Math.sign(v) * Math.log10(1 + Math.abs(v))),
			'minmax'
		);
	}

	const min = Math.min(...values);
	const max = Math.max(...values);
	if (min === max) return values.map(() => (max === 0 ? 0 : 0.5));

	if (method === 'minmax') {
		return values.map((v) => (v - min) / (max - min));
	}

	/* Percentile: mean rank, so ties share a position instead of being split by
	   whatever order the database returned them in. */
	const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
	const out = new Array<number>(n);
	let i = 0;
	while (i < n) {
		let j = i;
		while (j + 1 < n && sorted[j + 1].value === sorted[i].value) j++;
		/* Ranks are 0-based, so the mean of a tie group spanning i..j is (i+j)/2. */
		const meanRank = (i + j) / 2;
		for (let k = i; k <= j; k++) out[sorted[k].index] = meanRank / (n - 1);
		i = j + 1;
	}
	return out;
}

/* ------------------------------------------------------------------ *
 * Audience
 *
 * Followers and engagement, measured the way the operator asked for them. The
 * raw figures sit on `social_accounts`, one row per channel; everything here
 * is about which channels count and how they are added up.
 * ------------------------------------------------------------------ */

/**
 * The size bands brands buy by. Floors, not ranges: a creator is in the highest
 * tier whose floor their reach clears.
 */
export const FOLLOWER_TIERS = ['nano', 'micro', 'mid', 'macro', 'mega'] as const;
export type FollowerTier = (typeof FOLLOWER_TIERS)[number];

export const TIER_FLOORS: Record<FollowerTier, number> = {
	nano: 0,
	micro: 10_000,
	mid: 100_000,
	macro: 500_000,
	mega: 1_000_000
};

export function followerTier(followers: number): FollowerTier {
	let tier: FollowerTier = 'nano';
	for (const key of FOLLOWER_TIERS) if (followers >= TIER_FLOORS[key]) tier = key;
	return tier;
}

export const followerTierMeta = () =>
	[
		{ key: 'nano', label: m.at_tier_nano(), range: m.at_tier_nano_range() },
		{ key: 'micro', label: m.at_tier_micro(), range: m.at_tier_micro_range() },
		{ key: 'mid', label: m.at_tier_mid(), range: m.at_tier_mid_range() },
		{ key: 'macro', label: m.at_tier_macro(), range: m.at_tier_macro_range() },
		{ key: 'mega', label: m.at_tier_mega(), range: m.at_tier_mega_range() }
	] as const satisfies ReadonlyArray<{ key: FollowerTier; label: string; range: string }>;

export const tierLabel = (tier: string) =>
	followerTierMeta().find((meta) => meta.key === tier)?.label ?? tier;

/** Which channels make up "reach". */
export type ReachMode = 'total' | 'primary' | 'largest';
/** How several channels' engagement rates become one. */
export type EngagementMode = 'average' | 'weighted' | 'best';

export type ChannelFigures = {
	platformId: number;
	followers: number;
	/** Percent. 0 means none on file. */
	engagementRate: number;
	followersSource: string;
	engagementSource: string;
	followersUpdatedAt: Date | null;
};

export type AudienceOptions = {
	reachMode: ReachMode;
	engagementMode: EngagementMode;
	/** Only these platforms' channels count. Empty means every platform. */
	platformIds: readonly number[];
	/** Rates above this percent are read as this. 0 means no cap. */
	engagementCap: number;
	/** Percent taken off a figure nobody has confirmed. 0 leaves them alone. */
	unconfirmedDiscount: number;
	primaryPlatformId: number | null;
};

export type Audience = {
	/** Followers across the channels that count, as stated. */
	reach: number;
	/** The same, with unconfirmed figures discounted — what the reach signal ranks on. */
	scoredReach: number;
	/** Combined engagement as stated, before the cap or the discount. What the floors read. */
	engagement: number;
	/** Combined engagement after the cap and the discount — what the signal ranks on. */
	scoredEngagement: number;
	/** Followers × engagement, summed per channel: the people a post actually reaches. */
	engagedAudience: number;
	/** Share of counted followers whose figure is confirmed, 0–1. */
	confirmedShare: number;
	/** The biggest single channel among those that count. */
	largestChannel: number;
	/** The most recently set follower figure among the counted channels. */
	freshestUpdate: Date | null;
	/** How many channels counted. */
	channelCount: number;
};

const confirmedSource = (source: string) => source === 'platform' || source === 'proof';

/**
 * Followers and engagement for one creator, under the operator's rules.
 *
 * The channels the reach mode selects are the channels engagement is read
 * from too: a board that ranks on the primary platform's audience should rank
 * on that platform's engagement, not on an average dragged about by channels
 * it has just said do not count.
 */
export function measureAudience(channels: ChannelFigures[], options: AudienceOptions): Audience {
	const allowed = options.platformIds.length ? new Set(options.platformIds) : null;
	const counted = allowed ? channels.filter((c) => allowed.has(c.platformId)) : channels;

	const byFollowers = [...counted].sort((a, b) => b.followers - a.followers);
	let selected = counted;
	if (options.reachMode === 'largest') {
		selected = byFollowers.slice(0, 1);
	} else if (options.reachMode === 'primary') {
		const primary = counted.filter((c) => c.platformId === options.primaryPlatformId);
		/* A creator whose primary platform is filtered out, or who never set one,
		   is read on their biggest channel rather than as having no audience. */
		selected = primary.length ? primary : byFollowers.slice(0, 1);
	}

	const discount = Math.min(100, Math.max(0, options.unconfirmedDiscount)) / 100;
	const trust = (source: string) => (confirmedSource(source) ? 1 : 1 - discount);
	const cap = options.engagementCap > 0 ? options.engagementCap : Infinity;

	const reach = selected.reduce((sum, c) => sum + c.followers, 0);
	const scoredReach = selected.reduce((sum, c) => sum + c.followers * trust(c.followersSource), 0);
	const confirmedFollowers = selected
		.filter((c) => confirmedSource(c.followersSource))
		.reduce((sum, c) => sum + c.followers, 0);

	const rated = selected.filter((c) => c.engagementRate > 0);
	const combine = (rate: (c: ChannelFigures) => number) => {
		if (!rated.length) return 0;
		if (options.engagementMode === 'best') return Math.max(...rated.map(rate));
		if (options.engagementMode === 'weighted') {
			const followers = rated.reduce((sum, c) => sum + c.followers, 0);
			if (followers > 0)
				return rated.reduce((sum, c) => sum + rate(c) * c.followers, 0) / followers;
		}
		return rated.reduce((sum, c) => sum + rate(c), 0) / rated.length;
	};

	const scoredRate = (c: ChannelFigures) =>
		Math.min(c.engagementRate, cap) * trust(c.engagementSource);

	const freshest = selected.reduce<Date | null>(
		(latest, c) =>
			c.followersUpdatedAt && (!latest || c.followersUpdatedAt > latest)
				? c.followersUpdatedAt
				: latest,
		null
	);

	return {
		reach,
		scoredReach: round(scoredReach, 2),
		engagement: round(
			combine((c) => c.engagementRate),
			4
		),
		scoredEngagement: round(combine(scoredRate), 4),
		engagedAudience: round(
			rated.reduce(
				(sum, c) => sum + c.followers * trust(c.followersSource) * (scoredRate(c) / 100),
				0
			),
			2
		),
		confirmedShare: reach > 0 ? round(confirmedFollowers / reach, 4) : 0,
		largestChannel: byFollowers[0]?.followers ?? 0,
		freshestUpdate: freshest,
		channelCount: selected.length
	};
}

/**
 * Follower growth over the window, in percent.
 *
 * Nothing to compare against is 0 rather than a guess, and the result is held
 * inside -100…+1000: a channel that went from 10 followers to 9,000 is not
 * ninety thousand percent more interesting than one that doubled, and an
 * unbounded figure would flatten every other creator under min–max.
 */
export function growthPercent(now: number, baseline: number): number {
	if (!(baseline > 0)) return 0;
	return round(Math.min(1000, Math.max(-100, ((now - baseline) / baseline) * 100)), 2);
}

/**
 * Demand this window against the window before it.
 *
 * A ratio with one added to each side, so a creator going from nothing to five
 * bookings reads as strong momentum without dividing by zero, and one with no
 * activity in either window reads as flat (1) rather than as falling.
 */
export function momentumValue(current: number, previous: number): number {
	return round((Math.max(0, current) + 1) / (Math.max(0, previous) + 1), 4);
}

/**
 * A rating pulled towards the platform average until there are enough reviews
 * to stand on its own.
 *
 * With `priorReviews` at 5, one five-star review counts as one voice against
 * five average ones. A creator with no reviews scores 0 rather than the
 * average: no evidence is not the same as average evidence.
 */
export function smoothedRating(
	average: number,
	reviews: number,
	priorMean: number,
	priorReviews: number
): number {
	if (reviews <= 0) return 0;
	if (priorReviews <= 0) return average;
	return round((average * reviews + priorMean * priorReviews) / (reviews + priorReviews), 4);
}

export type ScoredCandidate = {
	creatorId: number;
	/** 0–100 after weighting, normalisation and any operator boost. */
	score: number;
	baseScore: number;
	multiplier: number;
	values: SignalValues;
	components: {
		key: TrendingSignal;
		raw: number;
		normalized: number;
		share: number;
		contribution: number;
	}[];
};

export type ScoreInput = {
	creatorId: number;
	values: SignalValues;
	/** Operator boost, applied after the weighted sum. 1 leaves it untouched. */
	multiplier?: number;
};

/**
 * Scores every candidate against every other candidate.
 *
 * Weights are relative, not percentages: they are divided by their own sum, so
 * raising one slider does not silently steal from the other nine, and a set
 * that adds up to 340 behaves exactly like the same ratios adding up to 100.
 */
export function scoreCandidates(
	inputs: ScoreInput[],
	options: { weights: TrendingWeights; normalization: TrendingNormalization }
): ScoredCandidate[] {
	if (!inputs.length) return [];

	const active = TRENDING_SIGNALS.filter((key) => (options.weights[key] ?? 0) > 0);
	const totalWeight = active.reduce((sum, key) => sum + options.weights[key], 0);

	const normalized = new Map<TrendingSignal, number[]>();
	for (const key of active) {
		normalized.set(
			key,
			normalizeValues(
				inputs.map((input) => input.values[key] ?? 0),
				options.normalization
			)
		);
	}

	return inputs.map((input, index) => {
		const components = active.map((key) => {
			const share = totalWeight > 0 ? options.weights[key] / totalWeight : 0;
			const value = normalized.get(key)?.[index] ?? 0;
			return {
				key,
				raw: input.values[key] ?? 0,
				normalized: round(value, 4),
				share: round(share, 4),
				contribution: round(value * share * 100, 2)
			};
		});

		const baseScore = round(
			components.reduce((sum, component) => sum + component.contribution, 0),
			2
		);
		const multiplier = input.multiplier ?? 1;

		return {
			creatorId: input.creatorId,
			baseScore,
			multiplier,
			/* Boosts can push a score past 100; the board is an ordering, not a
			   percentage, and clamping would silently flatten competing boosts. */
			score: round(baseScore * multiplier, 2),
			values: input.values,
			components
		};
	});
}

/**
 * Board order: score first, then the platform score, then the older profile.
 *
 * The last two are not decoration — without a total order, two creators with
 * identical numbers swap places on every recompute and the homepage flickers
 * for no reason anyone can explain.
 */
export function compareCandidates(a: ScoredCandidate, b: ScoredCandidate): number {
	if (b.score !== a.score) return b.score - a.score;
	if ((b.values.score ?? 0) !== (a.values.score ?? 0)) {
		return (b.values.score ?? 0) - (a.values.score ?? 0);
	}
	return a.creatorId - b.creatorId;
}

const round = (value: number, places: number) => {
	const factor = 10 ** places;
	return Math.round(value * factor) / factor;
};

/* ------------------------------------------------------------------ *
 * Lanes
 *
 * A lane is the board cut down to one category, market or channel. There is
 * deliberately no second ranking here: a lane keeps the order the board
 * already produced, so "trending in fashion" cannot disagree with "trending"
 * about which of two fashion creators is doing better.
 * ------------------------------------------------------------------ */

export const TRENDING_LANE_KINDS = [
	'category',
	'country',
	'region',
	'city',
	'platform',
	'language',
	'tier'
] as const;

export type TrendingLaneKind = (typeof TRENDING_LANE_KINDS)[number];

/** The `trending_config` column holding how many lanes of each kind to keep. */
export const LANE_LIMIT_COLUMN = {
	category: 'maxCategoryLanes',
	country: 'maxCountryLanes',
	region: 'maxRegionLanes',
	city: 'maxCityLanes',
	platform: 'maxPlatformLanes',
	language: 'maxLanguageLanes',
	tier: 'maxTierLanes'
} as const satisfies Record<TrendingLaneKind, string>;

export const trendingLaneKindMeta = () =>
	[
		{ key: 'category', label: m.at_lane_kind_category() },
		{ key: 'country', label: m.at_lane_kind_country() },
		{ key: 'region', label: m.at_lane_kind_region() },
		{ key: 'city', label: m.at_lane_kind_city() },
		{ key: 'platform', label: m.at_lane_kind_platform() },
		{ key: 'language', label: m.at_lane_kind_language() },
		{ key: 'tier', label: m.at_lane_kind_tier() }
	] as const satisfies ReadonlyArray<{ key: TrendingLaneKind; label: string }>;

/**
 * One group a creator belongs to.
 *
 * `refId` is the reference row for every kind that has one, and `refKey` is
 * the free-text fallback the one kind without a table — a city — needs. Both
 * are carried rather than only an id so that a lane can be matched against a
 * reader's location later without knowing which of the two it was cut on.
 */
export type LaneFacet = {
	kind: TrendingLaneKind;
	refId: number | null;
	refKey: string | null;
	label: string;
};

/** A ranked creator, with the groups they would put in a lane. */
export type LaneCandidate = {
	creatorId: number;
	score: number;
	source: 'pinned' | 'algorithm' | 'manual';
	facets: LaneFacet[];
};

export type LaneLimits = Record<TrendingLaneKind, number>;

export type LaneOptions = {
	/** How many creators a lane holds. */
	slots: number;
	/** Lanes thinner than this are dropped rather than published half-empty. */
	minSize: number;
	/** How far down the ranking to look. 0 means the whole pool. */
	poolSize: number;
	/** Lanes kept per kind, best first. 0 switches that kind off. */
	limits: LaneLimits;
};

export type BuiltLane = {
	kind: TrendingLaneKind;
	refId: number | null;
	refKey: string | null;
	label: string;
	topScore: number;
	entries: {
		creatorId: number;
		rank: number;
		score: number;
		source: LaneCandidate['source'];
	}[];
};

/** A lane's identity, stable across runs — what a chip is keyed on. */
export const laneKey = (lane: { kind: string; refId: number | null; refKey: string | null }) =>
	`${lane.kind}:${lane.refId ?? lane.refKey ?? ''}`;

/**
 * Cuts the ranked pool into lanes.
 *
 * `pool` arrives in board order, and every lane is filled by walking it once,
 * so a creator's position inside a lane is their position on the board with
 * everyone else removed. Which lanes survive is decided afterwards, by size
 * first: a thin lane is a worse strip than no strip, however good its leader.
 */
export function buildLanes(pool: LaneCandidate[], options: LaneOptions): BuiltLane[] {
	const slots = Math.max(1, options.slots);
	const minSize = Math.max(1, options.minSize);
	const considered = options.poolSize > 0 ? pool.slice(0, options.poolSize) : pool;

	const lanes = new Map<string, BuiltLane>();

	for (const candidate of considered) {
		for (const facet of candidate.facets) {
			if ((options.limits[facet.kind] ?? 0) <= 0) continue;

			const key = laneKey(facet);
			let lane = lanes.get(key);
			if (!lane) {
				lane = {
					kind: facet.kind,
					refId: facet.refId,
					refKey: facet.refKey,
					label: facet.label,
					topScore: candidate.score,
					entries: []
				};
				lanes.set(key, lane);
			}
			if (lane.entries.length >= slots) continue;
			lane.entries.push({
				creatorId: candidate.creatorId,
				rank: lane.entries.length + 1,
				score: candidate.score,
				source: candidate.source
			});
		}
	}

	const kept: BuiltLane[] = [];
	for (const kind of TRENDING_LANE_KINDS) {
		const limit = options.limits[kind] ?? 0;
		if (limit <= 0) continue;
		kept.push(
			...[...lanes.values()]
				.filter((lane) => lane.kind === kind && lane.entries.length >= minSize)
				.sort(
					(a, b) =>
						b.entries.length - a.entries.length ||
						b.topScore - a.topScore ||
						a.label.localeCompare(b.label)
				)
				.slice(0, limit)
		);
	}
	return kept;
}

/**
 * How much of the reader's own location a lane matches — 3 for their city,
 * down to 0 for a lane that is not about where they are.
 *
 * Sorting on this rather than on a boolean is what lets "your city" sit above
 * "your region" above "your country" without three passes, and it leaves every
 * other lane at 0, holding the order the run published.
 */
export function laneLocalRank(
	lane: { kind: string; refId: number | null; refKey: string | null },
	viewer: ViewerLocation | null
): number {
	if (!viewer) return 0;
	if (lane.kind === 'city' && viewer.city && lane.refKey) {
		return sameCity(lane.refKey, viewer.city) ? 3 : 0;
	}
	if (lane.kind === 'region' && viewer.regionId !== null) {
		return lane.refId === viewer.regionId ? 2 : 0;
	}
	if (lane.kind === 'country' && viewer.countryId !== null) {
		return lane.refId === viewer.countryId ? 1 : 0;
	}
	return 0;
}
