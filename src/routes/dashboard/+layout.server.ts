import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireUser, getCreatorFor, getOrganizationFor, isAdmin } from '$lib/server/guards';
import { countUnreadNotifications, listNotifications } from '$lib/server/inbox';
import {
	countPendingClaims,
	countPendingStatProofs,
	countUnconfirmedChannels,
	countPendingVerifications,
	countPostsAwaitingReview
} from '$lib/server/queries';

/**
 * Establishes which "side" the signed-in user is acting as, once, for every
 * dashboard page. Child routes take the creator or organisation from here
 * rather than re-deriving it — and never from a query parameter.
 */
export const load: LayoutServerLoad = async (event) => {
	const user = requireUser(event);
	const role = (user as { role?: string }).role ?? 'creator';

	const [creator, organization] = await Promise.all([
		role === 'creator' ? getCreatorFor(user.id) : Promise.resolve(undefined),
		role === 'business' ? getOrganizationFor(user.id) : Promise.resolve(undefined)
	]);

	const counts: Record<string, number> = {};

	if (role === 'admin') {
		const [bookings, verifications, introductions, claims, statProofs, blogApprovals] =
			await Promise.all([
				db
					.select({ n: sql<number>`count(*)` })
					.from(t.bookings)
					.where(
						and(isNull(t.bookings.deletedAt), inArray(t.bookings.status, ['submitted', 'revision']))
					),
				countPendingVerifications(),
				/* Deals nobody can answer yet — see /dashboard/admin/introductions. */
				db
					.select({ n: sql<number>`count(*)` })
					.from(t.bookings)
					.where(
						and(
							isNull(t.bookings.deletedAt),
							inArray(t.bookings.introductionStatus, ['pending', 'contacted'])
						)
					),
				/* People asking for a profile we imported — see /dashboard/admin/claims. */
				countPendingClaims(),
				/* Screenshots waiting to confirm a channel's figures. */
				countPendingStatProofs(),
				/* Articles a creator or a brand has finished with — see
			   /dashboard/admin/blog/approvals. */
				countPostsAwaitingReview()
			]);
		counts.bookings = Number(bookings[0]?.n ?? 0);
		counts.verifications = verifications;
		counts.introductions = Number(introductions[0]?.n ?? 0);
		counts.claims = claims;
		counts.statProofs = statProofs;
		counts.channelOwnership = await countUnconfirmedChannels();
		counts.blogApprovals = blogApprovals;
	} else if (role === 'encoder') {
		/* The one queue an encoder works that has a backlog worth showing. */
		counts.channelOwnership = await countUnconfirmedChannels();
	} else if (creator) {
		const [bookings, applications] = await Promise.all([
			db
				.select({ n: sql<number>`count(*)` })
				.from(t.bookings)
				.where(
					and(
						eq(t.bookings.creatorId, creator.id),
						isNull(t.bookings.deletedAt),
						inArray(t.bookings.status, ['proposed', 'negotiating', 'in_production', 'revision'])
					)
				),
			db
				.select({ n: sql<number>`count(*)` })
				.from(t.applications)
				.where(
					and(
						eq(t.applications.creatorId, creator.id),
						inArray(t.applications.status, ['applied', 'shortlisted'])
					)
				)
		]);
		counts.bookings = Number(bookings[0]?.n ?? 0);
		counts.applications = Number(applications[0]?.n ?? 0);
	} else if (organization) {
		const [bookings, applications] = await Promise.all([
			db
				.select({ n: sql<number>`count(*)` })
				.from(t.bookings)
				.where(
					and(
						eq(t.bookings.organizationId, organization.id),
						isNull(t.bookings.deletedAt),
						inArray(t.bookings.status, ['proposed', 'negotiating', 'submitted'])
					)
				),
			db
				.select({ n: sql<number>`count(*)` })
				.from(t.applications)
				.innerJoin(t.campaigns, eq(t.campaigns.id, t.applications.campaignId))
				.where(
					and(eq(t.campaigns.organizationId, organization.id), eq(t.applications.status, 'applied'))
				)
		]);
		counts.bookings = Number(bookings[0]?.n ?? 0);
		counts.applications = Number(applications[0]?.n ?? 0);
	}

	/* The bell in the header: how many are waiting, and the last few to show
	   without leaving the page. Two indexed reads on every dashboard page. */
	const [unreadNotifications, recentNotifications] = await Promise.all([
		countUnreadNotifications(user.id),
		listNotifications(user.id, { limit: 6 })
	]);

	return {
		role,
		isAdmin: isAdmin(user),
		creator: creator ?? null,
		organization: organization ?? null,
		counts,
		unreadNotifications,
		recentNotifications
	};
};
