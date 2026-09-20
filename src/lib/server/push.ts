/**
 * Putting a notification on somebody's lock screen.
 *
 * The third channel beside the in-app row and the email, and the one that makes
 * an installed app behave like an app: a creator learns that a brand has
 * proposed a booking without having opened the site. Everything about who wants
 * what is decided in `notify.ts` — this only knows how to deliver.
 *
 * ## Unconfigured is a supported state
 *
 * Without a VAPID key pair there is nothing to sign with, so `pushConfigured()`
 * is false, the settings page does not offer the switch, and `sendPush` returns
 * having done nothing. The same shape as `tiktokCredentials()`: a missing key
 * is a feature that is off, not a crash.
 *
 * Generate a pair once with `npm run push:keys` and put them in `.env`. They
 * are an identity, not a rotation-friendly secret: changing them invalidates
 * every existing subscription, because a push service ties the subscription it
 * issued to the public key that asked for it. That is why they are not derived
 * from anything else.
 *
 * ## Dead subscriptions
 *
 * A push service answers 404 or 410 once a browser's subscription is gone for
 * good. That is the only reliable signal that a row is dead, so it is the only
 * one acted on — those rows are deleted. A 429 or a 5xx is the service having a
 * bad day and the row is left exactly where it is.
 */
import webpush from 'web-push';
import { and, eq, inArray } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import * as t from './db/schema';
import type { Database } from './db/rollups';

export type PushKeys = { publicKey: string; privateKey: string; subject: string };

/** The configured key pair, or null when the app has none. */
export function pushKeys(): PushKeys | null {
	const publicKey = (env.VAPID_PUBLIC_KEY ?? '').trim();
	const privateKey = (env.VAPID_PRIVATE_KEY ?? '').trim();
	if (!publicKey || !privateKey) return null;
	/*
	 * The subject is a contact address a push service can reach us at if our
	 * traffic becomes a problem for them. It is required by the spec, so there
	 * is a fallback rather than a refusal.
	 */
	const subject = (env.VAPID_SUBJECT ?? '').trim() || 'mailto:support@influencerethiopia.com';
	return { publicKey, privateKey, subject };
}

export const pushConfigured = (): boolean => pushKeys() !== null;

/** What the browser needs to subscribe. Public by design — it is in every payload. */
export const vapidPublicKey = (): string | null => pushKeys()?.publicKey ?? null;

/** What the service worker's `push` handler expects to parse. */
export type PushPayload = {
	title: string;
	body?: string;
	/** Where a tap should land. A path on this site, never an absolute URL. */
	url?: string;
	/**
	 * Collapses notifications: a second one with the same tag replaces the first
	 * rather than stacking. Keyed per conversation so a busy thread is one line
	 * on the lock screen instead of forty.
	 */
	tag?: string;
	/** The count to draw on the app icon, for the Badging API. */
	badge?: number;
};

export type StoredSubscription = {
	endpoint: string;
	keys: { p256dh: string; auth: string };
};

/**
 * Records a browser's subscription, or refreshes the one it already had.
 *
 * An upsert on `endpoint`: re-subscribing in the same browser returns the same
 * endpoint with possibly new keys, and inserting again would leave two rows
 * racing to notify one device. The unique index is what makes it one row; the
 * `userId` is overwritten too, because the same browser can be signed in as
 * somebody else after a sign-out.
 */
export async function saveSubscription(
	db: Database,
	userId: string,
	subscription: StoredSubscription,
	userAgent: string | null
): Promise<void> {
	const row = {
		userId,
		endpoint: subscription.endpoint,
		p256dh: subscription.keys.p256dh,
		auth: subscription.keys.auth,
		userAgent: userAgent?.slice(0, 255) ?? null,
		lastSeenAt: new Date()
	};

	await db
		.insert(t.pushSubscriptions)
		.values(row)
		.onDuplicateKeyUpdate({
			set: {
				userId: row.userId,
				p256dh: row.p256dh,
				auth: row.auth,
				userAgent: row.userAgent,
				lastSeenAt: row.lastSeenAt
			}
		});
}

/**
 * Forgets one browser.
 *
 * Scoped to the signed-in user as well as the endpoint: an endpoint is not a
 * secret, and unsubscribing somebody else's device on the strength of a string
 * posted to us is not something this should be able to do.
 */
export async function removeSubscription(
	db: Database,
	userId: string,
	endpoint: string
): Promise<void> {
	await db
		.delete(t.pushSubscriptions)
		.where(and(eq(t.pushSubscriptions.endpoint, endpoint), eq(t.pushSubscriptions.userId, userId)));
}

/** Gone for good, as opposed to a service having a bad day. */
const isDead = (status: number | undefined) => status === 404 || status === 410;

/**
 * Sends one payload to every browser these people have registered.
 *
 * Never throws and never blocks a caller that is in the middle of something
 * else: a push that fails is a notification the recipient still has in the app
 * and, usually, in their email. Every send is attempted even if others fail,
 * and the dead endpoints are cleared afterwards in one statement.
 */
export async function sendPush(
	db: Database,
	userIds: string[],
	payload: PushPayload
): Promise<{ sent: number; removed: number }> {
	const keys = pushKeys();
	if (!keys || !userIds.length) return { sent: 0, removed: 0 };

	const rows = await db
		.select({
			id: t.pushSubscriptions.id,
			endpoint: t.pushSubscriptions.endpoint,
			p256dh: t.pushSubscriptions.p256dh,
			auth: t.pushSubscriptions.auth
		})
		.from(t.pushSubscriptions)
		.where(inArray(t.pushSubscriptions.userId, userIds));

	if (!rows.length) return { sent: 0, removed: 0 };

	webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);

	const body = JSON.stringify(payload);
	const dead: number[] = [];
	let sent = 0;

	await Promise.all(
		rows.map(async (row) => {
			try {
				await webpush.sendNotification(
					{ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
					body,
					/* Long enough to survive a phone that is asleep, short enough that a
					   notification never arrives describing something long finished. */
					{ TTL: 12 * 60 * 60 }
				);
				sent++;
			} catch (err) {
				const status = (err as { statusCode?: number })?.statusCode;
				if (isDead(status)) dead.push(row.id);
				else
					console.warn(`[push] send failed (${status ?? 'no status'}) for subscription ${row.id}`);
			}
		})
	);

	if (dead.length) {
		await db.delete(t.pushSubscriptions).where(inArray(t.pushSubscriptions.id, dead));
	}

	return { sent, removed: dead.length };
}
