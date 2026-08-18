import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ parent }) => {
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
	const where = and(mine, eq(t.reviews.isActive, true), isNull(t.reviews.deletedAt));

	const reviews = await db
		.select({
			id: t.reviews.id,
			rating: t.reviews.rating,
			communication: t.reviews.communication,
			professionalism: t.reviews.professionalism,
			timeliness: t.reviews.timeliness,
			quality: t.reviews.quality,
			body: t.reviews.body,
			direction: t.reviews.direction,
			createdAt: t.reviews.createdAt,
			bookingId: t.reviews.bookingId,
			bookingTitle: t.bookings.title,
			creatorName: t.creators.fullName,
			organizationName: t.organizations.name
		})
		.from(t.reviews)
		.innerJoin(t.bookings, eq(t.bookings.id, t.reviews.bookingId))
		.innerJoin(t.creators, eq(t.creators.id, t.reviews.creatorId))
		.innerJoin(t.organizations, eq(t.organizations.id, t.reviews.organizationId))
		.where(where)
		.orderBy(desc(t.reviews.createdAt));

	return { reviews, role };
};
