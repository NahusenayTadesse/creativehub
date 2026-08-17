/**
 * One source of truth for currency. Rates live on the `countries` table so an
 * operator can correct them without a deploy; nothing in the app hard-codes a
 * second table.
 */

export type Rate = { code: string; symbol: string; flag: string; usdRate: number; name: string };

/** Fallback used before reference data has loaded, or for unknown codes. */
const FALLBACK: Rate = { code: 'USD', symbol: '$', flag: '🇺🇸', usdRate: 1, name: 'US Dollar' };

/** Currencies that conventionally show no minor units in this product. */
const ZERO_DECIMAL = new Set(['ETB', 'KES', 'NGN', 'RWF', 'UGX', 'TZS']);

export function buildRates(
	countries: { currencyCode: string; currencySymbol: string; flag: string; usdRate: number; name: string }[]
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

/** Convert through USD. Returns the input untouched if either code is unknown. */
export function convert(
	amount: number,
	from: string,
	to: string,
	rates: Record<string, Rate>
): number {
	if (from === to) return amount;
	const source = rates[from];
	const target = rates[to];
	if (!source || !target || !source.usdRate) return amount;
	return (amount / source.usdRate) * target.usdRate;
}

export function formatMoney(amount: number, code: string, rates: Record<string, Rate>): string {
	const rate = rates[code] ?? FALLBACK;
	const decimals = ZERO_DECIMAL.has(code) ? 0 : 2;
	return `${rate.symbol} ${amount.toLocaleString(undefined, {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	})}`;
}

/** "12,000 ETB" — the inline form the React cards use. */
export function formatAmountWithCode(amount: number, code: string): string {
	return `${Math.round(amount).toLocaleString()} ${code}`;
}

/** Compact audience numbers: 1.2M, 420K, 940. */
export function formatReach(value: number): string {
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
	if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
	return String(value);
}
