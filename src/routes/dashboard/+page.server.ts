import { desc } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import {
	getPlatformStats,
	getMonthlySpend,
	getOrganizationTotals,
	getCreatorTotals,
	listBookings,
	listApplications,
	countPendingVerifications,
	unfiltered
} from '$lib/server/queries';
import { ENCODER_HOME } from '$lib/server/guards';

/** The overview shows a handful of the newest rows, not a browsable list. */
const RECENT = 6;

/**
 * Every figure here is counted or summed in the database, and every list is
 * asked for six rows. This page used to load every booking on the platform,
 * every application and every campaign, and then derive six numbers from the
 * arrays — which made the cost of opening a dashboard grow with the size of
 * the marketplace.
 */
export const load: PageServerLoad = async ({ parent }) => {
	/* The strips below are a fixed handful, not a list the reader is paging
	   through, so they deliberately ignore the URL's list state. */
	const url = unfiltered();

	const { role, creator, organization } = await parent();

	/*
	 * A data encoder has neither a profile nor an organisation, so every view
	 * below would fall through to the onboarding one and invite them to create a
	 * creator profile they are not there to have. Their work starts at the first
	 * reference table instead.
	 */
	if (role === 'encoder') redirect(303, ENCODER_HOME);

	if (role === 'admin') {
		const [stats, spend, bookings, verifications, recentAudit] = await Promise.all([
			getPlatformStats(),
			getMonthlySpend(),
			listBookings(url, { role }, { perPage: RECENT }),
			countPendingVerifications(),
			db.select().from(t.auditLog).orderBy(desc(t.auditLog.createdAt)).limit(8)
		]);

		return {
			view: 'admin' as const,
			stats,
			spend,
			bookings: bookings.rows,
			pendingVerifications: verifications,
			recentAudit
		};
	}

	if (role === 'business' && organization) {
		const scope = { role, organizationId: organization.id };

		const [bookings, applications, spend, totals] = await Promise.all([
			listBookings(url, scope, { perPage: RECENT }),
			listApplications(url, scope, { perPage: RECENT }),
			getMonthlySpend(organization.id),
			getOrganizationTotals(organization.id)
		]);

		return {
			view: 'business' as const,
			bookings: bookings.rows,
			applications: applications.rows,
			spend,
			totals
		};
	}

	if (creator) {
		const scope = { role, creatorId: creator.id };

		const [bookings, applications, totals] = await Promise.all([
			listBookings(url, scope, { perPage: RECENT }),
			listApplications(url, scope, { perPage: RECENT }),
			getCreatorTotals(creator.id)
		]);

		return {
			view: 'creator' as const,
			bookings: bookings.rows,
			applications: applications.rows,
			totals
		};
	}

	/* A creator account with no profile yet. */
	return { view: 'onboarding' as const };
};
