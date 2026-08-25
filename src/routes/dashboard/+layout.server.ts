import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireUser, getCreatorFor, getOrganizationFor, isAdmin } from '$lib/server/guards';
import { countPendingVerifications } from '$lib/server/queries';

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
		const [bookings, verifications, introductions] = await Promise.all([
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
				)
		]);
		counts.bookings = Number(bookings[0]?.n ?? 0);
		counts.verifications = verifications;
		counts.introductions = Number(introductions[0]?.n ?? 0);
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

	return {
		role,
		isAdmin: isAdmin(user),
		creator: creator ?? null,
		organization: organization ?? null,
		counts
	};
};
