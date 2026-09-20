/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

/**
 * What makes the site behave like an installed app on a bad connection.
 *
 * ## What it caches, and the one rule it is built around
 *
 * **No HTML is ever stored.** Every page this app serves is written for the
 * person asking for it: the header knows their name, the sidebar knows their
 * role, and half the routes are a creator's own bookings or an operator's
 * queues. A cached page is a page that can be handed to the next person to open
 * the browser, or to the same person after they sign out, and no amount of
 * cache-busting makes that safe.
 *
 * **And almost nothing else is stored either.** What is kept is the shell that
 * has to exist when the network does not: the offline page, and the icons and
 * manifest it names. Four files.
 *
 * The build's hashed Javascript and CSS are deliberately *not* precached,
 * though they are the obvious candidate. SvelteKit already serves them
 * `immutable` with a year's lifetime, so the browser's own HTTP cache makes a
 * repeat visit fast without a second copy — and precaching them means fetching
 * every one with `cache: 'reload'`, which bypasses that cache by definition.
 * Measured against production that was 285 requests on install, and the worker
 * was still installing eight seconds later on a good connection. On a phone on
 * mobile data it is a long wait and somebody's data, spent again on every
 * deploy, for a copy of files the browser already had.
 *
 * Nor `files`, which is the whole of `static/`: that is two megabytes of hero
 * artwork and launch images nobody needs before they have asked for them.
 *
 * ## What it does with everything else
 *
 * Passes it through. A navigation goes to the network and falls back to the
 * offline page only when the network is not there; an upload, an API call, a
 * form post and anything under `/files/private/` are not touched at all. The
 * worker is a way to survive a dropped connection, not a second copy of the
 * site.
 *
 * ## Updating
 *
 * `version` changes on every build, so each deploy opens a new cache, fills it,
 * and deletes every older one on activation. A new worker then takes over at
 * once — `skipWaiting` on install, `clients.claim` on activate — and nobody is
 * asked about it.
 *
 * It was the other way round while this precached the build. Handing a page
 * rendered by one build a worker serving another build's assets is how a
 * half-updated app throws chunk-loading errors, so the new worker waited and a
 * toast offered a reload. Cutting the precache to the four shell files removed
 * that hazard entirely: this worker no longer serves a single versioned asset
 * from cache — build output goes straight to the network — so which worker is
 * in charge cannot affect a page that is already open.
 *
 * Waiting had a cost, and it was not hypothetical. Measured on production: a
 * second worker installed a second after the first claimed the page, reached
 * `installed`, and stayed there because the page it would replace was still
 * open — one cache and one script URL between the two, so the same build twice.
 * Every load after the first then announced a "new version" that was nothing of
 * the sort, and the reload button could not clear it.
 */
import { version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `assets-${version}`;

/**
 * Everything the worker keeps: the offline page and what it draws.
 *
 * Four files, so an install is four requests and finishes before anybody
 * notices. See the note above for why the build's assets are not here.
 */
const PRECACHE = ['/offline.html', '/manifest.webmanifest', '/icons/icon-192.png', '/favicon.png'];

worker.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			/*
			 * Added one at a time rather than with `addAll`, which rejects the whole
			 * batch if a single request fails. One missing icon should not be the
			 * reason the worker never installs and the offline page never exists.
			 */
			await Promise.all(
				PRECACHE.map(async (path) => {
					try {
						await cache.add(new Request(path, { cache: 'reload' }));
					} catch {
						/* Logged nowhere on purpose: this runs without a page to tell. */
					}
				})
			);

			/* Take over now rather than queue behind the open page — safe for the
			   reason in the note above, and what stops a duplicate worker parking
			   itself in `waiting` forever. */
			await worker.skipWaiting();
		})()
	);
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await worker.clients.claim();
		})()
	);
});

/**
 * A push has arrived.
 *
 * The payload is written by `$lib/server/push.ts` and arrives encrypted to this
 * browser's own keys, so nothing else can have put it here — but it is still
 * parsed defensively, because a worker that throws inside this handler shows
 * the browser's own "This site has been updated in the background" notification
 * instead, which is worse than anything this could say.
 *
 * `waitUntil` is not optional: the browser kills the worker as soon as the
 * handler returns, and a notification that has not been shown by then never
 * appears.
 */
worker.addEventListener('push', (event) => {
	event.waitUntil(
		(async () => {
			let payload: {
				title?: string;
				body?: string;
				url?: string;
				tag?: string;
				badge?: number;
			} = {};
			try {
				payload = event.data ? event.data.json() : {};
			} catch {
				/* Not JSON. Falls through to the generic title below. */
			}

			const title = payload.title || 'Influencer Ethiopia';

			try {
				await worker.registration.showNotification(title, {
					body: payload.body,
					icon: '/icons/icon-192.png',
					badge: '/icons/icon-192.png',
					/* Same tag replaces rather than stacks — see `PushPayload.tag`. */
					tag: payload.tag,
					/* The URL travels here because `notificationclick` gets the
					   notification back and nothing else. */
					data: { url: payload.url ?? '/dashboard' }
				});
			} catch {
				/*
				 * Throws when the permission has been revoked since the subscription
				 * was made — the browser then shows its own "updated in the
				 * background" notice, which is the platform's business and not
				 * something this can prevent. What it can avoid is rejecting inside
				 * `waitUntil`, which is an unhandled rejection in a context that has
				 * no page to report it to.
				 */
			}

			/* The count on the installed app's icon, where the platform draws one. */
			if (typeof payload.badge === 'number' && 'setAppBadge' in navigator) {
				await navigator.setAppBadge(payload.badge).catch(() => {});
			}
		})()
	);
});

/**
 * A notification was tapped.
 *
 * Focuses a tab that is already open on this site rather than opening a second
 * one — an app does not start a new copy of itself because you tapped a
 * notification — and navigates it to where the notification pointed.
 */
worker.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = (event.notification.data as { url?: string })?.url ?? '/dashboard';

	event.waitUntil(
		(async () => {
			const clients = await worker.clients.matchAll({
				type: 'window',
				includeUncontrolled: true
			});

			for (const client of clients) {
				if (new URL(client.url).origin !== location.origin) continue;
				await client.focus();
				/* `navigate` is refused on a client this worker does not control; the
				   focus above is already the important half. */
				await client.navigate(target).catch(() => {});
				return;
			}

			await worker.clients.openWindow(target);
		})()
	);
});

/** Paths that must always reach the server, whatever else is true. */
const NEVER_CACHE = ['/api/', '/files/private/', '/logout', '/health'];

const precached = new Set(PRECACHE);

worker.addEventListener('fetch', (event) => {
	const { request } = event;

	/* A POST is an action, not a resource. Range requests are partial by
	   definition and the Cache API cannot answer them correctly. */
	if (request.method !== 'GET' || request.headers.has('range')) return;

	const url = new URL(request.url);
	if (url.origin !== location.origin) return;
	if (NEVER_CACHE.some((path) => url.pathname.startsWith(path))) return;

	/*
	 * The shell: the cache is authoritative.
	 *
	 * These four are fetched from the network on install and are not expected to
	 * change within a version, so a hit is the right bytes.
	 */
	if (precached.has(url.pathname)) {
		event.respondWith((async () => (await caches.match(url.pathname)) ?? fetch(request))());
		return;
	}

	/*
	 * A page. Always from the network, because it is written for whoever is
	 * signed in — see the note at the top. The cache is reached for only when
	 * the network is not there at all, and what it answers with is the offline
	 * page rather than a stale copy of what was asked for.
	 */
	if (request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					return await fetch(request);
				} catch {
					return (
						(await caches.match('/offline.html')) ??
						new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
					);
				}
			})()
		);
		return;
	}

	/* Everything else — uploaded images, fonts, anything not precached — is left
	   to the browser's own HTTP cache, which already knows what the server said
	   about how long to keep it. */
});
