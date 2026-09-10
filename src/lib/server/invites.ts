import * as m from '$lib/paraglide/messages';
import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { db, rowsAffected } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { absoluteUrl } from '$lib/server/urls';
import { sendSecurityMail } from '$lib/server/notify';
import type { StaffRole } from '$lib/roles';

/**
 * Staff invitations.
 *
 * Operators and data encoders are the two roles the sign-up form will not sell:
 * `registerSchema` permits creator and business only, and the users page can
 * change the role of an account that already exists. Neither of those gets a
 * *new* colleague in. This does — an address, a role, and one link that is the
 * only way to turn the pair into an account.
 *
 * The link is the whole security boundary, so the rules around it are the ones
 * that matter: it is long enough not to be guessed, stored only as a hash, good
 * for one use, and dead after a week. Everything else here is bookkeeping.
 */

/**
 * How long a link lives.
 *
 * A week rather than the hour a password reset gets. A reset is answering
 * somebody who is sitting at the screen right now; an invitation lands in the
 * inbox of a person who did not ask for it and may be away, and an operator
 * re-issuing invites all month because the first one went stale is an operator
 * who stops reading what they are clicking.
 */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** The one form of the address anything here compares or stores. */
export const normaliseEmail = (email: string) => email.trim().toLowerCase();

/**
 * The token, and what is kept of it.
 *
 * 32 bytes from the system generator, rendered base64url so it survives a path
 * segment untouched. Only the digest is written down: a reader of this table —
 * a backup, a support query, a `SELECT *` in a terminal — holds nothing that
 * opens an account.
 */
const mintToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Where the mail points. The token is the path, so a stale tab still posts it. */
export const inviteUrl = (token: string) => absoluteUrl(`/invite/${token}`);

/**
 * Addresses that are part-way through accepting an invitation.
 *
 * The accept page creates the account with better-auth's ordinary sign-up,
 * which sends a "confirm your address" mail on the way past. For an invitee
 * that message is noise: they are here *because* they opened a link in that
 * inbox, and the account is marked verified a moment later for the same reason.
 * `auth.ts` asks this before sending, and the entry is spent on the first ask.
 *
 * In memory, so it is per process — which is all it needs to be, since the only
 * thing that reads it is the sign-up running inside the same request.
 */
const acceptingSignUps = new Set<string>();

export const markInviteSignUp = (email: string) => acceptingSignUps.add(normaliseEmail(email));
export const clearInviteSignUp = (email: string) => acceptingSignUps.delete(normaliseEmail(email));
/** True once, for an address that is mid-acceptance. */
export const consumeInviteSignUp = (email: string) =>
	acceptingSignUps.delete(normaliseEmail(email));

export type StaffInvite = typeof t.staffInvites.$inferSelect;

/** Live means: issued, not spent, not withdrawn, not yet stale. */
const liveInvite = () =>
	and(
		isNull(t.staffInvites.acceptedAt),
		isNull(t.staffInvites.revokedAt),
		gt(t.staffInvites.expiresAt, new Date())
	);

/** Every invitation still worth showing an operator, newest first. */
export async function listLiveInvites(): Promise<StaffInvite[]> {
	return db.select().from(t.staffInvites).where(liveInvite()).orderBy(desc(t.staffInvites.id));
}

/**
 * The invitation a link refers to, if it still stands.
 *
 * A spent, withdrawn or expired token is indistinguishable from a wrong one
 * here on purpose: all four are "this link does not work", and the page says so
 * without telling a stranger which of the four they have found.
 */
export async function findLiveInvite(token: string): Promise<StaffInvite | undefined> {
	if (!token) return undefined;
	const rows = await db
		.select()
		.from(t.staffInvites)
		.where(and(eq(t.staffInvites.tokenHash, hashToken(token)), liveInvite()))
		.limit(1);
	return rows.at(0);
}

/**
 * Issues one, replacing whatever that address was holding.
 *
 * Re-inviting is how an operator resends: the previous link is withdrawn in the
 * same breath, so an address never has two working links and the one that was
 * forwarded, quoted or left in an old mail thread stops being an account.
 */
export async function createInvite(input: {
	email: string;
	role: StaffRole;
	invitedBy: string;
}): Promise<{ token: string; expiresAt: Date }> {
	const email = normaliseEmail(input.email);
	const token = mintToken();
	const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

	await db
		.update(t.staffInvites)
		.set({ revokedAt: new Date() })
		.where(and(eq(t.staffInvites.email, email), liveInvite()));

	await db.insert(t.staffInvites).values({
		email,
		role: input.role,
		tokenHash: hashToken(token),
		expiresAt,
		invitedBy: input.invitedBy
	});

	return { token, expiresAt };
}

/** Withdraws one. The row stays; only the link stops working. */
export async function revokeInvite(inviteId: number): Promise<StaffInvite | undefined> {
	const rows = await db
		.select()
		.from(t.staffInvites)
		.where(and(eq(t.staffInvites.id, inviteId), liveInvite()))
		.limit(1);
	const invite = rows.at(0);
	if (!invite) return undefined;

	await db
		.update(t.staffInvites)
		.set({ revokedAt: new Date() })
		.where(eq(t.staffInvites.id, invite.id));

	return invite;
}

/**
 * Spends one.
 *
 * The `acceptedAt is null` in the where clause is the guard, not the read that
 * preceded it: two tabs submitting the invite form at the same moment both pass
 * `findLiveInvite`, and only the one whose UPDATE changes a row may go on to
 * create the account.
 */
export async function claimInvite(inviteId: number): Promise<boolean> {
	const result = await db
		.update(t.staffInvites)
		.set({ acceptedAt: new Date() })
		.where(and(eq(t.staffInvites.id, inviteId), liveInvite()));

	/* Nothing changed means somebody else got there first. */
	return rowsAffected(result) > 0;
}

/** Records which account the invitation produced. */
export async function attachInviteUser(inviteId: number, userId: string): Promise<void> {
	await db
		.update(t.staffInvites)
		.set({ acceptedUserId: userId })
		.where(eq(t.staffInvites.id, inviteId));
}

/** Puts a spent invitation back, when the account it was spent on never appeared. */
export async function releaseInvite(inviteId: number): Promise<void> {
	await db.update(t.staffInvites).set({ acceptedAt: null }).where(eq(t.staffInvites.id, inviteId));
}

/** What the role is called in a sentence. Lazy: the locale is per request. */
export const staffRoleLabel = (role: string) =>
	role === 'admin' ? m.au_role_operator() : m.au_role_encoder();

/**
 * Sends the link.
 *
 * Security mail, so it goes out whatever anybody's notification preferences
 * say — there is no account yet to hold preferences, and no in-app copy to
 * fall back on. Awaited, so the page can tell the operator that the message
 * left rather than only that a row was written.
 */
export async function sendInviteMail(invite: {
	email: string;
	role: string;
	token: string;
	invitedByName: string;
}): Promise<boolean> {
	return sendSecurityMail(invite.email, {
		subject: m.mail_invite_subject(),
		body: [
			m.mail_invite_body({
				inviter: invite.invitedByName,
				role: staffRoleLabel(invite.role)
			}),
			m.mail_invite_next()
		],
		action: { label: m.mail_invite_action(), url: inviteUrl(invite.token) },
		footnote: m.mail_invite_footnote()
	});
}
