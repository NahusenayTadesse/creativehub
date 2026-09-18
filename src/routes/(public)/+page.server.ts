import type { PageServerLoad } from './$types';
import {
	listFeaturedCreators,
	listTrendingCreators,
	listTrendingLanes,
	getPlatformStats,
	listGallerySlides,
	listLandingBrands,
	listOpenBriefs,
	listLatestPosts,
	listPartners
} from '$lib/server/queries';
import { maybeAutoRefresh } from '$lib/server/trending-service';
import { landingLayout } from '$lib/domain/landing';

export const load: PageServerLoad = async ({ parent }) => {
	/*
	 * There is no job runner here, so the page that reads the trending board is
	 * what notices it has gone stale. Deliberately not awaited: a visitor should
	 * never wait on a recompute, and the board they get is simply the last one
	 * published. Does nothing unless automatic refresh is switched on.
	 */
	void maybeAutoRefresh();

	/* A section an operator hid is not queried for. The trending strip is still
	   read when its section is hidden: the hero's featured card falls back to it. */
	const { settings } = await parent();
	const shown = new Set(
		landingLayout(settings?.landingSections)
			.filter((section) => section.visible)
			.map((section) => section.key)
	);

	const [featured, trending, lanes, stats, gallery, briefs, brands, posts, partners] =
		await Promise.all([
			listFeaturedCreators(),
			listTrendingCreators(),
			/* The same board, cut by category, market and channel. Empty until a run
			   has published lanes, which is what keeps the strip a single row on a
			   fresh install rather than a row of chips with nothing behind them. */
			shown.has('trending') ? listTrendingLanes() : [],
			getPlatformStats(),
			shown.has('gallery') ? listGallerySlides() : [],
			shown.has('campaigns') ? listOpenBriefs() : [],
			shown.has('brands') ? listLandingBrands() : [],
			shown.has('blog') ? listLatestPosts() : [],
			/* The hero is always shown, so its partner strip is always read. */
			listPartners()
		]);

	return { featured, trending, lanes, stats, gallery, briefs, brands, posts, partners };
};
