import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import * as t from './schema';

/**
 * Set-based recomputation of the denormalised counters on `creators`.
 *
 * The columns here are caches of rows that live elsewhere — never values a
 * creator or an operator sets. Everything that can change the underlying rows
 * calls back into this module, so the number a profile prints and the reviews
 * it lists can never drift apart. The seed uses the same functions, which is
 * why seeded profiles add up too.
 *
 * `db` is passed in rather than imported so the seed script (plain node, no
 * SvelteKit `$env`) can share these definitions with the running app.
 */
export type Database = MySql2Database<typeof t>;

/**
 * The reviews that count towards a creator's public rating: brand feedback on
 * a completed booking, still live. Used both by the rollup below and by the
 * queries that list reviews, so the list and the average share one definition.
 */
export const ratingReviewFilter = () =>
	and(
		eq(t.reviews.direction, 'brand_to_creator'),
		eq(t.reviews.isActive, true),
		isNull(t.reviews.deletedAt)
	);

/** Bookings that count as delivered work. */
const completedBookingFilter = () =>
	and(eq(t.bookings.status, 'completed'), isNull(t.bookings.deletedAt));

/**
 * The social channels that count as a creator's linked audience.
 *
 * Five callers used to answer this differently: the score averaged engagement
 * over deleted channels, discovery showed their platform badges, and the
 * publish gate counted them — so a creator could delete every channel and still
 * clear the "at least one channel" requirement. One definition, used by all.
 */
export const liveSocialFilter = () =>
	and(eq(t.socialAccounts.isActive, true), isNull(t.socialAccounts.deletedAt));

/**
 * Rewrites `reviews_count` and `average_rating` from the reviews table — for
 * one creator, or for every creator when `creatorId` is omitted.
 */
export async function recalcCreatorRatings(db: Database, creatorId?: number) {
	await db.execute(sql`
		update ${t.creators}
		left join (
			select ${t.reviews.creatorId} as creator_id,
				count(*) as review_count,
				avg(${t.reviews.rating}) as rating_avg
			from ${t.reviews}
			where ${ratingReviewFilter()}
			group by ${t.reviews.creatorId}
		) agg on agg.creator_id = ${t.creators.id}
		set ${t.creators.reviewsCount} = coalesce(agg.review_count, 0),
			${t.creators.averageRating} = round(coalesce(agg.rating_avg, 0), 2)
		${creatorId ? sql`where ${t.creators.id} = ${creatorId}` : sql``}
	`);
}

/** Rewrites `completed_bookings` from the bookings table. */
export async function recalcCreatorCompletedBookings(db: Database, creatorId?: number) {
	await db.execute(sql`
		update ${t.creators}
		left join (
			select ${t.bookings.creatorId} as creator_id, count(*) as booking_count
			from ${t.bookings}
			where ${completedBookingFilter()}
			group by ${t.bookings.creatorId}
		) agg on agg.creator_id = ${t.creators.id}
		set ${t.creators.completedBookings} = coalesce(agg.booking_count, 0)
		${creatorId ? sql`where ${t.creators.id} = ${creatorId}` : sql``}
	`);
}

/** Both creator counters at once. */
export async function recalcCreatorAggregates(db: Database, creatorId?: number) {
	await recalcCreatorRatings(db, creatorId);
	await recalcCreatorCompletedBookings(db, creatorId);
}

/**
 * Applications that count towards a campaign's public tally: live, and not
 * pulled back by the creator.
 */
const countedApplicationFilter = () =>
	and(ne(t.applications.status, 'withdrawn'), isNull(t.applications.deletedAt));

/**
 * Rewrites `applications_count` from the applications table.
 *
 * Applying used to increment this column and withdrawing never decremented it,
 * so the number on every campaign card drifted permanently upward and could not
 * be reconciled against the rows it claimed to count. Recount, never increment.
 */
export async function recalcCampaignApplications(db: Database, campaignId?: number) {
	await db.execute(sql`
		update ${t.campaigns}
		left join (
			select ${t.applications.campaignId} as campaign_id, count(*) as application_count
			from ${t.applications}
			where ${countedApplicationFilter()}
			group by ${t.applications.campaignId}
		) agg on agg.campaign_id = ${t.campaigns.id}
		set ${t.campaigns.applicationsCount} = coalesce(agg.application_count, 0)
		${campaignId ? sql`where ${t.campaigns.id} = ${campaignId}` : sql``}
	`);
}
