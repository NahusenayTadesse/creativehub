import * as m from '$lib/paraglide/messages';

/**
 * The landing page's arrangeable sections.
 *
 * The hero is not one of them: it holds the search box and the page's only
 * `<h1>`, so it is always first and always there. Everything below it is an
 * operator's to reorder or hide.
 */
/*
 * The shipped order reads as the page's argument: the creators themselves
 * straight under the hero, then the ways into them; the open briefs with the
 * three ways a brief pays right behind them, since the pay badge on every
 * brief card is what that section explains; the brands posting them; the
 * gallery as the one picture-led break before the page closes on how each
 * side signs up. The gallery sat first once, where a second headline over a
 * full-width photograph read as another hero and pushed the creators down.
 */
export const LANDING_SECTIONS = [
	'trending',
	/* The wider grid of bookable creators, straight after who is trending, so
	   the page reads as a marketplace before it reads as anything else. */
	'creators',
	'categories',
	'campaigns',
	'compensation',
	'brands',
	'gallery',
	'howItWorks',
	/* Added after the first installs saved a layout. `landingLayout` places any
	   section a stored list never mentioned after its neighbour in this order,
	   so where a section sits here is where it appears on an existing site. */
	'blog'
] as const;

export type LandingSectionKey = (typeof LANDING_SECTIONS)[number];
export type LandingSection = { key: LandingSectionKey; visible: boolean };

/** The checkbox field each section's visibility is posted under. */
export const SECTION_VISIBILITY_FIELD = {
	gallery: 'showGallery',
	trending: 'showTrending',
	creators: 'showCreators',
	categories: 'showCategories',
	campaigns: 'showCampaigns',
	brands: 'showBrands',
	compensation: 'showCompensation',
	howItWorks: 'showHowItWorks',
	blog: 'showBlog'
} as const satisfies Record<LandingSectionKey, string>;

const isSectionKey = (value: unknown): value is LandingSectionKey =>
	(LANDING_SECTIONS as readonly unknown[]).includes(value);

/**
 * The stored arrangement, made whole.
 *
 * Whatever is stored — null on a fresh install, text from a MariaDB that keeps
 * JSON as `LONGTEXT`, a list saved before a section existed — comes out as
 * every section exactly once. Unknown keys are dropped, repeats keep their
 * first place, and a section the saved list never mentioned is added at the
 * end, shown: a section shipped after the operator last saved should appear,
 * not be hidden by a list that could not have known about it.
 */
export function landingLayout(stored: unknown): LandingSection[] {
	let raw = stored;
	if (typeof raw === 'string') {
		try {
			raw = JSON.parse(raw);
		} catch {
			raw = null;
		}
	}

	const layout: LandingSection[] = [];
	const seen = new Set<LandingSectionKey>();

	if (Array.isArray(raw)) {
		for (const item of raw) {
			const key = (item as { key?: unknown })?.key;
			if (!isSectionKey(key) || seen.has(key)) continue;
			seen.add(key);
			layout.push({ key, visible: (item as { visible?: unknown }).visible !== false });
		}
	}

	/* A section the stored list never mentioned goes in after the nearest
	   section that precedes it in the shipped order, so a section shipped
	   between two others lands between them on an existing site too. With no
	   such neighbour stored, it goes at the end. */
	for (const [index, key] of LANDING_SECTIONS.entries()) {
		if (seen.has(key)) continue;
		const before = LANDING_SECTIONS.slice(0, index)
			.reverse()
			.find((earlier) => seen.has(earlier));
		const at = before ? layout.findIndex((section) => section.key === before) + 1 : layout.length;
		layout.splice(at, 0, { key, visible: true });
		seen.add(key);
	}
	return layout;
}

/**
 * The hero's headline, with the translated copy as the fallback.
 *
 * Three lines — plain, coloured, plain — overridden together or not at all. A
 * custom first line left next to the shipped second and third would read as two
 * different pages talking, so typing any one switches all three to what was
 * typed, and an empty line simply leaves the headline shorter.
 */
export function heroHeadline(settings: {
	heroTitle?: string | null;
	heroAccent?: string | null;
	heroTitleEnd?: string | null;
}) {
	const title = settings.heroTitle?.trim() ?? '';
	const accent = settings.heroAccent?.trim() ?? '';
	const end = settings.heroTitleEnd?.trim() ?? '';
	/* The shipped headline is two lines; the third is an operator's to add. */
	if (!title && !accent && !end) {
		return { title: m.hero_title(), accent: m.hero_title_accent(), end: '' };
	}
	return { title, accent, end };
}

/** Labels and one-line explanations for the admin screen. A function: locale is per request. */
export const landingSectionMeta = () =>
	({
		gallery: { label: m.lp_section_gallery(), help: m.lp_section_gallery_help() },
		trending: { label: m.lp_section_trending(), help: m.lp_section_trending_help() },
		creators: { label: m.lp_section_creators(), help: m.lp_section_creators_help() },
		categories: { label: m.lp_section_categories(), help: m.lp_section_categories_help() },
		campaigns: { label: m.lp_section_campaigns(), help: m.lp_section_campaigns_help() },
		brands: { label: m.lp_section_brands(), help: m.lp_section_brands_help() },
		compensation: { label: m.lp_section_compensation(), help: m.lp_section_compensation_help() },
		howItWorks: { label: m.lp_section_how_it_works(), help: m.lp_section_how_it_works_help() },
		blog: { label: m.lp_section_blog(), help: m.lp_section_blog_help() }
	}) satisfies Record<LandingSectionKey, { label: string; help: string }>;
