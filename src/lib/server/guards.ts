import * as m from '$lib/paraglide/messages';
import { error, redirect } from '@sveltejs/kit';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import type { Role } from '$lib/server/auth';

/**
 * The `?next=` destination, if it is somewhere on this site.
 *
 * The parameter is attacker-controlled, and it is consumed at the highest-trust
 * moment in the flow — the redirect straight after a successful sign-in. Only a
 * single-slash absolute path is accepted: `//evil.example` and
 * `https://evil.example` are both browser-honoured absolute URLs, and a
 * backslash is normalised to a slash by some browsers.
 */
export function safeNext(next: string | null | undefined, fallback = '/dashboard'): string {
	if (!next || !next.startsWith('/')) return fallback;
	if (next.startsWith('//') || next.startsWith('/\\')) return fallback;
	return next;
}

/** The signed-in user, or a redirect to the login page carrying the return path. */
export function requireUser(event: RequestEvent) {
	const user = event.locals.user;
	if (!user) {
		const next = encodeURIComponent(event.url.pathname + event.url.search);
		redirect(303, `/login?next=${next}`);
	}
	return user;
}

/** The signed-in user, refused unless they hold one of `roles`. */
export function requireRole(event: RequestEvent, ...roles: Role[]) {
	const user = requireUser(event);
	const role = (user.role ?? 'creator') as Role;
	if (!roles.includes(role)) {
		error(403, m.srv_no_permission());
	}
	return user;
}

export const isAdmin = (user?: { role?: string | null } | null) => user?.role === 'admin';

/**
 * The creator profile owned by this user. Business and admin accounts have
 * none, so callers that need one should use `requireCreator`.
 */
export async function getCreatorFor(userId: string) {
	const rows = await db
		.select()
		.from(t.creators)
		.where(and(eq(t.creators.userId, userId), isNull(t.creators.deletedAt)))
		/* Oldest first, so "which profile am I" has one answer across requests. */
		.orderBy(asc(t.creators.id))
		.limit(1);
	return rows.at(0);
}

export async function requireCreator(event: RequestEvent) {
	const user = requireRole(event, 'creator', 'admin');
	const creator = await getCreatorFor(user.id);
	if (!creator) {
		redirect(303, '/dashboard/profile/create');
	}
	return { user, creator };
}

/**
 * The organisation this user acts for. Ownership comes first, then the oldest
 * membership — permissions are always derived from a record, never from a
 * client-supplied organisation id.
 */
export async function getOrganizationFor(userId: string) {
	const owned = await db
		.select()
		.from(t.organizations)
		.where(and(eq(t.organizations.ownerId, userId), isNull(t.organizations.deletedAt)))
		/* Oldest first, so the acting organisation is stable across requests. */
		.orderBy(asc(t.organizations.id))
		.limit(1);
	if (owned.length) return owned[0];

	const member = await db
		.select({ org: t.organizations })
		.from(t.organizationMembers)
		.innerJoin(t.organizations, eq(t.organizations.id, t.organizationMembers.organizationId))
		.where(and(eq(t.organizationMembers.userId, userId), isNull(t.organizations.deletedAt)))
		.orderBy(asc(t.organizationMembers.id))
		.limit(1);

	return member.at(0)?.org;
}

export async function requireOrganization(event: RequestEvent) {
	const user = requireRole(event, 'business', 'admin');
	const organization = await getOrganizationFor(user.id);
	if (!organization) {
		redirect(303, '/dashboard/organization/create');
	}
	return { user, organization };
}

/** Refuses unless the booking belongs to this user's creator or organisation. */
export async function requireBookingAccess(event: RequestEvent, bookingId: number) {
	const user = requireUser(event);
	const rows = await db.select().from(t.bookings).where(eq(t.bookings.id, bookingId)).limit(1);
	const booking = rows.at(0);
	if (!booking) error(404, m.srv_booking_not_found());

	if (isAdmin(user)) return { user, booking, side: 'admin' as const };

	const creator = await getCreatorFor(user.id);
	if (creator && creator.id === booking.creatorId) {
		return { user, booking, side: 'creator' as const };
	}

	const organization = await getOrganizationFor(user.id);
	if (organization && organization.id === booking.organizationId) {
		return { user, booking, side: 'organization' as const };
	}

	error(403, m.srv_booking_not_yours());
}

/** Appends to the audit log. Never throws into the caller's happy path. */
export async function recordAudit(entry: {
	actorId?: string | null;
	actorLabel?: string | null;
	entity: string;
	entityId?: number | null;
	action: string;
	fromState?: string | null;
	toState?: string | null;
	reason?: string | null;
}) {
	try {
		await db.insert(t.auditLog).values(entry);
	} catch (err) {
		console.error('Audit write failed:', err);
	}
}
