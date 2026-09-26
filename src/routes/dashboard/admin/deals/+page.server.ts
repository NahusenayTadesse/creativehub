import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireRole } from '$lib/server/guards';

/**
 * The operator's deal board: every open deal, in the state it is in.
 *
 * The columns are the deal lifecycle in order — the same states
 * `$lib/domain/booking` enforces — so a card's column is its truth, not a
 * label someone chose. Around the board: what needs a person now, and the
 * month's completed paid deals, the figure the Version 2 gate is counted in.
 */

/** The open states, left to right. */
const BOARD_STATES = [
	'proposed',
	'negotiating',
	'contracting',
	'booked',
	'concept',
	'in_production',
	'submitted',
	'revision',
	'approved',
	'awaiting_settlement',
	'disputed'
] as const;

/** How long a deal may sit in one state before the board flags it. */
const STALE_DAYS = 7;
/** Completed paid deals in a month that open Version 2's digital products. */
const V2_GATE = 20;

export const load: PageServerLoad = async (event) => {
	requireRole(event, 'admin');

	const monthStart = sql`date_format(now(), '%Y-%m-01')`;

	const [open, completedThisMonth, cancelledThisMonth] = await Promise.all([
		db
			.select({
				id: t.bookings.id,
				reference: t.bookings.reference,
				title: t.bookings.title,
				status: t.bookings.status,
				escrowStatus: t.bookings.escrowStatus,
				compensationType: t.bookings.compensationType,
				price: t.bookings.price,
				brandTotal: t.bookings.brandTotal,
				platformFee: t.bookings.platformFee,
				brandServiceFee: t.bookings.brandServiceFee,
				currencyCode: t.bookings.currencyCode,
				deadline: t.bookings.deadline,
				introductionStatus: t.bookings.introductionStatus,
				cancelRequestedAt: t.bookings.cancelRequestedAt,
				updatedAt: t.bookings.updatedAt,
				/* Days since anything happened on the deal, on the database's clock. */
				idleDays: sql<number>`datediff(now(), ${t.bookings.updatedAt})`,
				overdue: sql<number>`(${t.bookings.deadline} is not null and ${t.bookings.deadline} < curdate())`,
				creatorName: t.creators.fullName,
				organizationName: t.organizations.name
			})
			.from(t.bookings)
			.innerJoin(t.creators, eq(t.creators.id, t.bookings.creatorId))
			.innerJoin(t.organizations, eq(t.organizations.id, t.bookings.organizationId))
			.where(and(isNull(t.bookings.deletedAt), inArray(t.bookings.status, [...BOARD_STATES])))
			.orderBy(t.bookings.updatedAt),
		db
			.select({
				count: sql<number>`count(*)`,
				paid: sql<number>`sum(${t.bookings.compensationType} = 'paid' and ${t.bookings.price} > 0)`,
				revenue: sql<number>`coalesce(sum(${t.bookings.platformFee} + ${t.bookings.brandServiceFee}), 0)`,
				volume: sql<number>`coalesce(sum(${t.bookings.price}), 0)`
			})
			.from(t.bookings)
			.where(
				and(
					isNull(t.bookings.deletedAt),
					eq(t.bookings.status, 'completed'),
					gte(t.bookings.completedAt, monthStart)
				)
			),
		db
			.select({ count: sql<number>`count(*)` })
			.from(t.bookings)
			.where(
				and(
					isNull(t.bookings.deletedAt),
					eq(t.bookings.status, 'cancelled'),
					gte(t.bookings.updatedAt, monthStart)
				)
			)
	]);

	const deals = open.map((deal) => ({
		...deal,
		idleDays: Number(deal.idleDays ?? 0),
		overdue: Boolean(Number(deal.overdue)),
		stale: Number(deal.idleDays ?? 0) >= STALE_DAYS
	}));

	const columns = BOARD_STATES.map((status) => {
		const inState = deals.filter((deal) => deal.status === status);
		return {
			status,
			count: inState.length,
			value: inState.reduce((sum, deal) => sum + deal.price, 0),
			deals: inState
		};
	});

	/* What needs a person: a dispute, an introduction to make, a cancellation
	   waiting on an answer, a missed deadline, a deal nobody has touched. */
	const attention = deals
		.filter(
			(deal) =>
				deal.status === 'disputed' ||
				deal.introductionStatus === 'pending' ||
				deal.cancelRequestedAt !== null ||
				(deal.overdue &&
					['booked', 'concept', 'in_production', 'revision'].includes(deal.status)) ||
				deal.stale
		)
		.map((deal) => ({
			...deal,
			reasons: [
				deal.status === 'disputed' ? 'disputed' : null,
				deal.introductionStatus === 'pending' ? 'introduction' : null,
				deal.cancelRequestedAt !== null ? 'cancel_requested' : null,
				deal.overdue && ['booked', 'concept', 'in_production', 'revision'].includes(deal.status)
					? 'overdue'
					: null,
				deal.stale ? 'stale' : null
			].filter((reason): reason is string => reason !== null)
		}));

	const month = completedThisMonth[0];
	return {
		columns,
		attention,
		staleDays: STALE_DAYS,
		totals: {
			open: deals.length,
			pipelineValue: deals.reduce((sum, deal) => sum + deal.price, 0),
			expectedRevenue: deals.reduce(
				(sum, deal) => sum + deal.platformFee + deal.brandServiceFee,
				0
			),
			completed: Number(month?.count ?? 0),
			completedPaid: Number(month?.paid ?? 0),
			revenue: Number(month?.revenue ?? 0),
			volume: Number(month?.volume ?? 0),
			cancelled: Number(cancelledThisMonth[0]?.count ?? 0),
			gate: V2_GATE
		}
	};
};
