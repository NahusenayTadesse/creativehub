import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { calculateScore } from '$lib/domain/score';

/**
 * Recomputes the derived fields on a creator row from the evidence the platform
 * holds. Called after any write that could change them — never exposed as a
 * field a creator can set.
 */
export async function refreshCreatorScore(creatorId: number) {
	const rows = await db.select().from(t.creators).where(eq(t.creators.id, creatorId)).limit(1);
	const creator = rows.at(0);
	if (!creator) return;

	const [categories, languages, packages, portfolio, socials] = await Promise.all([
		db
			.select({ n: sql<number>`count(*)` })
			.from(t.creatorCategories)
			.where(eq(t.creatorCategories.creatorId, creatorId)),
		db
			.select({ n: sql<number>`count(*)` })
			.from(t.creatorLanguages)
			.where(eq(t.creatorLanguages.creatorId, creatorId)),
		db
			.select({ n: sql<number>`count(*)` })
			.from(t.packages)
			.where(and(eq(t.packages.creatorId, creatorId), isNull(t.packages.deletedAt))),
		db
			.select({ n: sql<number>`count(*)` })
			.from(t.portfolioItems)
			.where(and(eq(t.portfolioItems.creatorId, creatorId), isNull(t.portfolioItems.deletedAt))),
		db
			.select({ rate: t.socialAccounts.engagementRate })
			.from(t.socialAccounts)
			.where(eq(t.socialAccounts.creatorId, creatorId))
	]);

	const engagementRate = socials.length
		? socials.reduce((sum, row) => sum + row.rate, 0) / socials.length
		: 0;

	const score = calculateScore({
		fullName: creator.fullName,
		bio: creator.bio,
		avatar: creator.avatar,
		cover: creator.cover,
		categoryCount: Number(categories[0]?.n ?? 0),
		languageCount: Number(languages[0]?.n ?? 0),
		packageCount: Number(packages[0]?.n ?? 0),
		portfolioCount: Number(portfolio[0]?.n ?? 0),
		verificationLevel: creator.verificationLevel,
		engagementRate,
		averageRating: creator.averageRating,
		completedBookings: creator.completedBookings
	});

	await db.update(t.creators).set({ score }).where(eq(t.creators.id, creatorId));
}

/** Total reach is the sum of linked channels — the discovery filters sort on it. */
export async function refreshCreatorReach(creatorId: number) {
	const rows = await db
		.select({ total: sql<number>`coalesce(sum(${t.socialAccounts.followers}), 0)` })
		.from(t.socialAccounts)
		.where(and(eq(t.socialAccounts.creatorId, creatorId), isNull(t.socialAccounts.deletedAt)));

	await db
		.update(t.creators)
		.set({ totalReach: Number(rows[0]?.total ?? 0) })
		.where(eq(t.creators.id, creatorId));

	await refreshCreatorScore(creatorId);
}

/** Recomputes a creator's rating and review count from published reviews. */
export async function refreshCreatorRating(creatorId: number) {
	const rows = await db
		.select({
			n: sql<number>`count(*)`,
			avg: sql<number>`coalesce(avg(${t.reviews.rating}), 0)`
		})
		.from(t.reviews)
		.where(and(eq(t.reviews.creatorId, creatorId), eq(t.reviews.direction, 'brand_to_creator')));

	await db
		.update(t.creators)
		.set({
			reviewsCount: Number(rows[0]?.n ?? 0),
			averageRating: Number(Number(rows[0]?.avg ?? 0).toFixed(2))
		})
		.where(eq(t.creators.id, creatorId));

	await refreshCreatorScore(creatorId);
}
