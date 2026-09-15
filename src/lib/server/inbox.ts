import { and, asc, count, desc, eq, gt, inArray, isNull, max, ne, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';

/**
 * What someone has not seen yet: their notifications, and the messages on
 * their deals.
 *
 * `notify()` has always written an in-app row beside every email, and nothing
 * ever read one back — so the rows piled up unread and the only copy anyone saw
 * was the email. This module is the reading half.
 */

/* ------------------------------------------------------------------ *
 * Notifications
 * ------------------------------------------------------------------ */

const live = (userId: string) =>
	and(eq(t.notifications.userId, userId), isNull(t.notifications.deletedAt));

export async function countUnreadNotifications(userId: string): Promise<number> {
	const rows = await db
		.select({ n: count() })
		.from(t.notifications)
		.where(and(live(userId), isNull(t.notifications.readAt)));
	return Number(rows[0]?.n ?? 0);
}

const notificationColumns = {
	id: t.notifications.id,
	title: t.notifications.title,
	body: t.notifications.body,
	link: t.notifications.link,
	kind: t.notifications.kind,
	readAt: t.notifications.readAt,
	createdAt: t.notifications.createdAt
};

export async function listNotifications(
	userId: string,
	options: { limit: number; offset?: number; unreadOnly?: boolean }
) {
	return db
		.select(notificationColumns)
		.from(t.notifications)
		.where(and(live(userId), options.unreadOnly ? isNull(t.notifications.readAt) : undefined))
		.orderBy(desc(t.notifications.createdAt), desc(t.notifications.id))
		.limit(options.limit)
		.offset(options.offset ?? 0);
}

export async function countNotifications(userId: string, unreadOnly = false): Promise<number> {
	const rows = await db
		.select({ n: count() })
		.from(t.notifications)
		.where(and(live(userId), unreadOnly ? isNull(t.notifications.readAt) : undefined));
	return Number(rows[0]?.n ?? 0);
}

/**
 * Marks one notification read and returns where it points.
 *
 * Scoped to the owner in the same statement, so an id from someone else's
 * inbox marks nothing and yields no link.
 */
export async function openNotification(userId: string, id: number): Promise<string | null> {
	const rows = await db
		.select({ link: t.notifications.link, readAt: t.notifications.readAt })
		.from(t.notifications)
		.where(and(live(userId), eq(t.notifications.id, id)))
		.limit(1);
	const row = rows.at(0);
	if (!row) return null;
	if (!row.readAt) {
		await db
			.update(t.notifications)
			.set({ readAt: new Date() })
			.where(and(live(userId), eq(t.notifications.id, id)));
	}
	return safeLink(row.link);
}

export async function markAllNotificationsRead(userId: string) {
	await db
		.update(t.notifications)
		.set({ readAt: new Date() })
		.where(and(live(userId), isNull(t.notifications.readAt)));
}

/**
 * Marks read whatever points at a page the reader is now looking at.
 *
 * Opening a deal is reading the "new message on your deal" notification; the
 * bell should not go on counting it after the reader has already acted on it.
 */
export async function markNotificationsReadForLink(userId: string, link: string) {
	await db
		.update(t.notifications)
		.set({ readAt: new Date() })
		.where(and(live(userId), isNull(t.notifications.readAt), eq(t.notifications.link, link)));
}

/**
 * A notification's link, only if it stays on this site.
 *
 * Links are written by the app, never by a user — but a redirect built from a
 * database value is the shape an open redirect takes, so the rule is enforced
 * where the redirect happens rather than trusted from where the row came from.
 */
export function safeLink(link: string | null | undefined): string | null {
	if (!link) return null;
	return link.startsWith('/') && !link.startsWith('//') && !link.startsWith('/\\') ? link : null;
}

/* ------------------------------------------------------------------ *
 * Messages on a deal
 * ------------------------------------------------------------------ */

/**
 * The reader has seen the thread as of now.
 *
 * "Now" is the database's clock, not this process's: unread is decided by
 * comparing this with `messages.created_at`, which the database stamps itself,
 * and two clocks — or one clock read through two time zones, as happens when
 * the database's session zone is not UTC — would make a message read a minute
 * ago count as unread for hours.
 */
export async function markBookingRead(userId: string, bookingId: number) {
	await db
		.insert(t.bookingReads)
		.values({ userId, bookingId, lastReadAt: sql`now(3)` })
		.onDuplicateKeyUpdate({
			/* Never backwards: a slow request finishing after a newer one must not
			   make messages the reader has already seen count as unread again. */
			set: {
				lastReadAt: sql`greatest(${t.bookingReads.lastReadAt}, values(${t.bookingReads.lastReadAt}))`
			}
		});
}

/**
 * Unread messages per deal, for the deals on one page of a listing.
 *
 * Someone else's message, sent after the reader last opened that deal — or at
 * any time, if they never have.
 */
export async function unreadMessageCounts(
	userId: string,
	bookingIds: number[]
): Promise<Record<number, number>> {
	if (!bookingIds.length) return {};
	const rows = await db
		.select({ bookingId: t.messages.bookingId, n: count() })
		.from(t.messages)
		.leftJoin(
			t.bookingReads,
			and(eq(t.bookingReads.bookingId, t.messages.bookingId), eq(t.bookingReads.userId, userId))
		)
		.where(
			and(
				inArray(t.messages.bookingId, bookingIds),
				ne(t.messages.senderId, userId),
				isNull(t.messages.deletedAt),
				sql`(${t.bookingReads.lastReadAt} is null or ${t.messages.createdAt} > ${t.bookingReads.lastReadAt})`
			)
		)
		.groupBy(t.messages.bookingId);
	return Object.fromEntries(rows.map((row) => [Number(row.bookingId), Number(row.n)]));
}

/** Messages on a deal newer than the last one the page already shows. */
export async function messagesAfter(bookingId: number, afterId: number) {
	return db
		.select({
			id: t.messages.id,
			body: t.messages.body,
			isMasked: t.messages.isMasked,
			createdAt: t.messages.createdAt,
			senderId: t.messages.senderId,
			senderName: t.user.name
		})
		.from(t.messages)
		.leftJoin(t.user, eq(t.user.id, t.messages.senderId))
		.where(
			and(
				eq(t.messages.bookingId, bookingId),
				gt(t.messages.id, afterId),
				isNull(t.messages.deletedAt)
			)
		)
		.orderBy(asc(t.messages.createdAt), asc(t.messages.id))
		.limit(100);
}

/**
 * A fingerprint of everything on a deal besides its messages.
 *
 * The page compares the one it loaded with the one the thread endpoint reports,
 * and offers a refresh when they differ. The booking's own `updated_at` covers
 * status changes, cancellations and funding; a counter-offer or a submission
 * from the other side is a new row elsewhere, so the newest of each is part of
 * it too.
 */
export async function dealVersion(bookingId: number, updatedAt: Date): Promise<string> {
	const [proposal, submission] = await Promise.all([
		db
			.select({ id: max(t.termProposals.id) })
			.from(t.termProposals)
			.where(eq(t.termProposals.bookingId, bookingId)),
		db
			.select({ id: max(t.submissions.id) })
			.from(t.submissions)
			.where(eq(t.submissions.bookingId, bookingId))
	]);
	return `${updatedAt.getTime()}:${proposal[0]?.id ?? 0}:${submission[0]?.id ?? 0}`;
}
