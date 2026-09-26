import { and, eq, inArray, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { recordAudit } from '$lib/server/guards';
import * as m from '$lib/paraglide/messages';

/**
 * Who may see which brand is behind a brief or a deal.
 *
 * A creator sees everything they need to judge an offer — industry, budget,
 * deliverables, deadline — straight away. The brand's name, logo and link wait
 * behind a one-click NDA, accepted per brief or per deal, before any terms are
 * agreed. The brand's own people and the platform's staff always see it, and a
 * brief its brand has made public (`campaigns.confidential = false`) hides
 * nothing from anyone.
 *
 * The masking happens here, on the server, before a row reaches a page — never
 * in the template — so a name the reader may not see is never in the HTML.
 */

/** Stamped on every acceptance, so a later revision of the wording is traceable. */
export const NDA_VERSION = '2026-09';

export type NdaSubject = { type: 'campaign' | 'booking'; id: number };

type Viewer = { id: string; role?: string | null } | null | undefined;

/** One thing on a page that may name a brand, and what would unlock it. */
export type BrandRef = {
	organizationId: number;
	/** The brief it belongs to, if any. Its NDA unlocks deals made from it too. */
	campaignId?: number | null;
	/** The deal, if this is one. */
	bookingId?: number | null;
	/** Whether the brief keeps its brand back. Deals always do. */
	confidential?: boolean | null;
};

const key = (type: 'campaign' | 'booking', id: number) => `${type}:${id}`;

/** The organisations this account belongs to, by id. */
async function memberOrganizations(userId: string): Promise<Set<number>> {
	const rows = await db
		.select({ id: t.organizationMembers.organizationId })
		.from(t.organizationMembers)
		.where(eq(t.organizationMembers.userId, userId));
	const owned = await db
		.select({ id: t.organizations.id })
		.from(t.organizations)
		.where(eq(t.organizations.ownerId, userId));
	return new Set([...rows, ...owned].map((row) => row.id));
}

/**
 * Which of `refs` this viewer may see the brand of, as a predicate.
 *
 * One query for the viewer's memberships and one for their acceptances,
 * however many rows the page holds.
 */
export async function brandVisibility(
	viewer: Viewer,
	refs: BrandRef[]
): Promise<(ref: BrandRef) => boolean> {
	if (viewer && (viewer.role === 'admin' || viewer.role === 'encoder')) return () => true;

	const campaignIds = [
		...new Set(refs.map((ref) => ref.campaignId).filter((id): id is number => !!id))
	];
	const bookingIds = [
		...new Set(refs.map((ref) => ref.bookingId).filter((id): id is number => !!id))
	];

	let orgs = new Set<number>();
	const accepted = new Set<string>();
	if (viewer) {
		orgs = await memberOrganizations(viewer.id);
		const conditions = [
			campaignIds.length
				? and(
						eq(t.ndaAcceptances.subjectType, 'campaign'),
						inArray(t.ndaAcceptances.subjectId, campaignIds)
					)
				: undefined,
			bookingIds.length
				? and(
						eq(t.ndaAcceptances.subjectType, 'booking'),
						inArray(t.ndaAcceptances.subjectId, bookingIds)
					)
				: undefined
		].filter(Boolean);
		if (conditions.length) {
			const rows = await db
				.select({ type: t.ndaAcceptances.subjectType, id: t.ndaAcceptances.subjectId })
				.from(t.ndaAcceptances)
				.where(and(eq(t.ndaAcceptances.userId, viewer.id), or(...conditions)));
			for (const row of rows) accepted.add(key(row.type, row.id));
		}
	}

	return (ref) => {
		if (orgs.has(ref.organizationId)) return true;
		/* A public brief hides nothing; a deal is always private to its parties. */
		if (!ref.bookingId && ref.confidential === false) return true;
		if (ref.bookingId && accepted.has(key('booking', ref.bookingId))) return true;
		if (ref.campaignId && accepted.has(key('campaign', ref.campaignId))) return true;
		return false;
	};
}

/** What stands in for a hidden brand's name: its industry, when it has one. */
export const maskedBrandName = (industry?: string | null) =>
	industry?.trim()
		? m.nda_masked_brand_industry({ industry: industry.trim() })
		: m.nda_masked_brand();

/**
 * A row with its brand's identifying fields replaced, when the viewer may not
 * see them. Leaves every other field alone, so the page renders the same shape.
 */
export function maskRow<
	R extends {
		organizationName?: string | null;
		organizationLogo?: string | null;
		organizationSlug?: string | null;
		organizationIndustry?: string | null;
	}
>(row: R, visible: boolean): R & { brandHidden: boolean } {
	if (visible) return { ...row, brandHidden: false };
	return {
		...row,
		organizationName: maskedBrandName(row.organizationIndustry),
		organizationLogo: null,
		organizationSlug: null,
		brandHidden: true
	};
}

/**
 * Records a creator's acceptance, once. Accepting again is not an error — the
 * button may have been pressed twice — and changes nothing.
 */
export async function acceptNda(input: {
	user: { id: string; name?: string | null };
	organizationId: number;
	subject: NdaSubject;
	ip: string | null;
}) {
	const existing = await db
		.select({ id: t.ndaAcceptances.id })
		.from(t.ndaAcceptances)
		.where(
			and(
				eq(t.ndaAcceptances.userId, input.user.id),
				eq(t.ndaAcceptances.subjectType, input.subject.type),
				eq(t.ndaAcceptances.subjectId, input.subject.id)
			)
		)
		.limit(1);
	if (existing.length) return;

	await db.insert(t.ndaAcceptances).values({
		userId: input.user.id,
		organizationId: input.organizationId,
		subjectType: input.subject.type,
		subjectId: input.subject.id,
		ndaVersion: NDA_VERSION,
		ip: input.ip
	});

	await recordAudit({
		actorId: input.user.id,
		actorLabel: input.user.name,
		entity: input.subject.type === 'booking' ? 'booking' : 'campaign',
		entityId: input.subject.id,
		action: 'nda_accepted',
		reason: `NDA ${NDA_VERSION}`
	});
}

/**
 * Briefs, each with its brand masked unless this viewer may see it. The rows
 * need `id` (the brief), `organizationId` and `confidential`.
 */
export async function maskCampaigns<
	R extends {
		id: number;
		organizationId: number;
		confidential?: boolean | null;
		organizationName?: string | null;
		organizationLogo?: string | null;
		organizationSlug?: string | null;
		organizationIndustry?: string | null;
	}
>(viewer: Viewer, rows: R[]) {
	const refs = rows.map((row) => ({
		organizationId: row.organizationId,
		campaignId: row.id,
		confidential: row.confidential ?? true
	}));
	const visible = await brandVisibility(viewer, refs);
	return rows.map((row, index) => maskRow(row, visible(refs[index])));
}

/**
 * Deals, each with its brand masked unless this viewer may see it. The rows
 * need `id` (the deal), `organizationId` and, when it came from a brief,
 * `campaignId`.
 */
export async function maskBookings<
	R extends {
		id: number;
		organizationId: number;
		campaignId?: number | null;
		organizationName?: string | null;
		organizationLogo?: string | null;
		organizationIndustry?: string | null;
	}
>(viewer: Viewer, rows: R[]) {
	const refs = rows.map((row) => ({
		organizationId: row.organizationId,
		campaignId: row.campaignId ?? null,
		bookingId: row.id
	}));
	const visible = await brandVisibility(viewer, refs);
	return rows.map((row, index) => maskRow(row, visible(refs[index])));
}

/** Applications, each with its brief's brand masked unless this viewer may see it. */
export async function maskApplications<
	R extends {
		campaignId: number;
		organizationId: number;
		confidential?: boolean | null;
		organizationName?: string | null;
		organizationIndustry?: string | null;
	}
>(viewer: Viewer, rows: R[]) {
	const refs = rows.map((row) => ({
		organizationId: row.organizationId,
		campaignId: row.campaignId,
		confidential: row.confidential ?? true
	}));
	const visible = await brandVisibility(viewer, refs);
	return rows.map((row, index) => maskRow(row, visible(refs[index])));
}
