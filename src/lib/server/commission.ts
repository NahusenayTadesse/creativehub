import { getSettings } from '$lib/server/queries';
import {
	DEFAULT_COMMISSION,
	normaliseTiers,
	quoteDeal,
	type CommissionSettings,
	type DealQuote
} from '$lib/domain/commission';

/**
 * The operator's rate card, read from `site_settings`.
 *
 * A fresh install with no settings row prices deals by the defaults in
 * $lib/domain/commission, which are the rates the brief set out.
 */
export async function getCommissionSettings(): Promise<CommissionSettings> {
	const settings = await getSettings();
	if (!settings) return DEFAULT_COMMISSION;
	return {
		tiers: normaliseTiers(settings.commissionTiers),
		minCommission: settings.minCommission,
		minProjectSize: settings.minProjectSize,
		brandServiceFeePercent: settings.brandServiceFeePercent,
		vatRegistered: settings.vatRegistered,
		vatPercent: settings.vatPercent
	};
}

/**
 * Commission points a creator's level takes off their rate.
 *
 * Levels arrive in Version 1.5, where Elite earns one point. Until then every
 * creator pays the card rate; this is the one place that changes when they do.
 */
export async function creatorDiscountPoints(creatorId: number): Promise<number> {
	void creatorId;
	return 0;
}

/** One deal priced with the live rate card and the creator's level. */
export async function priceDeal(price: number, creatorId: number): Promise<DealQuote> {
	const [settings, discountPoints] = await Promise.all([
		getCommissionSettings(),
		creatorDiscountPoints(creatorId)
	]);
	return quoteDeal(price, settings, { discountPoints });
}

/** The booking columns a quote fills. */
export const quoteColumns = (quote: DealQuote) => ({
	platformFee: quote.commission,
	creatorPayout: quote.creatorPayout,
	commissionPercent: quote.commissionPercent,
	brandServiceFee: quote.brandServiceFee,
	brandServiceFeeVat: quote.brandServiceFeeVat,
	brandTotal: quote.brandTotal
});
