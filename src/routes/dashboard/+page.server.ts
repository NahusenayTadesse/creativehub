import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import {
	getPlatformStats,
	getMonthlySpend,
	listBookings,
	listApplications,
	listCampaigns,
	countPendingVerifications
} from '$lib/server/queries';

export const load: PageServerLoad = async ({ parent }) => {
	const { role, creator, organization } = await parent();

	if (role === 'admin') {
		const [stats, spend, bookings, verifications, recentAudit] = await Promise.all([
			getPlatformStats(),
			getMonthlySpend(),
			listBookings(),
			countPendingVerifications(),
			db.select().from(t.auditLog).orderBy(desc(t.auditLog.createdAt)).limit(8)
		]);

		return {
			view: 'admin' as const,
			stats,
			spend,
			bookings: bookings.slice(0, 6),
			pendingVerifications: verifications,
			recentAudit
		};
	}

	if (role === 'business' && organization) {
		const [bookings, applications, campaigns, spend] = await Promise.all([
			listBookings({ organizationId: organization.id }),
			listApplications({ organizationId: organization.id }),
			listCampaigns({ organizationId: organization.id }),
			getMonthlySpend(organization.id)
		]);

		const settled = bookings.filter((b) => b.escrowStatus === 'released');
		const held = bookings.filter((b) => b.escrowStatus === 'held');

		return {
			view: 'business' as const,
			bookings: bookings.slice(0, 6),
			applications: applications.slice(0, 6),
			campaigns,
			spend,
			totals: {
				committed: bookings.reduce((sum, b) => sum + b.price, 0),
				settled: settled.reduce((sum, b) => sum + b.price, 0),
				held: held.reduce((sum, b) => sum + b.price, 0),
				activeCampaigns: campaigns.filter((c) => c.status === 'published').length,
				pendingApplications: applications.filter((a) => a.status === 'applied').length,
				activeBookings: bookings.filter((b) => !['completed', 'cancelled'].includes(b.status))
					.length
			}
		};
	}

	if (creator) {
		const [bookings, applications, reviewRows] = await Promise.all([
			listBookings({ creatorId: creator.id }),
			listApplications({ creatorId: creator.id }),
			db
				.select({ n: sql<number>`count(*)` })
				.from(t.reviews)
				.where(
					and(eq(t.reviews.creatorId, creator.id), eq(t.reviews.direction, 'brand_to_creator'))
				)
		]);

		const completed = bookings.filter((b) => b.status === 'completed');
		const awaitingPayout = bookings.filter((b) =>
			['approved', 'awaiting_settlement'].includes(b.status)
		);

		return {
			view: 'creator' as const,
			bookings: bookings.slice(0, 6),
			applications: applications.slice(0, 6),
			totals: {
				earned: completed.reduce((sum, b) => sum + b.creatorPayout, 0),
				pending: awaitingPayout.reduce((sum, b) => sum + b.creatorPayout, 0),
				activeBookings: bookings.filter((b) => !['completed', 'cancelled'].includes(b.status))
					.length,
				openApplications: applications.filter((a) => ['applied', 'shortlisted'].includes(a.status))
					.length,
				reviews: Number(reviewRows[0]?.n ?? 0)
			}
		};
	}

	/* A creator account with no profile yet. */
	return { view: 'onboarding' as const };
};
