import { eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { shouldNotify, type NotifyCategory, type Preferences } from '$lib/domain/notify';
import { sendMail, absoluteUrl, type MailContent } from '$lib/server/mail';

/**
 * Telling somebody something.
 *
 * The two channels used to be separate — a hand-written `db.insert(notifications)`
 * at each call site, and no mail at all — which meant the preferences page was
 * describing a policy nothing consulted. This is the one door both go through:
 * `domain/notify.ts` decides who gets what, this decides how it is delivered,
 * and the call site says only what happened.
 *
 * Mail is never awaited. The action that triggered it has already succeeded and
 * the in-app notification is the durable record; a slow or dead SMTP server
 * should cost nobody their form submission.
 */

/** What the caller describes: an event, and where to look at it. */
export type Notification = {
	/** Which preference governs this — see `domain/notify.ts`. */
	category: NotifyCategory;
	/** The `notifications.kind` column: how the interface groups the row. */
	kind: string;
	title: string;
	body?: string | null;
	/** Site-relative. Stored as-is for the app, made absolute for the mail. */
	link?: string | null;
	/** The button in the email. Defaults to a generic "open" label if omitted. */
	actionLabel?: string;
	/** Small print in the email — why this arrived. */
	footnote?: string;
	/** Who caused it, for the audit columns. */
	actorId?: string | null;
};

type RecipientRow = {
	id: string;
	email: string;
	name: string;
	prefs: Preferences | null;
};

/**
 * The site name, read once.
 *
 * It appears in the header and footer of every message. Re-reading `site_settings`
 * for each one would be a query per recipient per event, to render a string that
 * changes about once in the life of the deployment.
 */
let siteNamePromise: Promise<string> | null = null;
function getSiteName(): Promise<string> {
	siteNamePromise ??= db
		.select({ siteName: t.siteSettings.siteName })
		.from(t.siteSettings)
		.limit(1)
		.then((rows) => rows.at(0)?.siteName ?? 'Creator Network')
		.catch(() => 'Creator Network');
	return siteNamePromise;
}

/**
 * Addresses and preferences for the people being told.
 *
 * A left join, because a missing `user_settings` row is the common case and
 * means `DEFAULT_PREFERENCES` rather than "no preferences" — writing a row at
 * sign-up purely so this query could be an inner join is exactly the repair the
 * schema is designed not to need.
 */
async function loadRecipients(userIds: string[]): Promise<RecipientRow[]> {
	if (!userIds.length) return [];

	const rows = await db
		.select({
			id: t.user.id,
			email: t.user.email,
			name: t.user.name,
			dealsEmail: t.userSettings.dealsEmail,
			dealsApp: t.userSettings.dealsApp,
			messagesEmail: t.userSettings.messagesEmail,
			messagesApp: t.userSettings.messagesApp,
			accountEmail: t.userSettings.accountEmail,
			productEmail: t.userSettings.productEmail
		})
		.from(t.user)
		.leftJoin(t.userSettings, eq(t.userSettings.userId, t.user.id))
		.where(inArray(t.user.id, userIds));

	return rows.map((r) => ({
		id: r.id,
		email: r.email,
		name: r.name,
		prefs:
			r.dealsEmail === null
				? null
				: {
						dealsEmail: r.dealsEmail,
						dealsApp: r.dealsApp!,
						messagesEmail: r.messagesEmail!,
						messagesApp: r.messagesApp!,
						accountEmail: r.accountEmail!,
						productEmail: r.productEmail!
					}
	}));
}

/**
 * Tells one or more people that something happened.
 *
 * Ids that are null, undefined or duplicated are dropped rather than refused:
 * call sites reach for `creator.userId` and `organization.ownerId`, either of
 * which can legitimately be absent — an unclaimed creator profile has no
 * account to write to — and making every one of them check first would put the
 * same `if` in a dozen places.
 */
export async function notify(
	userIds: (string | null | undefined)[] | string | null | undefined,
	event: Notification
): Promise<void> {
	const ids = [
		...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean))
	] as string[];
	if (!ids.length) return;

	const recipients = await loadRecipients(ids);
	if (!recipients.length) return;

	const wantsApp = recipients.filter((r) => shouldNotify(r.prefs, event.category, 'app'));
	const wantsEmail = recipients.filter(
		(r) => r.email && shouldNotify(r.prefs, event.category, 'email')
	);

	/* One statement for the whole audience — these fan out to both sides of a
	   booking, and to every admin for an account decision. */
	if (wantsApp.length) {
		await db.insert(t.notifications).values(
			wantsApp.map((r) => ({
				userId: r.id,
				title: event.title,
				body: event.body ?? null,
				link: event.link ?? null,
				kind: event.kind,
				createdBy: event.actorId ?? null
			}))
		);
	}

	if (!wantsEmail.length) return;

	/* Detached on purpose — see the note at the top of the file. `sendMail`
	   resolves rather than rejects, so there is no unhandled rejection to catch;
	   the `void` is what says the omission is deliberate. */
	void getSiteName().then((siteName) => {
		for (const r of wantsEmail) {
			void sendMail(
				r.email,
				{
					subject: event.title,
					body: event.body ? [event.body] : [],
					action:
						event.link && event.actionLabel
							? { label: event.actionLabel, url: absoluteUrl(event.link) }
							: undefined,
					footnote: event.footnote
				},
				siteName
			);
		}
	});
}

/**
 * Mail that is sent whatever anyone has chosen.
 *
 * Password resets, address confirmations, a warning about the account itself.
 * These do not consult `user_settings` and do not write an in-app row — the
 * recipient may well be locked out of the interface that would show it, which
 * is the whole reason the message exists.
 *
 * Awaited, unlike `notify`: here the send *is* the action. A reader who is told
 * "check your email" when nothing was sent has no way to find that out, and
 * unlike a booking notification there is no second copy waiting in the app.
 */
export async function sendSecurityMail(to: string, content: MailContent): Promise<boolean> {
	return sendMail(to, content, await getSiteName());
}
