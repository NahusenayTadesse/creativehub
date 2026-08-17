/**
 * Campaign ↔ creator fit, scored deterministically across five weighted
 * factors. It is arithmetic an operator can argue with, not a model — which is
 * what a marketplace needs when the number decides who gets paid.
 */

export type MatchInput = {
	campaign: {
		categoryId: number | null;
		platformIds: number[];
		countryId: number | null;
		targetRegions: string[];
		budgetMax: number;
		followerMin: number;
		followerMax: number;
		compensationType: 'paid' | 'barter' | 'event_pass';
		categoryName?: string | null;
	};
	creator: {
		categoryIds: number[];
		categories: string[];
		platformIds: number[];
		platformId: number | null;
		platformName?: string | null;
		countryId: number | null;
		countryName?: string | null;
		regionName?: string | null;
		city?: string | null;
		startingPrice: number;
		totalReach: number;
		engagementRate: number;
		averageRating: number;
		completedBookings: number;
		verificationLevel: string;
		overseasPercentage: number;
		topCountries: string[];
	};
	/** Categories that read as adjacent to the campaign's, by id. */
	adjacentCategoryIds?: number[];
};

export type MatchBreakdown = {
	niche: number;
	demographics: number;
	performance: number;
	platform: number;
	budget: number;
	total: number;
	tier: 'Exceptional Fit' | 'Strong Fit' | 'Moderate Fit' | 'Low Fit';
	tierClass: string;
	synergies: string[];
	predictedReach: string;
	recommendedAngle: string;
};

export function calculateMatch({
	campaign,
	creator,
	adjacentCategoryIds = []
}: MatchInput): MatchBreakdown {
	/* 1. Niche alignment — 25 */
	const directMatch = campaign.categoryId !== null && creator.categoryIds.includes(campaign.categoryId);
	const adjacentMatch = creator.categoryIds.some((id) => adjacentCategoryIds.includes(id));
	const niche = directMatch ? 25 : adjacentMatch ? 18 : 8;

	/* 2. Audience geography — 25 */
	let demographics = 0;
	const isGlobal = campaign.countryId === null || campaign.targetRegions.length > 0;

	if (isGlobal) {
		if (creator.countryName && campaign.targetRegions.includes(creator.countryName)) {
			demographics += 16;
		} else if (creator.overseasPercentage >= 20) {
			demographics += 14;
		} else {
			demographics += 10;
		}

		const overlaps = campaign.targetRegions.some((region) => creator.topCountries.includes(region));
		if (overlaps) demographics += 9;
		else if (creator.overseasPercentage >= 30) demographics += 7;
		else demographics += 4;
	} else if (creator.countryId === campaign.countryId) {
		demographics += 18;
		demographics += 7;
	} else {
		demographics += 6;
	}
	demographics = Math.min(25, demographics);

	/* 3. Performance — 25 */
	let performance = 0;
	const engagement = creator.engagementRate || 5;
	if (engagement >= 8) performance += 12;
	else if (engagement >= 6) performance += 10;
	else if (engagement >= 4) performance += 8;
	else performance += 5;

	const rating = creator.averageRating || 4.5;
	if (rating >= 4.8 && creator.completedBookings >= 10) performance += 10;
	else if (rating >= 4.6 && creator.completedBookings >= 5) performance += 8;
	else if (rating >= 4.5) performance += 6;
	else performance += 4;

	if (creator.verificationLevel === 'cn_verified') performance += 3;
	else if (creator.verificationLevel === 'identity_verified') performance += 2;
	else performance += 1;
	performance = Math.min(25, performance);

	/* 4. Platform fit — 15 */
	let platform = 0;
	if (creator.platformId !== null && campaign.platformIds.includes(creator.platformId)) {
		platform += 10;
	} else if (creator.platformIds.some((id) => campaign.platformIds.includes(id))) {
		platform += 7;
	} else {
		platform += 3;
	}
	platform += 5;
	platform = Math.min(15, platform);

	/* 5. Budget headroom — 10 */
	let budget: number;
	if (campaign.compensationType !== 'paid') {
		const withinBracket =
			creator.totalReach >= campaign.followerMin &&
			creator.totalReach <= Math.max(campaign.followerMax * 1.5, campaign.followerMin);
		budget = withinBracket ? 10 : 7;
	} else if (campaign.budgetMax > 0) {
		const price = creator.startingPrice || 1;
		if (price <= campaign.budgetMax * 0.5) budget = 10;
		else if (price <= campaign.budgetMax) budget = 8;
		else if (price <= campaign.budgetMax * 1.25) budget = 5;
		else budget = 2;
	} else {
		budget = 7;
	}

	const total = Math.min(
		100,
		Math.max(15, Math.round(niche + demographics + performance + platform + budget))
	);

	let tier: MatchBreakdown['tier'] = 'Moderate Fit';
	let tierClass = 'text-amber-800 bg-amber-100 border-amber-400';
	if (total >= 90) {
		tier = 'Exceptional Fit';
		tierClass = 'text-emerald-900 bg-emerald-100 border-emerald-400';
	} else if (total >= 80) {
		tier = 'Strong Fit';
		tierClass = 'text-indigo-900 bg-indigo-100 border-indigo-400';
	} else if (total < 65) {
		tier = 'Low Fit';
		tierClass = 'text-slate-700 bg-slate-100 border-slate-400';
	}

	const synergies: string[] = [];
	if (directMatch) {
		synergies.push(
			`Direct niche match in ${campaign.categoryName ?? 'this category'} with a verified portfolio.`
		);
	} else {
		synergies.push(
			`Adjacent authority in ${creator.categories.join(' & ') || 'their categories'} that reaches the same audience.`
		);
	}
	if (engagement >= 6) {
		synergies.push(
			`${engagement.toFixed(1)}% engagement on ${creator.platformName ?? 'their main channel'}, above the usual benchmark.`
		);
	}
	if (creator.overseasPercentage >= 20 && creator.topCountries.length) {
		synergies.push(
			`${creator.overseasPercentage}% of audience in ${creator.topCountries.slice(0, 3).join(', ')}.`
		);
	} else {
		synergies.push(
			`Concentrated local audience in ${creator.city ?? creator.regionName ?? 'their home market'}.`
		);
	}

	const minImpressions = Math.round(creator.totalReach * (engagement / 100) * 1.8);
	const maxImpressions = Math.round(creator.totalReach * 0.45);

	return {
		niche,
		demographics,
		performance,
		platform,
		budget,
		total,
		tier,
		tierClass,
		synergies: synergies.slice(0, 3),
		predictedReach: `${Math.round(minImpressions / 1000)}K – ${Math.round(maxImpressions / 1000)}K est. impressions`,
		recommendedAngle:
			campaign.compensationType === 'barter'
				? `Experiential barter package showcased natively on ${creator.platformName ?? 'their main channel'}.`
				: `One dedicated ${creator.platformName ?? 'channel'} breakdown plus a tracked call-to-action link.`
	};
}
