import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as m from '$lib/paraglide/messages';
import { requireBookingAccess } from '$lib/server/guards';
import {
	dealVersion,
	markBookingRead,
	markNotificationsReadForLink,
	messagesAfter
} from '$lib/server/inbox';

/**
 * What the deal page asks while it is open: anything new since it loaded.
 *
 * Messages newer than the last one on screen, and a fingerprint of the rest of
 * the deal (`dealVersion`), so the page can say "this deal has moved on" without
 * reloading itself. A reload would re-run every form on the page and throw away a
 * half-written counter-offer, which is why the page asks here instead.
 *
 * Asking counts as reading: the page only asks while it is visible.
 */
export const GET: RequestHandler = async (event) => {
	const id = Number(event.params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, m.srv_booking_not_found());

	const { user, booking } = await requireBookingAccess(event, id);
	const after = Math.max(0, Math.floor(Number(event.url.searchParams.get('after')) || 0));

	const [messages, version] = await Promise.all([
		messagesAfter(id, after),
		dealVersion(id, booking.updatedAt)
	]);
	if (messages.length) {
		await Promise.all([
			markBookingRead(user.id, id),
			markNotificationsReadForLink(user.id, `/dashboard/bookings/${id}`)
		]);
	}

	return json({ messages, version }, { headers: { 'cache-control': 'private, no-store' } });
};
