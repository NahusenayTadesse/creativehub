import * as m from '$lib/paraglide/messages';
import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { chapaEnabled, SUPPORTED_CURRENCIES } from '$lib/server/chapa';
import { listOwedBookings, payoutQuery } from '$lib/server/queries';
import { requireRole, recordAudit } from '$lib/server/guards';
import * as payouts from '$lib/server/payouts';
import { maskAccount, payoutProblemLabel } from '$lib/domain/payout';
import { payoutAccountVerify, payoutRefSchema, sendPayoutSchema } from '$lib/schemas';

/**
 * The operator's payout queue.
 *
 * Two lists that answer two different questions: who is owed money, and what
 * happened to everything already sent. They are separate because they are read
 * at different times — the first is worked to empty, the second is opened when
 * someone asks about a specific transfer.
 *
 * Nothing on this page pays anybody automatically. Chapa transfers draw on a
 * funded merchant balance and cannot be recalled, so the last step is always a
 * person pressing a button next to a name and an amount they can read.
 */
export const load: PageServerLoad = async (event) => {
	requireRole(event, 'admin');

	const [owed, history] = await Promise.all([listOwedBookings(), payoutQuery.run(event.url)]);

	/*
	 * Masked here, not in the template.
	 *
	 * Masking in the markup only hides the number from the rendered page — the
	 * full value still travels inside SvelteKit's serialised page data, where it
	 * sits in view-source, in the browser's cache and in any screen share. An
	 * operator has no use for the other eight digits, so they do not leave the
	 * server. The creator's own page is the one place the whole number is sent,
	 * to the one person who needs to check it against their bank card.
	 */
	const masked = <T extends { accountNumber: string | null }>(row: T) => ({
		...row,
		accountNumber: row.accountNumber ? maskAccount(row.accountNumber) : null
	});

	return {
		owed: owed.rows.map(masked),
		/* The queue is capped for one render; the count is the whole debt, and
		   the page says so when the two differ. */
		owedTotal: owed.total,
		history: { ...history, rows: history.rows.map(masked) },
		/* Drawn as a banner rather than hiding the queue: an operator still needs
		   to see who is waiting when the provider is not configured. */
		chapaEnabled,
		/* So the queue can grey out a row the provider would refuse, instead of
		   offering a button whose only outcome is the refusal. */
		supportedCurrencies: SUPPORTED_CURRENCIES as readonly string[]
	};
};

export const actions: Actions = {
	/** Sends one booking's money. The one action here that moves anything. */
	send: async (event) => {
		const user = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(sendPayoutSchema));
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });
		if (!chapaEnabled) return fail(503, { message: m.srv_payouts_unavailable() });

		/*
		 * Re-read rather than trusted from the queue.
		 *
		 * This page lists what was owed when it loaded and can sit open for an
		 * afternoon. Every guard in `payoutProblem` runs again inside `send`
		 * against this row, so a booking that has since been paid, disputed or
		 * refunded is refused here rather than paid twice.
		 */
		const rows = await db
			.select()
			.from(t.bookings)
			.where(eq(t.bookings.id, form.data.bookingId))
			.limit(1);
		const booking = rows.at(0);
		if (!booking) return fail(404, { message: m.srv_booking_not_found() });

		const result = await payouts.send(booking, { id: user.id, name: user.name });

		if (!result.ok) {
			if ('problem' in result) {
				return fail(409, { message: payoutProblemLabel(result.problem) });
			}
			/* Chapa's own words are logged, not shown: they are English, often
			   about our request rather than the bank, and the operator's next step
			   is the same either way — look at the failed row. */
			console.error(`Chapa transfer refused for booking ${booking.id}:`, result.error);
			return fail(502, { message: m.srv_payout_send_failed() });
		}

		return { sent: true, reference: result.reference };
	},

	/** Asks Chapa again what became of one attempt, and applies the answer. */
	refresh: async (event) => {
		requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(payoutRefSchema));
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		const rows = await db.select().from(t.payouts).where(eq(t.payouts.id, form.data.id)).limit(1);
		const payout = rows.at(0);
		if (!payout) return fail(404, { message: m.srv_payout_not_found() });

		const outcome = await payouts.reconcile(payout.reference);
		if (outcome.state === 'unreachable') {
			return fail(502, { message: m.srv_payouts_unavailable() });
		}

		return { refreshed: outcome.state };
	},

	/**
	 * Records that a person checked the creator's bank details.
	 *
	 * The only thing standing between a mistyped account number and a stranger's
	 * bank balance, which is why it is a separate action from the creator's own
	 * form and why editing that form clears it.
	 */
	verifyAccount: async (event) => {
		const user = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(payoutAccountVerify));
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		const rows = await db
			.select()
			.from(t.payoutAccounts)
			.where(eq(t.payoutAccounts.id, form.data.id))
			.limit(1);
		const account = rows.at(0);
		if (!account) return fail(404, { message: m.srv_case_not_found() });

		await db
			.update(t.payoutAccounts)
			.set({
				isVerified: form.data.isVerified,
				verifiedBy: form.data.isVerified ? user.id : null,
				verifiedAt: form.data.isVerified ? new Date() : null,
				updatedBy: user.id
			})
			.where(eq(t.payoutAccounts.id, account.id));

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'creator',
			entityId: account.creatorId,
			action: form.data.isVerified ? 'payout_account_verified' : 'payout_account_unverified',
			reason: `${account.bankName} ${payouts.maskAccount(account.accountNumber)}`
		});

		return { verified: form.data.isVerified };
	}
};
