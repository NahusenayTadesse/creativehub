/**
 * The browser's half of push: asking permission, and registering.
 *
 * Kept out of the component so the settings toggle reads as a toggle. Every
 * function here is browser-only and returns a plain result rather than
 * throwing: nothing about notifications is important enough to break a page
 * that was working.
 */

/** What the switch can be showing at any moment. */
export type PushState =
	/** No key pair configured, or this browser has no push at all. */
	| 'unavailable'
	/** The reader said no. Only they can undo it, in browser settings. */
	| 'denied'
	| 'subscribed'
	| 'unsubscribed';

/** Whether this browser could push at all, before anyone is asked anything. */
export const pushSupported = (): boolean =>
	typeof window !== 'undefined' &&
	'serviceWorker' in navigator &&
	'PushManager' in window &&
	'Notification' in window;

/**
 * A VAPID public key, as the `applicationServerKey` option wants it.
 *
 * The key travels as base64url and `PushManager.subscribe` takes bytes.
 * `atob` needs the padding the url-safe alphabet drops, and needs `-_` turned
 * back into `+/` — miss either and the call fails with an
 * `InvalidCharacterError` that says nothing about which.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
	const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
	const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));

	/*
	 * Backed by an explicit `ArrayBuffer`, not `Uint8Array.from`.
	 *
	 * `from` gives a `Uint8Array<ArrayBufferLike>`, and `ArrayBufferLike` admits
	 * `SharedArrayBuffer`, which `applicationServerKey` does not accept. Naming
	 * the buffer is what narrows it — the alternative is a cast that would go on
	 * being true by luck.
	 */
	const bytes = new Uint8Array(new ArrayBuffer(binary.length));
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

/** What this browser is doing right now, asking nobody anything. */
export async function currentPushState(vapidKey: string | null): Promise<PushState> {
	if (!vapidKey || !pushSupported()) return 'unavailable';
	if (Notification.permission === 'denied') return 'denied';

	const registration = await navigator.serviceWorker.getRegistration();
	const existing = await registration?.pushManager.getSubscription();
	return existing ? 'subscribed' : 'unsubscribed';
}

/**
 * Asks, subscribes, and tells the server.
 *
 * The permission prompt is only ever raised from here, which is only ever
 * called from a button: a site that asks on load is the reason browsers now
 * bury the prompt, and a refusal is permanent in a way nothing else on a
 * settings page is.
 */
export async function subscribeToPush(vapidKey: string): Promise<PushState> {
	if (!pushSupported()) return 'unavailable';

	const permission = await Notification.requestPermission();
	if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'unsubscribed';

	const registration = await navigator.serviceWorker.ready;
	const subscription =
		(await registration.pushManager.getSubscription()) ??
		(await registration.pushManager.subscribe({
			/* Required by every browser now: a subscription that may only be used
			   to show a visible notification, never to run code silently. */
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(vapidKey)
		}));

	const response = await fetch('/api/push', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(subscription.toJSON())
	});

	if (!response.ok) {
		/* The server would not record it, so this browser must not go on believing
		   it is subscribed — otherwise the switch says yes and nothing arrives. */
		await subscription.unsubscribe().catch(() => {});
		return 'unsubscribed';
	}

	return 'subscribed';
}

/** Unsubscribes this browser and forgets the row. */
export async function unsubscribeFromPush(): Promise<PushState> {
	const registration = await navigator.serviceWorker.getRegistration();
	const subscription = await registration?.pushManager.getSubscription();
	if (!subscription) return 'unsubscribed';

	const { endpoint } = subscription;
	await subscription.unsubscribe().catch(() => {});

	/* Told after the fact: the browser end is what actually stops notifications,
	   and a failed request here leaves a row the next send will clear as dead. */
	await fetch('/api/push', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ endpoint })
	}).catch(() => {});

	return 'unsubscribed';
}

/**
 * The number on the installed app's icon.
 *
 * Supported on installed apps on Chromium and on iOS 16.4+; everywhere else
 * the call simply is not there. Zero clears it rather than drawing a nought.
 */
export async function setAppBadge(count: number): Promise<void> {
	if (typeof navigator === 'undefined') return;
	try {
		if (count > 0 && 'setAppBadge' in navigator) await navigator.setAppBadge(count);
		else if ('clearAppBadge' in navigator) await navigator.clearAppBadge();
	} catch {
		/* Refused, or unsupported in this context. A badge is decoration. */
	}
}
