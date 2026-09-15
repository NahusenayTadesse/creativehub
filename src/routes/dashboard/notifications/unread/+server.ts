import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/guards';
import { countUnreadNotifications } from '$lib/server/inbox';

/**
 * The bell's count, for the header to ask every minute while a tab is open.
 *
 * The number only — the list is loaded with the page. `no-store`, because a
 * shared cache answering one account's count to another would be exactly the
 * kind of leak a per-user endpoint exists to avoid.
 */
export const GET: RequestHandler = async (event) => {
	const user = requireUser(event);
	return json(
		{ unread: await countUnreadNotifications(user.id) },
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
