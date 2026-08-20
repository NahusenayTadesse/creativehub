import type { PageServerLoad } from './$types';
import {
	listFeaturedCreators,
	listTrendingCreators,
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

	const [featured, trending, stats, gallery] = await Promise.all([
		listFeaturedCreators(),
		listTrendingCreators(),
		getPlatformStats(),
		listGallerySlides()
	]);

	return { featured, trending, stats, gallery };
};
