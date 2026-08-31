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
	'bookings',
	'applications',
	'reviews',
	'rating',
	'saves',
	'newcomer',
	'verification'
] as const;

export type TrendingSignal = (typeof TRENDING_SIGNALS)[number];

/** The `trending_config` column each signal's weight is stored in. */
export const WEIGHT_COLUMN = {
	score: 'weightScore',
	reach: 'weightReach',
	engagement: 'weightEngagement',
	bookings: 'weightBookings',
	applications: 'weightApplications',
	reviews: 'weightReviews',
	rating: 'weightRating',
	saves: 'weightSaves',
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
		{ key: 'bookings', label: m.at_signal_bookings(), help: m.at_signal_bookings_help() },
		{
			key: 'applications',
			label: m.at_signal_applications(),
			help: m.at_signal_applications_help()
		},
		{ key: 'reviews', label: m.at_signal_reviews(), help: m.at_signal_reviews_help() },
		{ key: 'rating', label: m.at_signal_rating(), help: m.at_signal_rating_help() },
		{ key: 'saves', label: m.at_signal_saves(), help: m.at_signal_saves_help() },
		{ key: 'newcomer', label: m.at_signal_newcomer(), help: m.at_signal_newcomer_help() },
		{
			key: 'verification',
			label: m.at_signal_verification(),
			help: m.at_signal_verification_help()
		}
	] as const satisfies ReadonlyArray<{ key: TrendingSignal; label: string; help: string }>;

/** Preset weightings an operator can drop in instead of moving ten sliders. */
export const trendingPresets = () =>
	[
		{
			key: 'balanced',
			label: m.at_preset_balanced(),
			description: m.at_preset_balanced_help(),
			weights: {
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
			}
		},
		{
			key: 'momentum',
			label: m.at_preset_momentum(),
			description: m.at_preset_momentum_help(),
			weights: {
				score: 5,
				reach: 0,
				engagement: 15,
				bookings: 25,
				applications: 15,
				reviews: 10,
				rating: 5,
				saves: 20,
				newcomer: 5,
				verification: 0
			}
		},
		{
			key: 'audience',
			label: m.at_preset_audience(),
			description: m.at_preset_audience_help(),
			weights: {
				score: 10,
				reach: 35,
				engagement: 30,
				bookings: 5,
				applications: 0,
				reviews: 0,
				rating: 5,
				saves: 5,
				newcomer: 0,
				verification: 10
			}
		},
		{
			key: 'quality',
			label: m.at_preset_quality(),
			description: m.at_preset_quality_help(),
			weights: {
				score: 25,
				reach: 0,
				engagement: 5,
				bookings: 15,
				applications: 0,
				reviews: 15,
				rating: 25,
				saves: 0,
				newcomer: 0,
				verification: 15
			}
		},
		{
			key: 'discovery',
			label: m.at_preset_discovery(),
			description: m.at_preset_discovery_help(),
			weights: {
				score: 10,
				reach: 0,
				engagement: 20,
				bookings: 5,
				applications: 15,
				reviews: 5,
				rating: 5,
				saves: 10,
				newcomer: 30,
				verification: 0
			}
		}
	] as const;

export type TrendingNormalization = 'percentile' | 'minmax';

/* ------------------------------------------------------------------ *
 * Location
 * ------------------------------------------------------------------ */

export type TrendingLocalRanking = 'off' | 'boost' | 'first';
export type TrendingLocalMatch = 'country' | 'region' | 'city';

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
 */
export function localBonus(isLocal: boolean, mode: TrendingLocalRanking, points: number): number {
	if (!isLocal || mode === 'off') return 0;
	return mode === 'first' ? LOCAL_FIRST_BONUS : Math.max(0, points);
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
