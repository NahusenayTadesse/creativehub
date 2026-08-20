import { and, eq, isNull, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { reviewsQuery } from '$lib/server/queries';

export const load: PageServerLoad = async ({ url, parent }) => {
	const { creator, organization, role } = await parent();

	/*
	 * Whose reviews this page shows. An operator sees every review; anyone else
	 * sees only their own side's. A user who is neither yet — mid-onboarding,
	 * with no creator profile and no organisation — used to fall through to an
	 * undefined predicate, which `and()` dropped, showing them every review on
	 * the platform. They now see none.
	 */
	const mine = creator
		? eq(t.reviews.creatorId, creator.id)
		: organization
			? eq(t.reviews.organizationId, organization.id)
			: role === 'admin'
				? undefined
				: sql`1 = 0`;

	/* Soft-deleted reviews are excluded from a creator's public rating, so they
	   are excluded from the average this page shows too. */
	const visible = and(mine, eq(t.reviews.isActive, true), isNull(t.reviews.deletedAt));

	/*
	 * The summary is aggregated over every review, not over the page. Averaging
	 * the twenty-four rows on screen would make the headline rating change as
	 * the reader turned the page.
	 */
	const received = role === 'creator' ? 'brand_to_creator' : 'creator_to_brand';

	const [reviews, summary] = await Promise.all([
		reviewsQuery.run(url, { where: [visible] }),
		db
			.select({
				received: sql<number>`sum(case when ${t.reviews.direction} = ${received} then 1 else 0 end)`,
				given: sql<number>`sum(case when ${t.reviews.direction} <> ${received} then 1 else 0 end)`,
				average: sql<number>`coalesce(avg(case when ${t.reviews.direction} = ${received} then ${t.reviews.rating} end), 0)`
			})
			.from(t.reviews)
			.where(visible)
	]);

	return {
		reviews,
		role,
		summary: {
			received: Number(summary[0]?.received ?? 0),
			given: Number(summary[0]?.given ?? 0),
			average: Number(summary[0]?.average ?? 0)
		}
	};
};
