/**
 * What a deal costs each side, and what the platform earns from it.
 *
 * The platform is a managed marketplace: the brand contracts with us and pays
 * one invoice, we pay the creator, and we keep a commission on every completed
 * deal. The commission is tiered by deal size, with a floor, and the brand pays
 * a separate service fee on top of the deal price. Every number here is an
 * operator setting (`site_settings`), never a constant in the code — the ones
 * below are only the defaults a fresh install starts from.
 *
 * Tiers are *flat by bracket*, not marginal: a 200,000 ETB deal is charged 12%
 * on the whole amount, the way the rate card is written ("100,001 to 500,000 —
 * 12%"), not 15% on the first 100,000 and 12% on the rest.
 *
 * Pure arithmetic, so the admin calculator, the booking page and the invoice
 * all print the same figures from the same inputs.
 */

export type CommissionTier = {
	/** Inclusive upper bound of the bracket, in the deal currency. Null: no ceiling. */
	upTo: number | null;
	/** Percent of the deal price, e.g. 12 for 12%. */
	percent: number;
};

export type CommissionSettings = {
	tiers: CommissionTier[];
	/** The least commission charged on any paid deal, however small. */
	minCommission: number;
	/** The smallest paid deal the platform will write. */
	minProjectSize: number;
	/** Percent of the deal price the brand pays on top, for the managed service. */
	brandServiceFeePercent: number;
	/** Whether the platform charges VAT on its own service fee. */
	vatRegistered: boolean;
	vatPercent: number;
};

/** The rate card the brief set out. Operators change it at /dashboard/admin/settings. */
export const DEFAULT_TIERS: CommissionTier[] = [
	{ upTo: 100_000, percent: 15 },
	{ upTo: 500_000, percent: 12 },
	{ upTo: 1_500_000, percent: 10 },
	{ upTo: null, percent: 8 }
];

export const DEFAULT_COMMISSION: CommissionSettings = {
	tiers: DEFAULT_TIERS,
	minCommission: 1_500,
	minProjectSize: 5_000,
	brandServiceFeePercent: 5,
	vatRegistered: true,
	vatPercent: 15
};

const finite = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value);

/**
 * A stored tier list made whole.
 *
 * Whatever is stored — null, text from a MariaDB that keeps JSON as LONGTEXT,
 * a hand-edited list — comes out sorted by ceiling, with exactly one open-ended
 * bracket last. An unreadable list falls back to the defaults rather than to no
 * commission at all, because "charge nothing" is the one mistake that is
 * invisible until the month's figures come in.
 */
export function normaliseTiers(stored: unknown): CommissionTier[] {
	let raw = stored;
	if (typeof raw === 'string') {
		try {
			raw = JSON.parse(raw);
		} catch {
			raw = null;
		}
	}
	if (!Array.isArray(raw)) return DEFAULT_TIERS;

	const tiers = raw
		.map((tier) => ({
			upTo: finite(tier?.upTo) && tier.upTo > 0 ? Math.round(tier.upTo) : null,
			percent: finite(tier?.percent) ? Math.min(Math.max(tier.percent, 0), 100) : NaN
		}))
		.filter((tier) => Number.isFinite(tier.percent));
	if (!tiers.length) return DEFAULT_TIERS;

	const bounded = tiers
		.filter((tier) => tier.upTo !== null)
		.sort((a, b) => (a.upTo as number) - (b.upTo as number))
		/* Two brackets with one ceiling: the first wins, the rest are noise. */
		.filter((tier, index, all) => index === 0 || tier.upTo !== all[index - 1].upTo);
	const open = tiers.find((tier) => tier.upTo === null) ?? {
		upTo: null,
		percent: bounded.at(-1)?.percent ?? DEFAULT_TIERS.at(-1)!.percent
	};
	return [...bounded, open];
}

/** The bracket a deal of this size falls in. */
export function tierFor(amount: number, tiers: CommissionTier[]): CommissionTier {
	const sorted = normaliseTiers(tiers);
	return sorted.find((tier) => tier.upTo === null || amount <= tier.upTo) ?? sorted.at(-1)!;
}

export type DealQuote = {
	price: number;
	/** The rate applied, after any level discount. */
	commissionPercent: number;
	/** What the platform keeps out of the price. */
	commission: number;
	/** True when the floor, not the rate, decided the commission. */
	minimumApplied: boolean;
	/** What the creator is paid. */
	creatorPayout: number;
	/** What the brand pays on top of the price, before VAT. */
	brandServiceFee: number;
	/** VAT on that service fee, when the platform is registered for it. */
	brandServiceFeeVat: number;
	/** Everything the brand pays: price, service fee and its VAT. */
	brandTotal: number;
	/** What the platform earns in all, before VAT: commission and service fee. */
	platformRevenue: number;
};

/**
 * Prices one deal.
 *
 * `discountPoints` takes that many percentage points off the bracket's rate —
 * the Elite creator level earns one — and never takes it below zero.
 *
 * A deal with no price (barter, an event pass) earns nothing and costs
 * nothing: the floor applies to money that changes hands, and there is none.
 * The commission is never more than the price, so a creator is never owed a
 * negative payout by a floor larger than a tiny deal.
 */
export function quoteDeal(
	price: number,
	settings: CommissionSettings = DEFAULT_COMMISSION,
	options: { discountPoints?: number } = {}
): DealQuote {
	const amount = Math.max(0, Math.round(finite(price) ? price : 0));
	const tier = tierFor(amount, settings.tiers);
	const commissionPercent = Math.max(0, tier.percent - (options.discountPoints ?? 0));

	if (amount === 0) {
		return {
			price: 0,
			commissionPercent,
			commission: 0,
			minimumApplied: false,
			creatorPayout: 0,
			brandServiceFee: 0,
			brandServiceFeeVat: 0,
			brandTotal: 0,
			platformRevenue: 0
		};
	}

	const byRate = Math.round((amount * commissionPercent) / 100);
	const floor = Math.max(0, Math.round(settings.minCommission));
	const commission = Math.min(amount, Math.max(byRate, floor));
	const brandServiceFee = Math.round((amount * Math.max(0, settings.brandServiceFeePercent)) / 100);
	const brandServiceFeeVat = settings.vatRegistered
		? Math.round((brandServiceFee * Math.max(0, settings.vatPercent)) / 100)
		: 0;

	return {
		price: amount,
		commissionPercent,
		commission,
		minimumApplied: floor > byRate && commission === Math.min(amount, floor),
		creatorPayout: amount - commission,
		brandServiceFee,
		brandServiceFeeVat,
		brandTotal: amount + brandServiceFee + brandServiceFeeVat,
		platformRevenue: commission + brandServiceFee
	};
}

/**
 * Why a paid deal of this price may not be written, or null when it may.
 * Only paid deals have a minimum: barter and event passes carry no price.
 */
export function projectSizeProblem(
	price: number,
	compensationType: string,
	settings: Pick<CommissionSettings, 'minProjectSize'>
): 'below_minimum' | null {
	if (compensationType !== 'paid') return null;
	return price < settings.minProjectSize ? 'below_minimum' : null;
}
