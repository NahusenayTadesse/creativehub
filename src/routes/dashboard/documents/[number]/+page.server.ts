import * as m from '$lib/paraglide/messages';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireUser, isAdmin, getCreatorFor, getOrganizationFor } from '$lib/server/guards';
import type { DocumentData } from '$lib/domain/documents';

/**
 * One issued invoice or certificate, rendered from the snapshot taken when it
 * was issued. The brand sees its invoices, the creator their statements and
 * certificates, and the platform's staff all of them.
 */
export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const rows = await db
		.select()
		.from(t.documents)
		.where(eq(t.documents.number, event.params.number))
		.limit(1);
	const doc = rows.at(0);
	if (!doc) error(404, m.doc_not_found());

	if (!isAdmin(user)) {
		const [creator, organization] = await Promise.all([
			getCreatorFor(user.id),
			getOrganizationFor(user.id)
		]);
		const mine =
			(doc.organizationId !== null && organization?.id === doc.organizationId) ||
			(doc.creatorId !== null && creator?.id === doc.creatorId);
		if (!mine) error(403, m.doc_not_yours());
	}

	const data =
		typeof doc.data === 'string'
			? (JSON.parse(doc.data) as DocumentData)
			: (doc.data as unknown as DocumentData);
	/*
	 * Whether an invoice has been paid is not part of the snapshot — it changes
	 * after issue — so it is read from the deal each time: the campaign funds
	 * are held, or were held and released, once the brand's payment landed.
	 */
	let paid: boolean | null = null;
	if (doc.kind === 'brand_invoice') {
		const deal = await db
			.select({ escrowStatus: t.bookings.escrowStatus })
			.from(t.bookings)
			.where(eq(t.bookings.id, doc.bookingId))
			.limit(1);
		const status = deal.at(0)?.escrowStatus;
		paid = status === 'held' || status === 'released' || status === 'refunded';
	}

	return {
		number: doc.number,
		issuedAt: doc.issuedAt,
		currencyCode: doc.currencyCode,
		doc: data,
		paid
	};
};
