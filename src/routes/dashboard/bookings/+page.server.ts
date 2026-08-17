import type { PageServerLoad } from './$types';
import { listBookings } from '$lib/server/queries';

export const load: PageServerLoad = async ({ parent }) => {
	const { role, creator, organization } = await parent();

	const bookings = await listBookings(
		role === 'admin'
			? {}
			: creator
				? { creatorId: creator.id }
				: organization
					? { organizationId: organization.id }
					: { creatorId: -1 }
	);

	return { bookings };
};
