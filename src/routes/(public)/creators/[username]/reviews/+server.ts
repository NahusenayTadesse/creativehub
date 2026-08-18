import { error, json } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { getCreatorReviews, REVIEW_PAGE_SIZE } from '$lib/server/queries';

/**
 * A page of reviews for the profile's "load more" button. The profile itself
 * ships the first page; every page after it is fetched from here, so a
 * creator with a long record does not weigh down the initial load.
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
	const rows = await db
		.select({
			id: t.creators.id,
			userId: t.creators.userId,
			isPublished: t.creators.isPublished,
			reviewsCount: t.creators.reviewsCount
		})
		.from(t.creators)
		.where(and(eq(t.creators.username, params.username), isNull(t.creators.deletedAt)))
		.limit(1);

	const creator = rows.at(0);
	if (!creator) error(404, 'Creator not found');

	/* The same visibility rule the profile page applies. */
	const isOwner = Boolean(locals.user?.id) && creator.userId === locals.user?.id;
	const isAdmin = (locals.user as { role?: string } | undefined)?.role === 'admin';
	if (!creator.isPublished && !isOwner && !isAdmin) error(404, 'Creator not found');

	const offset = Number(url.searchParams.get('offset') ?? 0);
	if (!Number.isInteger(offset) || offset < 0) error(400, 'Invalid offset');

	const reviews = await getCreatorReviews(creator.id, offset, REVIEW_PAGE_SIZE);

	return json({
		reviews,
		offset,
		total: creator.reviewsCount,
		hasMore: offset + reviews.length < creator.reviewsCount
	});
};
