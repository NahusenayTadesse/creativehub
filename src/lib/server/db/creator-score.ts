import { and, asc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import * as t from './schema';
import { liveSocialFilter, type Database } from './rollups';
import { calculateScore } from '../../domain/score';
import { isConfirmedSource } from '../../domain/stat-source';
import {
	ANSWER_WINDOW_MS,
	RESPONSE_LOOKBACK_MS,
	asksIn,
	measureDelivery,
	measureResponsiveness,
	type Ask,
	type ThreadEvent
} from '../../domain/track-record';

/**
 * The derived fields on a creator row, recomputed from the rows they summarise.
 *
 * Takes `db` rather than importing it, like `rollups.ts`, so the scheduled
 * refresh inside the app and `scripts/refresh-stats.ts` outside it run the same
 * code. `$lib/server/score-service` is the app's thin wrapper around it.
 */

type WriteOptions = {
	/**
	 * Leave `updated_at` as it was.
	 *
	 * The sitemap reads `creators.updated_at` as the profile's last-modified
	 * date. A creator editing their profile should move it; the nightly pass
	 * re-deriving a score from rows nobody touched should not, or every profile
	 * would claim to have changed every day.
	 */
	background?: boolean;
};

const keepUpdatedAt = { updatedAt: sql`${t.creators.updatedAt}` };

/**
 * Records today's figures for a creator's live channels.
 *
 * At most one row per channel per day: a second write on the same day
 * overwrites the first, so the day's snapshot is how the channel ended it.
 * The day is the UTC date, which is the same for every caller and so cannot
 * produce two rows for one day from two servers' idea of midnight.
 */
export async function snapshotCreatorChannels(db: Database, creatorId: number, now = new Date()) {
	const channels = await db
		.select({
			id: t.socialAccounts.id,
			followers: t.socialAccounts.followers,
			engagementRate: t.socialAccounts.engagementRate,
			followersSource: t.socialAccounts.followersSource
		})
		.from(t.socialAccounts)
		.where(and(eq(t.socialAccounts.creatorId, creatorId), liveSocialFilter()));
	if (!channels.length) return;

	const recordedOn = now.toISOString().slice(0, 10);
	await db
		.insert(t.socialAccountSnapshots)
		.values(
			channels.map((channel) => ({
				socialAccountId: channel.id,
				creatorId,
				followers: channel.followers,
				engagementRate: channel.engagementRate,
				followersSource: channel.followersSource,
				recordedOn
			}))
		)
		.onDuplicateKeyUpdate({
			set: {
				followers: sql`values(${t.socialAccountSnapshots.followers})`,
				engagementRate: sql`values(${t.socialAccountSnapshots.engagementRate})`,
				followersSource: sql`values(${t.socialAccountSnapshots.followersSource})`
			}
		});
}

/**
 * Total reach is the sum of linked channels — the discovery filters sort on it.
 *
 * Every write that can move a follower count ends here — the channels form, a
 * platform refresh, an approved proof — which is why the day's snapshot is
 * taken here too rather than at each of them.
 */
export async function recalcCreatorReach(
	db: Database,
	creatorId: number,
	options: WriteOptions = {}
) {
	await snapshotCreatorChannels(db, creatorId);

	const rows = await db
		.select({ total: sql<number>`coalesce(sum(${t.socialAccounts.followers}), 0)` })
		.from(t.socialAccounts)
		.where(and(eq(t.socialAccounts.creatorId, creatorId), liveSocialFilter()));

	await db
		.update(t.creators)
		.set({
			totalReach: Number(rows[0]?.total ?? 0),
			...(options.background ? keepUpdatedAt : {})
		})
		.where(eq(t.creators.id, creatorId));
}

/**
 * The engagement figure the score reads, and whether anyone has confirmed it.
 *
 * Confirmed rates are preferred outright: a creator whose YouTube rate came
 * from the API and whose Instagram rate they typed in is scored on the YouTube
 * one, at full weight, rather than on an average that dilutes a checked number
 * with an unchecked one. A rate of 0 is "none on file" and is not averaged in.
 */
export function engagementForScore(channels: { rate: number; source: string }[]) {
	const withRate = channels.filter((channel) => channel.rate > 0);
	const confirmed = withRate.filter((channel) => isConfirmedSource(channel.source));
	const counted = confirmed.length ? confirmed : withRate;

	return {
		engagementRate: counted.length
			? counted.reduce((sum, channel) => sum + channel.rate, 0) / counted.length
			: 0,
		engagementConfirmed: confirmed.length > 0
	};
}

/** Recomputes `creators.score` from the evidence the platform holds. */
export async function recalcCreatorScore(
	db: Database,
	creatorId: number,
	options: WriteOptions = {}
) {
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
			.select({ rate: t.socialAccounts.engagementRate, source: t.socialAccounts.engagementSource })
			.from(t.socialAccounts)
			.where(and(eq(t.socialAccounts.creatorId, creatorId), liveSocialFilter()))
	]);

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
		...engagementForScore(socials),
		responseRate: creator.responseRate,
		onTimeRate: creator.onTimeRate,
		averageRating: creator.averageRating,
		reviewsCount: creator.reviewsCount,
		completedBookings: creator.completedBookings
	});

	/* Nothing to write, and in the background nothing to announce either. An
	   interactive caller still writes, so `updated_at` follows the edit. */
	if (options.background && score === creator.score) return;

	await db
		.update(t.creators)
		.set({ score, ...(options.background ? keepUpdatedAt : {}) })
		.where(eq(t.creators.id, creatorId));
}

/**
 * Measures how a creator answers and delivers, and stores the figures.
 *
 * What counts as the brand asking: a booking request the creator could see, a
 * counter-offer from the organisation, a message from anyone else on one of the
 * creator's threads. What counts as the creator answering: their message, their
 * counter-offer, or anything they did to the booking that the audit log
 * recorded — accepting terms, submitting work, asking to cancel. See
 * `$lib/domain/track-record` for how those become a rate.
 *
 * An unclaimed profile has no account to answer from, so it is measured as
 * having no evidence rather than as ignoring everyone.
 */
export async function measureCreatorMetrics(db: Database, creatorId: number, now = new Date()) {
	const rows = await db
		.select({ userId: t.creators.userId })
		.from(t.creators)
		.where(eq(t.creators.id, creatorId))
		.limit(1);
	const creator = rows.at(0);
	if (!creator) return;

	const measured = creator.userId
		? await gatherAndMeasure(db, creatorId, creator.userId, now)
		: {
				responsiveness: { rate: null, sample: 0, medianMinutes: null },
				delivery: { rate: null, sample: 0 }
			};

	await db
		.update(t.creators)
		.set({
			responseRate: measured.responsiveness.rate,
			responseSample: measured.responsiveness.sample,
			medianResponseMinutes: measured.responsiveness.medianMinutes,
			onTimeRate: measured.delivery.rate,
			onTimeSample: measured.delivery.sample,
			metricsMeasuredAt: now,
			...keepUpdatedAt
		})
		.where(eq(t.creators.id, creatorId));
}

async function gatherAndMeasure(db: Database, creatorId: number, userId: string, now: Date) {
	/* An ask made just before the lookback can still be answered inside it. */
	const since = new Date(now.getTime() - RESPONSE_LOOKBACK_MS - ANSWER_WINDOW_MS);

	const [bookings, applications] = await Promise.all([
		db
			.select({
				id: t.bookings.id,
				createdAt: t.bookings.createdAt,
				deadline: t.bookings.deadline,
				status: t.bookings.status,
				introductionStatus: t.bookings.introductionStatus,
				termsFrozenAt: t.bookings.termsFrozenAt
			})
			.from(t.bookings)
			.where(and(eq(t.bookings.creatorId, creatorId), isNull(t.bookings.deletedAt))),
		db
			.select({ id: t.applications.id })
			.from(t.applications)
			.where(and(eq(t.applications.creatorId, creatorId), isNull(t.applications.deletedAt)))
	]);

	const bookingIds = bookings.map((booking) => booking.id);
	const applicationIds = applications.map((application) => application.id);

	const [messages, proposals, actions, submissions] = await Promise.all([
		bookingIds.length || applicationIds.length
			? db
					.select({
						bookingId: t.messages.bookingId,
						applicationId: t.messages.applicationId,
						senderId: t.messages.senderId,
						createdAt: t.messages.createdAt
					})
					.from(t.messages)
					.where(
						and(
							or(
								bookingIds.length ? inArray(t.messages.bookingId, bookingIds) : undefined,
								applicationIds.length
									? inArray(t.messages.applicationId, applicationIds)
									: undefined
							),
							isNull(t.messages.deletedAt),
							gte(t.messages.createdAt, since)
						)
					)
			: [],
		bookingIds.length
			? db
					.select({
						bookingId: t.termProposals.bookingId,
						proposedBy: t.termProposals.proposedBy,
						createdAt: t.termProposals.createdAt
					})
					.from(t.termProposals)
					.where(
						and(
							inArray(t.termProposals.bookingId, bookingIds),
							gte(t.termProposals.createdAt, since)
						)
					)
			: [],
		bookingIds.length
			? db
					.select({
						bookingId: t.auditLog.entityId,
						actorId: t.auditLog.actorId,
						toState: t.auditLog.toState,
						createdAt: t.auditLog.createdAt
					})
					.from(t.auditLog)
					.where(
						and(
							eq(t.auditLog.entity, 'booking'),
							inArray(t.auditLog.entityId, bookingIds),
							gte(t.auditLog.createdAt, since),
							/* Whatever the creator did, and anyone cancelling. */
							or(
								eq(t.auditLog.actorId, userId),
								and(eq(t.auditLog.action, 'status_change'), eq(t.auditLog.toState, 'cancelled'))
							)
						)
					)
			: [],
		bookingIds.length
			? db
					.select({
						bookingId: t.submissions.bookingId,
						/* Decoded as the column is, so the zone matches every other timestamp. */
						first: sql<Date>`min(${t.submissions.createdAt})`.mapWith(t.submissions.createdAt)
					})
					.from(t.submissions)
					.where(and(inArray(t.submissions.bookingId, bookingIds), isNull(t.submissions.deletedAt)))
					.groupBy(t.submissions.bookingId)
			: []
	]);

	/* Every conversation the creator is part of, as a timeline of who acted. */
	const threads = new Map<string, ThreadEvent[]>();
	const push = (key: string, event: ThreadEvent) => {
		const events = threads.get(key) ?? [];
		events.push(event);
		threads.set(key, events);
	};

	for (const booking of bookings) {
		/* A request the creator could not see — an introduction to an unclaimed
		   profile — is the operator's to chase, not the creator's to answer. */
		if (booking.introductionStatus === 'none' && booking.createdAt >= since) {
			push(`b${booking.id}`, { at: booking.createdAt, by: 'brand' });
		}
		/* Terms freeze only once both sides confirm, so the creator had answered
		   by then — even on a deal whose individual steps left no row behind. */
		if (booking.termsFrozenAt && booking.termsFrozenAt >= since) {
			push(`b${booking.id}`, { at: booking.termsFrozenAt, by: 'creator' });
		}
	}
	for (const message of messages) {
		const key = message.bookingId ? `b${message.bookingId}` : `a${message.applicationId}`;
		push(key, { at: message.createdAt, by: message.senderId === userId ? 'creator' : 'brand' });
	}
	for (const proposal of proposals) {
		push(`b${proposal.bookingId}`, {
			at: proposal.createdAt,
			by: proposal.proposedBy === 'creator' ? 'creator' : 'brand'
		});
	}
	for (const action of actions) {
		push(`b${action.bookingId}`, {
			at: action.createdAt,
			by: action.actorId === userId ? 'creator' : 'closed'
		});
	}

	const asks: Ask[] = [...threads.values()].flatMap(asksIn);

	const firstSubmission = new Map(submissions.map((row) => [row.bookingId, row.first] as const));

	return {
		responsiveness: measureResponsiveness(asks, now),
		delivery: measureDelivery(
			bookings.map((booking) => ({
				deadline: booking.deadline,
				firstSubmittedAt: firstSubmission.get(booking.id) ?? null,
				status: booking.status
			})),
			now
		)
	};
}

/**
 * Re-measures the creators whose figures are oldest, then rescores them.
 *
 * The rate changes with time as well as with writes — an ask nobody answers
 * becomes a missed one two days later with no row changing — so this runs on a
 * schedule rather than after a write. `staleHours` keeps it to once a day per
 * creator however often it is called, and a restart does not reset that.
 */
export async function remeasureStaleCreators(
	db: Database,
	options: { staleHours?: number; limit?: number; now?: Date; all?: boolean } = {}
) {
	const now = options.now ?? new Date();
	const staleBefore = new Date(now.getTime() - (options.staleHours ?? 24) * 60 * 60 * 1000);

	const rows = await db
		.select({ id: t.creators.id })
		.from(t.creators)
		.where(
			and(
				isNull(t.creators.deletedAt),
				options.all
					? undefined
					: or(isNull(t.creators.metricsMeasuredAt), lt(t.creators.metricsMeasuredAt, staleBefore))
			)
		)
		/* Never measured first, then oldest. */
		.orderBy(sql`${t.creators.metricsMeasuredAt} is not null`, asc(t.creators.metricsMeasuredAt))
		.limit(options.limit ?? 500);

	for (const row of rows) {
		await measureCreatorMetrics(db, row.id, now);
		await recalcCreatorScore(db, row.id, { background: true });
	}

	return rows.length;
}
