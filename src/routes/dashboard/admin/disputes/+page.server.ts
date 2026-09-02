import * as m from '$lib/paraglide/messages';
import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { getSettings } from '$lib/server/queries';
import { requireRole } from '$lib/server/guards';
import * as disputes from '$lib/server/disputes';
import * as refunds from '$lib/server/refunds';
import { disputeResolve } from '$lib/schemas';

/**
 * Where somebody decides.
 *
 * Two lists, like the payout queue beside it: the open cases, oldest first
 * because the queue is a debt, and everything already closed for when a
 * question comes back about one.
 *
 * A case carries both written statements, the deal's money, and — when the
 * creator has already been paid — a warning that a refund here comes out of the
 * platform's own balance. That last one is the difference between an informed
 * decision and an expensive surprise.
 */
export const load: PageServerLoad = async (event) => {
	requireRole(event, 'admin');

	const openOnly = event.url.searchParams.get('view') !== 'all';

	const [cases, settings, form] = await Promise.all([
		disputes.listCases(openOnly),
		getSettings(),
		superValidate(zod4(disputeResolve))
	]);

	/*
	 * The refunds these cases set in motion, grouped by booking.
	 *
	 * Loaded here rather than joined into the case list because a case has many
	 * refunds — a first attempt that Chapa refused and a second that worked —
	 * and a join would multiply each case by its attempts.
	 */
	const bookingIds = [...new Set(cases.map((c) => c.bookingId))];
	const refundRows = bookingIds.length ? await refunds.listForBookings(bookingIds) : [];
	const refundsByBooking: Record<number, typeof refundRows> = {};
	for (const row of refundRows) (refundsByBooking[row.bookingId] ??= []).push(row);

	return {
		cases,
		refundsByBooking,
		openOnly,
		feePercent: settings?.platformFeePercent ?? 15,
		form
	};
};

export const actions: Actions = {
	resolve: async (event) => {
		const user = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(disputeResolve));
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		const rows = await db.select().from(t.disputes).where(eq(t.disputes.id, form.data.id)).limit(1);
		const dispute = rows.at(0);
		if (!dispute) return fail(404, { message: m.srv_dispute_not_found() });
		if (dispute.status !== 'open') return fail(409, { message: m.srv_dispute_closed() });

		const bookingRows = await db
			.select()
			.from(t.bookings)
			.where(eq(t.bookings.id, dispute.bookingId))
			.limit(1);
		const booking = bookingRows.at(0);
		if (!booking) return fail(404, { message: m.srv_booking_not_found() });

		const settings = await getSettings();

		const result = await disputes.resolve(booking, dispute, {
			resolution: form.data.resolution,
			refundInput: form.data.refundAmount,
			note: form.data.note,
			feePercent: settings?.platformFeePercent ?? 15,
			actor: { id: user.id, name: user.name }
		});

		if (!result.ok) return fail(400, { message: result.error });

		/*
		 * The case is closed either way.
		 *
		 * A refund that Chapa refused leaves a failed row an operator can retry,
		 * and reporting it as a warning rather than an error is the honest
		 * shape: the decision really was recorded, and telling them it failed
		 * outright would invite them to make it a second time.
		 */
		return { resolved: true, refundQueued: result.refundQueued, refundError: result.refundError };
	},

	/** Asks Chapa again what became of a refund this queue set in motion. */
	refreshRefund: async (event) => {
		requireRole(event, 'admin');
		const data = await event.request.formData();
		const id = Number(data.get('id'));
		if (!Number.isInteger(id) || id <= 0) return fail(400, { message: m.srv_invalid_request() });

		const outcome = await refunds.reconcile(id);
		if (outcome.state === 'unreachable') return fail(502, { message: outcome.reason });
		if (outcome.state === 'not_found') return fail(404, { message: m.srv_invalid_request() });

		return { refreshed: outcome.state };
	}
};
