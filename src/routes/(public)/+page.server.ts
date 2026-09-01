import type { PageServerLoad } from './$types';
import {
	listFeaturedCreators,
	listTrendingCreators,
	listTrendingLanes,
	getPlatformStats,
	listGallerySlides
} from '$lib/server/queries';
import { maybeAutoRefresh } from '$lib/server/trending-service';

export const load: PageServerLoad = async () => {
	/*
	 * There is no job runner here, so the page that reads the trending board is
	 * what notices it has gone stale. Deliberately not awaited: a visitor should
	 * never wait on a recompute, and the board they get is simply the last one
	 * published. Does nothing unless automatic refresh is switched on.
	 */
	void maybeAutoRefresh();

	const [featured, trending, lanes, stats, gallery] = await Promise.all([
		listFeaturedCreators(),
		listTrendingCreators(),
		/* The same board, cut by category, market and channel. Empty until a run
		   has published lanes, which is what keeps the strip a single row on a
		   fresh install rather than a row of chips with nothing behind them. */
		listTrendingLanes(),
		getPlatformStats(),
		listGallerySlides()
	]);

	return { featured, trending, lanes, stats, gallery };
};
