import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { requireUser } from '$lib/server/guards';
import { pushConfigured, removeSubscription, saveSubscription } from '$lib/server/push';

/**
 * Where a browser registers itself for push, and takes itself off again.
 *
 * Behind `requireUser` because a subscription belongs to an account: the whole
 * point is to reach a particular person, and an open endpoint that stores
 * arbitrary push endpoints against arbitrary users is a way to send
 * notifications as this site to anybody who has ever visited it.
 *
 * Under `/api/`, which the service worker never touches — see `NEVER_CACHE` in
 * `src/service-worker.ts`. A cached answer here would be a browser that thinks
 * it is subscribed when the row was never written.
 */

/** The shape `PushSubscription.toJSON()` produces. Nothing here is trusted. */
type Body = {
	endpoint?: unknown;
	keys?: { p256dh?: unknown; auth?: unknown };
};

/** A push endpoint is a URL from the browser's own push service, and nothing else. */
function readSubscription(body: Body) {
	const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
	const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh : '';
	const auth = typeof body.keys?.auth === 'string' ? body.keys.auth : '';

	if (!endpoint || !p256dh || !auth) return null;
	/* `varchar(500)`, and a URL — anything longer or otherwise shaped is not
	   something a push service issued. */
	if (endpoint.length > 500 || !/^https:\/\//.test(endpoint)) return null;
	if (p256dh.length > 255 || auth.length > 255) return null;

	return { endpoint, keys: { p256dh, auth } };
}

export const POST: RequestHandler = async (event) => {
	const user = requireUser(event);
	/* Nothing to register against without a key pair to sign with. */
	if (!pushConfigured()) error(503, 'push is not configured');

	const body = (await event.request.json().catch(() => null)) as Body | null;
	if (!body) error(400, 'expected a subscription');

	const subscription = readSubscription(body);
	if (!subscription) error(400, 'that is not a push subscription');

	await saveSubscription(db, user.id, subscription, event.request.headers.get('user-agent'));

	return json({ ok: true });
};

/**
 * Takes this browser off the list.
 *
 * `DELETE` rather than a second POST route, because that is what it is — and
 * the body carries only the endpoint, since the keys are irrelevant to
 * forgetting something.
 */
export const DELETE: RequestHandler = async (event) => {
	const user = requireUser(event);

	const body = (await event.request.json().catch(() => null)) as Body | null;
	const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
	if (!endpoint) error(400, 'expected an endpoint');

	await removeSubscription(db, user.id, endpoint);
	return json({ ok: true });
};
