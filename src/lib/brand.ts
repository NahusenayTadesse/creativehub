import { assetUrl } from '$lib/assets';

/**
 * Which mark to draw, and where it comes from.
 *
 * Two sources, in order: whatever an operator uploaded on the settings page,
 * then the files in `static/brand/` that ship with the app. The fallback is the
 * point — a database with no `site_settings` row at all, which is every fresh
 * install, still renders the identity rather than four empty boxes.
 *
 * The files under `static/brand/` are built from the print originals in
 * `assets-src/brand/` by `scripts/build-brand-assets.sh`; see that script for
 * why the dark wordmark is a separate file rather than a CSS filter.
 */

/** What ships in `static/`. Absolute paths, so `assetUrl` passes them through. */
export const DEFAULT_LOGOS = {
	wordmark: '/brand/wordmark.webp',
	wordmarkDark: '/brand/wordmark-dark.webp',
	mark: '/brand/mark.webp',
	partners: '/brand/partners.webp'
} as const;

export type Logos = {
	/** The wide lockup: mark, name and tagline. For anything wider than a phone. */
	wordmark: string;
	/** The same, drawn to sit on a dark ground. */
	wordmarkDark: string;
	/** The textless square. A phone header, a tab icon, a tight corner. */
	mark: string;
	/** The co-branded lockup. The footer, and nowhere else. */
	partners: string;
};

/** The four columns `site_settings` stores them in, as the layout hands them on. */
export type LogoSettings =
	| {
			logoWordmark?: string | null;
			logoWordmarkDark?: string | null;
			logoMark?: string | null;
			logoPartners?: string | null;
	  }
	| null
	/* `getSettings` returns `undefined` when the row does not exist, and the
	   root layout hands on `null`. Both mean the same thing here. */
	| undefined;

/**
 * The four URLs to draw, given whatever the settings row holds.
 *
 * `logoWordmarkDark` falls back to the light wordmark rather than to the
 * shipped dark one: an operator who uploads their own mark and leaves the dark
 * slot empty means "this one works on both grounds", and answering that with
 * *our* dark wordmark would put two different brands on the same page depending
 * on the reader's theme.
 */
export function resolveLogos(settings: LogoSettings): Logos {
	const wordmark = assetUrl(settings?.logoWordmark) || DEFAULT_LOGOS.wordmark;
	const custom = Boolean(settings?.logoWordmark);

	return {
		wordmark,
		wordmarkDark:
			assetUrl(settings?.logoWordmarkDark) || (custom ? wordmark : DEFAULT_LOGOS.wordmarkDark),
		mark: assetUrl(settings?.logoMark) || DEFAULT_LOGOS.mark,
		partners: assetUrl(settings?.logoPartners) || DEFAULT_LOGOS.partners
	};
}
