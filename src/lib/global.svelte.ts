import { SvelteDate } from 'svelte/reactivity';
import { intlLocale } from '$lib/locale';

export const bgGradient = `bg-linear-to-r from-background  to-secondary`;

export const selectItem = `hover:bg-well hover:shadow-md hover:scale-101 duration-300 transition-all ease-in-out dark:hover:bg-inverse`;

export const dropdownClass = `flex capitalize flex-row gap-2 ${selectItem}`;

/** Option shape used by the select, combobox and box-select inputs. */
export type Item = {
	value: string | number;
	name: string;
	/**
	 * A platform whose logo stands for this option — `platforms.name`, as
	 * `$lib/components/platform-glyph.svelte` spells it.
	 *
	 * Only the box select draws it; the plain select and the combobox ignore it,
	 * so one list of items can feed all three. Absent on the options that stand
	 * for no platform in particular, such as a filter's "All platforms", which
	 * is why it is a separate field rather than being read off `name`.
	 */
	glyph?: string;
	/** `platforms.color`, for the fallback badge when there is no logo. */
	color?: string;
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
