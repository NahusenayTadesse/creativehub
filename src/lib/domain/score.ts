import * as m from '$lib/paraglide/messages';

/**
 * The 0–100 Influencer Ethiopia score. Derived from evidence only — no field on
 * the profile lets a creator set it, and the weights below are the ones the
 * public explainer modal shows.
 */

export const scoreWeights = () =>
	[
		{ label: m.score_profile_completeness(), weight: 30 },
		{ label: m.score_verification_level(), weight: 25 },
		{ label: m.score_engagement_rate(), weight: 15 },
		{ label: m.score_response_rate(), weight: 15 },
		{ label: m.score_completed_bookings(), weight: 15 }
	] as const;

export type ScoreInput = {
	fullName?: string | null;
	bio?: string | null;
	avatar?: string | null;
	cover?: string | null;
	categoryCount: number;
	languageCount: number;
	packageCount: number;
	portfolioCount: number;
	verificationLevel: string;
	/** Percent. 0 means none on file. */
	engagementRate: number;
	/** Whether that rate came from the platform or an approved proof — see `stat-source`. */
	engagementConfirmed: boolean;
	/** 0–100 from `track-record`, or null when there is not enough to judge by. */
	responseRate: number | null;
	/** 0–100 from `track-record`, or null when there is not enough to judge by. */
	onTimeRate: number | null;
	averageRating: number;
	reviewsCount: number;
	completedBookings: number;
};

const clamp = (value: number, low: number, high: number) =>
	Math.min(high, Math.max(low, Number.isFinite(value) ? value : low));

/**
 * The score, from evidence only.
 *
 * A signal with nothing behind it scores nothing. That is the rule the three
 * lower buckets used to break: a creator with no engagement figure was scored
 * as if they had 5%, one with no reviews as if they averaged 4.5 stars, and
 * every creator was given 13 of 15 for a response rate nobody measured. Those
 * defaults made an empty profile look like an average one, and ranked a creator
 * who had proved nothing alongside one who had.
 */
export function calculateScore(input: ScoreInput): number {
	let score = 0;

	/* Profile completeness — 30 */
	if (input.fullName) score += 4;
	if (input.bio && input.bio.length > 20) score += 5;
	if (input.avatar) score += 4;
	if (input.cover) score += 3;
	if (input.categoryCount > 0) score += 4;
	if (input.languageCount > 0) score += 2;
	if (input.packageCount > 0) score += 4;
	if (input.portfolioCount > 0) score += 4;

	/* Verification — 25 */
	score +=
		input.verificationLevel === 'cn_verified'
			? 25
			: input.verificationLevel === 'identity_verified'
				? 20
				: input.verificationLevel === 'social_verified'
					? 15
					: 5;

	/* Engagement — 15. 10% earns it all; an unconfirmed figure counts at half. */
	if (input.engagementRate > 0) {
		score +=
			Math.min(15, (clamp(input.engagementRate, 0, 100) / 10) * 15) *
			(input.engagementConfirmed ? 1 : 0.5);
	}

	/* Response rate — 15. Measured by `track-record`; nothing measured, nothing earned. */
	if (input.responseRate !== null) score += (clamp(input.responseRate, 0, 100) / 100) * 15;

	/* Track record — 15: volume, rating, and deadlines kept, five each. */
	score += Math.min(5, Math.max(0, input.completedBookings) * 0.5);
	if (input.reviewsCount > 0) {
		/* One glowing review is not a reputation: full weight from the third. */
		score += (clamp(input.averageRating, 0, 5) / 5) * 5 * Math.min(1, input.reviewsCount / 3);
	}
	if (input.onTimeRate !== null) score += (clamp(input.onTimeRate, 0, 100) / 100) * 5;

	return Math.min(100, Math.max(10, Math.round(score)));
}
