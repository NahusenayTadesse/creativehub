import type { LayoutServerLoad } from './$types';
import { getReferenceData, getSettings } from '$lib/server/queries';

/**
 * Reference data and the signed-in user, loaded once for every page. The filter
 * panels, currency conversion and navigation all read from here rather than
 * fetching their own copies.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	const [reference, settings] = await Promise.all([getReferenceData(), getSettings()]);

	return {
		user: locals.user
			? {
					id: locals.user.id,
					name: locals.user.name,
					email: locals.user.email,
					image: locals.user.image ?? null,
					role: (locals.user as { role?: string }).role ?? 'creator'
				}
			: null,
		reference,
		settings: settings ?? null
	};
};
