import * as m from '$lib/paraglide/messages';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireCreator, recordAudit } from '$lib/server/guards';
import { creatorOwed, listCreatorPayouts } from '$lib/server/queries';
import * as payouts from '$lib/server/payouts';
import { payoutAccountSchema } from '$lib/schemas';

/**
 * Where a creator says where their money goes, and sees what has been sent.
 *
 * The account number is loaded in full here and nowhere else: this is the one
 * person entitled to read it back, and a creator who cannot see what they
 * typed cannot check it against their bank card. Every other surface in the
 * app shows it through `maskAccount`.
 */
export const load: PageServerLoad = async (event) => {
	const { creator } = await requireCreator(event);

	const [account, history, owed, bankList] = await Promise.all([
		payouts.accountFor(creator.id),
		listCreatorPayouts(creator.id),
		creatorOwed(creator.id),
		payouts.banks()
	]);

	const form = await superValidate(
		account
			? {
					bank: account.bankCode,
					accountName: account.accountName,
					accountNumber: account.accountNumber
				}
			: undefined,
		zod4(payoutAccountSchema)
	);

	return {
		form,
		account,
		history,
		owed,
		/* An empty list is the signal the page draws its "cannot reach Chapa"
		   notice from — it is not an error, because the history below is still
		   worth showing while the provider is unreachable. */
		banks: bankList.ok ? bankList.banks : []
	};
};

export const actions: Actions = {
	saveAccount: async (event) => {
		const { creator, user } = await requireCreator(event);
		const form = await superValidate(event.request, zod4(payoutAccountSchema));
		if (!form.valid)
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });

		const bankList = await payouts.banks();
		if (!bankList.ok) {
			return message(form, { type: 'error', text: m.payo_banks_unavailable() }, { status: 503 });
		}

		/*
		 * The bank has to be one Chapa named.
		 *
		 * `bank` arrives as a number from a select, and a select is a
		 * suggestion. Sending an unknown code to the transfer endpoint is a
		 * rejected transfer at best; the failure mode worth ruling out here is a
		 * code that happens to be valid but is not the bank whose account number
		 * format the creator typed against.
		 */
		const bank = bankList.banks.find((b) => b.id === form.data.bank);
		if (!bank)
			return message(form, { type: 'error', text: m.srv_invalid_request() }, { status: 400 });

		/* Chapa publishes the account length per bank, and a number of the wrong
		   length is the single most common way money reaches a stranger. */
		if (bank.accountLength > 0 && form.data.accountNumber.length !== bank.accountLength) {
			return message(
				form,
				{
					type: 'error',
					text: m.payo_account_length_hint({ bank: bank.name, length: bank.accountLength })
				},
				{ status: 400 }
			);
		}

		const existing = await payouts.accountFor(creator.id);

		/*
		 * Any edit clears the operator's check.
		 *
		 * Keeping it would make the check a property of the creator rather than
		 * of the numbers, and an account verified in March could be pointed at a
		 * different person in April without anyone looking again.
		 */
		const values = {
			creatorId: creator.id,
			bankCode: bank.id,
			bankName: bank.name,
			accountName: form.data.accountName,
			accountNumber: form.data.accountNumber,
			currencyCode: bank.currency || 'ETB',
			isVerified: false,
			verifiedBy: null,
			verifiedAt: null,
			updatedBy: user.id
		};

		if (existing) {
			await db.update(t.payoutAccounts).set(values).where(eq(t.payoutAccounts.id, existing.id));
		} else {
			await db.insert(t.payoutAccounts).values({ ...values, createdBy: user.id });
		}

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'creator',
			entityId: creator.id,
			action: existing ? 'payout_account_changed' : 'payout_account_added',
			/* The number itself never reaches the audit log — the log is read by
			   every operator, and the last four are enough to tell rows apart. */
			reason: `${bank.name} ${payouts.maskAccount(form.data.accountNumber)}`
		});

		return message(form, { type: 'success', text: m.payo_account_saved() });
	}
};
