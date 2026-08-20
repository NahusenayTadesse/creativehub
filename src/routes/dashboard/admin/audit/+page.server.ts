import type { PageServerLoad } from './$types';
import { auditQuery } from '$lib/server/queries';

/**
 * The audit log is append-only; this page reads it and nothing writes here.
 *
 * It used to take the newest three hundred rows and stop, which quietly turned
 * the record of everything that happened into the record of the last few days.
 * It is paged now, and the entity chips are counted in the database rather than
 * gathered from whichever rows happened to be loaded.
 */
export const load: PageServerLoad = async ({ url }) => {
	const [entries, entityCounts] = await Promise.all([
		auditQuery.run(url),
		auditQuery.facet(url, 'entity')
	]);

	return { entries, entityCounts };
};
