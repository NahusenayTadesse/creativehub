import type { LayoutServerLoad } from './$types';
import { requireRole } from '$lib/server/guards';

/** Everything under /dashboard/admin is operator-only, enforced server-side. */
export const load: LayoutServerLoad = async (event) => {
	requireRole(event, 'admin');
	return {};
};
