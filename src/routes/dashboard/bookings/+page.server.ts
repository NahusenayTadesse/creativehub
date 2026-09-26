import type { PageServerLoad } from './$types';
import { listBookings, bookingFacet } from '$lib/server/queries';
import { requireUser } from '$lib/server/guards';
import { unreadMessageCounts } from '$lib/server/inbox';
import { maskBookings } from '$lib/server/nda';

export const load: PageServerLoad = async (event) => {
	const { url, parent } = event;
	const user = requireUser(event);
	const { role, creator, organization } = await parent();

	/* Whose deals these are is settled here, from the session, and passed to the
	   query as a scope the URL cannot reach. */
	const scope = { role, creatorId: creator?.id, organizationId: organization?.id };

	const [page, tabCounts] = await Promise.all([
		listBookings(url, scope),
		bookingFacet(url, 'tab', scope)
	]);
	/* A creator sees a brand's name only once they have accepted its NDA. */
	const bookings = { ...page, rows: await maskBookings(user, page.rows) };

	/* Counted for this page of deals only — the listing is paged, and a count
	   per deal is only worth having next to a deal on screen. */
	const unread = await unreadMessageCounts(
		user.id,
		bookings.rows.map((booking) => booking.id)
	);

	return { bookings, tabCounts, unread };
};
