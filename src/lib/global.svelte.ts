import { SvelteDate } from 'svelte/reactivity';

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

export const formatEthiopianDate = (date: Date | string | undefined): string => {
	if (!date) return '';

	return new Intl.DateTimeFormat('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	}).format(new SvelteDate(date));
};
