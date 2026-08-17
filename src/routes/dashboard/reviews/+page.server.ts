import { desc, eq, or } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ parent }) => {
	const { creator, organization, role } = await parent();

	const where = creator
		? eq(t.reviews.creatorId, creator.id)
		: organization
			? eq(t.reviews.organizationId, organization.id)
			: undefined;

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
