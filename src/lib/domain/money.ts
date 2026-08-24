/**
 * One source of truth for currency. Rates live on the `countries` table so an
 * operator can correct them without a deploy; nothing in the app hard-codes a
 * second table.
 */
import { intlLocale } from '$lib/locale';

export type Rate = { code: string; symbol: string; flag: string; usdRate: number; name: string };

/** Fallback used before reference data has loaded, or for unknown codes. */
const FALLBACK: Rate = { code: 'USD', symbol: '$', flag: '🇺🇸', usdRate: 1, name: 'US Dollar' };

/** Currencies that conventionally show no minor units in this product. */
const ZERO_DECIMAL = new Set(['ETB', 'KES', 'NGN', 'RWF', 'UGX', 'TZS', 'XOF', 'XAF']);

export function buildRates(
	countries: {
		currencyCode: string;
		currencySymbol: string;
		flag: string;
		usdRate: number;
		name: string;
	}[]
): Record<string, Rate> {
	const rates: Record<string, Rate> = { USD: FALLBACK };
	for (const country of countries) {
		rates[country.currencyCode] = {
			code: country.currencyCode,
			symbol: country.currencySymbol,
			flag: country.flag,
			usdRate: country.usdRate,
			name: country.name
		};
	}
	return rates;
}

/**
 * A currency this table actually declares, or nothing.
 *
 * `rates` is a plain object, so `rates['toString']` is a function — truthy,
 * with no `usdRate`. Read straight through, that turned a conversion into
 * `NaN` and a formatted amount into "undefined 500". A currency code arrives
 * from a form or a column; neither is a reason to trust an inherited key.
 */
const rateFor = (rates: Record<string, Rate>, code: string): Rate | undefined =>
	Object.hasOwn(rates, code) ? rates[code] : undefined;

/** Convert through USD. Returns the input untouched if either code is unknown. */
export function convert(
	amount: number,
	from: string,
	to: string,
	rates: Record<string, Rate>
): number {
	if (from === to) return amount;
	const source = rateFor(rates, from);
	const target = rateFor(rates, to);
	if (!source || !target || !source.usdRate || !target.usdRate) return amount;
	return (amount / source.usdRate) * target.usdRate;
}

export function formatMoney(amount: number, code: string, rates: Record<string, Rate>): string {
	const rate = rateFor(rates, code) ?? FALLBACK;
	const decimals = ZERO_DECIMAL.has(code) ? 0 : 2;
	return `${rate.symbol} ${amount.toLocaleString(intlLocale(), {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	})}`;
}

/** "12,000 ETB" — the inline form the React cards use. */
export function formatAmountWithCode(amount: number, code: string): string {
	return `${Math.round(amount).toLocaleString(intlLocale())} ${code}`;
}

/** Compact audience numbers: 1.2M, 420K, 940. */
export function formatReach(value: number): string {
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
	if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
	return String(value);
}
