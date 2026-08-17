/**
 * The 0–100 Creator Network score. Derived from evidence only — no field on
 * the profile lets a creator set it, and the weights below are the ones the
 * public explainer modal shows.
 */

export const SCORE_WEIGHTS = [
	{ label: 'Profile completeness', weight: 30 },
	{ label: 'Verification level', weight: 25 },
	{ label: 'Engagement rate', weight: 15 },
	{ label: 'Response rate', weight: 15 },
	{ label: 'Completed bookings & ratings', weight: 15 }
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
	engagementRate: number;
	averageRating: number;
	completedBookings: number;
};

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

	/* Engagement — 15 */
	score += Math.min(15, Math.round(((input.engagementRate || 5) / 10) * 15));

	/* Response rate — 15. A placeholder until reply times are instrumented. */
	score += 13;

	/* Track record — 15 */
	const volume = Math.min(7.5, input.completedBookings * 0.5);
	const quality = ((input.averageRating || 4.5) / 5) * 7.5;
	score += Math.round(volume + quality);

	return Math.min(100, Math.max(10, score));
}
