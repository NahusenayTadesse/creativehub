import * as m from '$lib/paraglide/messages';
import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq, inArray, ne } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { introductionsQuery } from '$lib/server/queries';
import { requireRole, recordAudit } from '$lib/server/guards';
import { canIntroduce, canTransition } from '$lib/domain/booking';
import type { BookingStatus, IntroductionStatus } from '$lib/domain/booking';
import { introductionDecision } from '$lib/schemas';

/**
 * Deals opened against a profile nobody had claimed.
 *
 * `none` is excluded at every turn, not just when no tab is chosen: it is the
 * ordinary booking, and this surface is not a second bookings list. A crafted
 * `?introduction=none` therefore returns nothing rather than the whole table.
 */
const isIntroduction = () => [ne(t.bookings.introductionStatus, 'none')];

/** The cases still waiting on somebody. */
const OPEN: IntroductionStatus[] = ['pending', 'contacted'];

export const load: PageServerLoad = async ({ url }) => {
	/*
	 * A queue opens on what is waiting. With no `introduction` in the URL the
	 * open cases are the view; `?introduction=all` is not in the column's
	 * vocabulary, so it drops out and every case shows — which is what the
	 * "all" tab means, still inside `isIntroduction`.
	 */
	const chosen = url.searchParams.get('introduction');
	const scope = chosen
		? isIntroduction()
		: [...isIntroduction(), inArray(t.bookings.introductionStatus, OPEN)];

	const [cases, statusCounts, form] = await Promise.all([
		introductionsQuery.run(url, { where: scope }),
		introductionsQuery.facet(url, 'introduction', { where: isIntroduction() }),
		superValidate(zod4(introductionDecision))
	]);

	return { cases, statusCounts, form };
};

export const actions: Actions = {
	decide: async (event) => {
		const user = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(introductionDecision));
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		const rows = await db.select().from(t.bookings).where(eq(t.bookings.id, form.data.id)).limit(1);
		const booking = rows.at(0);
		if (!booking) return fail(404, { message: m.srv_case_not_found() });

		/* The client requests an outcome and never asserts one — the same rule the
		   booking lifecycle runs on. */
		const from = booking.introductionStatus as IntroductionStatus;
		if (!canIntroduce(from, form.data.status)) {
			return fail(409, { message: m.srv_bad_introduction() });
		}
		/* An outcome that closes a case has to say why: it is the only record of
		   what was said to the creator. */
		if (form.data.status === 'declined' && !form.data.introductionNote.trim()) {
			return fail(400, { message: m.srv_need_introduction_reason() });
		}

		await db
			.update(t.bookings)
			.set({
				introductionStatus: form.data.status,
				introductionNote: form.data.introductionNote || null,
				introducedBy: user.id,
				introducedAt: new Date(),
				updatedBy: user.id
			})
			.where(eq(t.bookings.id, booking.id));

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'introduction',
			entityId: booking.id,
			action: 'decision',
			fromState: from,
			toState: form.data.status,
			reason: form.data.introductionNote || undefined
		});

		/*
		 * A creator who has said no is not going to accept the offer, and a deal
		 * left at `proposed` for a person who will never see it is the hole this
		 * queue exists to close. Cancelling is a lifecycle move like any other,
		 * so it goes through `canTransition` and appends its own audit line.
		 */
		const status = booking.status as BookingStatus;
		if (form.data.status === 'declined' && canTransition(status, 'cancelled')) {
			const reason = m.ai_cancelled_reason({ note: form.data.introductionNote });
			await db
				.update(t.bookings)
				.set({ status: 'cancelled', cancelReason: reason, updatedBy: user.id })
				.where(eq(t.bookings.id, booking.id));

			await recordAudit({
				actorId: user.id,
				actorLabel: user.name,
				entity: 'booking',
				entityId: booking.id,
				action: 'cancelled',
				fromState: status,
				toState: 'cancelled',
				reason
			});
		}

		return { decided: form.data.status };
	}
};
