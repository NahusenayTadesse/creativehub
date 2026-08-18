import { getLocale } from '$lib/paraglide/runtime';

/**
 * The BCP 47 tag to format numbers and dates with.
 *
 * Never pass `undefined` to `toLocaleString` in this app: on the server that
 * resolves to the Node process locale and in the browser to the visitor's, so
 * the same amount renders with different separators either side of hydration.
 * Deriving the tag from the request's own locale keeps the two identical.
 */
export function intlLocale(): string {
	return getLocale() === 'am' ? 'am-ET' : 'en-GB';
}
