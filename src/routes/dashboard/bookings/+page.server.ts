import type { PageServerLoad } from './$types';
import { listBookings, bookingFacet } from '$lib/server/queries';

export const load: PageServerLoad = async ({ url, parent }) => {
	const { role, creator, organization } = await parent();

	/* Whose deals these are is settled here, from the session, and passed to the
	   query as a scope the URL cannot reach. */
	const scope = { role, creatorId: creator?.id, organizationId: organization?.id };

	const [bookings, tabCounts] = await Promise.all([
		listBookings(url, scope),
		bookingFacet(url, 'tab', scope)
	]);

	return { bookings, tabCounts };
};
