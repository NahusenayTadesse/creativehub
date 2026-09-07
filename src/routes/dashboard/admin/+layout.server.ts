import type { LayoutServerLoad } from './$types';
import { requireAdminArea } from '$lib/server/guards';

/**
 * Everything under /dashboard/admin is operator-only, enforced server-side —
 * except the reference tables, which a data encoder also keeps. The allowlist
 * that decides which is which lives in `requireAdminArea`.
 */
export const load: LayoutServerLoad = async (event) => {
	requireAdminArea(event);
	return {};
};
