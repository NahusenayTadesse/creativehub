import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/guards';
import { listHiddenCreators, listingRules } from '$lib/server/queries';

/**
 * Published profiles the public never sees, and why.
 *
 * The homepage, discovery, trending and the public figures all list bookable
 * creators only. The rest stay in the system — the pan-African supply is kept
 * for later — and wait here, where the team that can fix them can find them.
 */
export const load: PageServerLoad = async (event) => {
	requireRole(event, 'admin', 'encoder');
	const [creators, rules] = await Promise.all([listHiddenCreators(event.url), listingRules()]);
	return { creators, requirePrice: rules.requirePrice };
};
