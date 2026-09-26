import * as m from '$lib/paraglide/messages';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireRole, recordAudit } from '$lib/server/guards';
import { commissionSchema } from '$lib/schemas';
import { forgetSettings, getSettings } from '$lib/server/queries';
import { getCommissionSettings } from '$lib/server/commission';
import { normaliseTiers } from '$lib/domain/commission';

/**
 * The rate card: tiered commission, its floor, the smallest paid deal, the
 * brand's service fee, VAT, withholding, and who invoices are issued by.
 *
 * A change applies to deals priced from now on. A deal's terms freeze with
 * the fees in force when both sides agreed, so nothing already agreed moves.
 */
export const load: PageServerLoad = async (event) => {
	requireRole(event, 'admin');
	const [settings, commission] = await Promise.all([getSettings(), getCommissionSettings()]);
	const form = await superValidate(zod4(commissionSchema));
	Object.assign(form.data, {
		tierUpTo: commission.tiers.map((tier) => (tier.upTo === null ? '' : String(tier.upTo))),
		tierPercent: commission.tiers.map((tier) => tier.percent),
		minCommission: commission.minCommission,
		minProjectSize: commission.minProjectSize,
		brandServiceFeePercent: commission.brandServiceFeePercent,
		vatRegistered: commission.vatRegistered,
		vatPercent: commission.vatPercent,
		withholdingPercent: settings?.withholdingPercent ?? 0,
		invoiceLegalName: settings?.invoiceLegalName ?? '',
		invoiceTin: settings?.invoiceTin ?? '',
		invoiceVatNumber: settings?.invoiceVatNumber ?? '',
		invoiceAddress: settings?.invoiceAddress ?? ''
	});
	return { form };
};

export const actions: Actions = {
	save: async (event) => {
		const user = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(commissionSchema));
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		const { tierUpTo, tierPercent, ...rest } = form.data;
		/* Rows pair up by position; a blank ceiling is the top bracket, and
		   `normaliseTiers` sorts them and keeps exactly one of those. */
		const tiers = normaliseTiers(
			tierPercent.map((percent, index) => {
				const ceiling = Number((tierUpTo[index] ?? '').replace(/[,\s]/g, ''));
				return { upTo: Number.isFinite(ceiling) && ceiling > 0 ? ceiling : null, percent };
			})
		);

		const row = {
			...rest,
			invoiceAddress: rest.invoiceAddress || null,
			commissionTiers: tiers
		};
		const existing = await getSettings();
		if (existing) {
			await db
				.update(t.siteSettings)
				.set({ ...row, updatedBy: user.id })
				.where(eq(t.siteSettings.id, existing.id));
		} else {
			await db.insert(t.siteSettings).values({ ...row, createdBy: user.id });
		}
		forgetSettings();

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'settings',
			action: 'updated',
			reason: `Rate card ${tiers
				.map((tier) => `${tier.upTo === null ? 'above' : `≤${tier.upTo}`} ${tier.percent}%`)
				.join(
					', '
				)}; min ${rest.minCommission}; project ≥${rest.minProjectSize}; brand fee ${rest.brandServiceFeePercent}%; VAT ${rest.vatRegistered ? `${rest.vatPercent}%` : 'off'}; withholding ${rest.withholdingPercent}%`
		});

		form.data.tierUpTo = tiers.map((tier) => (tier.upTo === null ? '' : String(tier.upTo)));
		form.data.tierPercent = tiers.map((tier) => tier.percent);
		return message(form, { type: 'success', text: m.cm_saved() });
	}
};
