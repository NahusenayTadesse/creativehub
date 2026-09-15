import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { requireUser } from '$lib/server/guards';
import {
	countNotifications,
	listNotifications,
	markAllNotificationsRead,
	openNotification
} from '$lib/server/inbox';

const PER_PAGE = 20;

/**
 * Everything the app has told this account, newest first.
 *
 * The same rows the emails were sent from. Filtering to unread is a query
 * parameter, so the tab survives a reload and the back button.
 */
export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const unreadOnly = event.url.searchParams.get('show') === 'unread';
	const page = Math.max(1, Math.floor(Number(event.url.searchParams.get('page')) || 1));

	const [items, total, unread] = await Promise.all([
		listNotifications(user.id, { limit: PER_PAGE, offset: (page - 1) * PER_PAGE, unreadOnly }),
		countNotifications(user.id, unreadOnly),
		countNotifications(user.id, true)
	]);

	return {
		items,
		unreadOnly,
		page,
		pageCount: Math.max(1, Math.ceil(total / PER_PAGE)),
		total,
		unread
	};
};

export const actions: Actions = {
	/*
	 * Opening one: mark it read, then go where it points. A POST rather than a
	 * link with a side effect, so a crawler or a link preview can never mark
	 * anything read. Posted from the bell on any dashboard page as well as from
	 * this one.
	 */
	open: async (event) => {
		const user = requireUser(event);
		const data = await event.request.formData();
		const link = await openNotification(user.id, Number(data.get('id')));
		redirect(303, link ?? '/dashboard/notifications');
	},

	readAll: async (event) => {
		const user = requireUser(event);
		await markAllNotificationsRead(user.id);
		return { readAll: true };
	}
};
