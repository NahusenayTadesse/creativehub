import { SvelteDate } from 'svelte/reactivity';
import { intlLocale } from '$lib/locale';

export const bgGradient = `bg-linear-to-r from-background  to-secondary`;

export const selectItem = `hover:bg-gray-100 hover:shadow-md hover:scale-101 duration-300 transition-all ease-in-out dark:hover:bg-gray-900`;

export const dropdownClass = `flex capitalize flex-row gap-2 ${selectItem}`;

/** Option shape used by the select and combobox inputs. */
export type Item = {
	value: string | number;
	name: string;
};

export function isMobile() {
	if (typeof window === 'undefined') return false; // SSR guard
	return window.innerWidth <= 768;
}

/**
 * A long-form date in the request's locale.
 *
 * Formerly `formatEthiopianDate`, which was misleading twice over: it produced
 * a Gregorian date, and it pinned `en-US` regardless of the active locale, so
 * nothing on the site ever rendered a date in Amharic.
 */
export const formatLongDate = (date: Date | string | undefined): string => {
	if (!date) return '';

	return new Intl.DateTimeFormat(intlLocale(), {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	}).format(new SvelteDate(date));
};
