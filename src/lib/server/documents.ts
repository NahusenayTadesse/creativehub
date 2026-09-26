import { and, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { getSettings } from '$lib/server/queries';
import { recordAudit } from '$lib/server/guards';
import { currentContract } from '$lib/server/contracts';
import {
	brandInvoice,
	creatorStatement,
	documentNumber,
	withholdingCertificate,
	type DealFacts,
	type DocumentData,
	type DocumentKind,
	type Issuer
} from '$lib/domain/documents';

/**
 * Issuing the platform's invoices and certificates.
 *
 * The brand's invoice is issued when the contract is fully signed: it is the
 * bill for the campaign funds the platform is about to hold. The creator's
 * statement, and the withholding certificate where tax was withheld, are
 * issued when the deal completes and the payout is fixed. Each is issued once
 * per deal — issuing again returns the one already on file.
 */

type Booking = typeof t.bookings.$inferSelect;

async function issuer(): Promise<Issuer & { vatPercent: number; withholdingPercent: number }> {
	const settings = await getSettings();
	return {
		siteName: settings?.siteName || 'Influencer Ethiopia',
		legalName: settings?.invoiceLegalName ?? '',
		tin: settings?.invoiceTin ?? '',
		vatNumber: settings?.invoiceVatNumber ?? '',
		address: settings?.invoiceAddress ?? '',
		vatPercent: settings?.vatPercent ?? 15,
		withholdingPercent: settings?.withholdingPercent ?? 0
	};
}

async function dealFacts(booking: Booking): Promise<DealFacts> {
	const contract = await currentContract(booking.id);
	return {
		reference: booking.reference,
		title: booking.title,
		currencyCode: booking.currencyCode,
		price: booking.price,
		platformFee: booking.platformFee,
		commissionPercent: booking.commissionPercent,
		creatorPayout: booking.creatorPayout,
		brandServiceFee: booking.brandServiceFee,
		brandServiceFeeVat: booking.brandServiceFeeVat,
		brandTotal: booking.brandTotal || booking.price,
		withholdingTax: booking.withholdingTax,
		completedAt: booking.completedAt ? booking.completedAt.toISOString() : null,
		contractReference: contract?.status === 'signed' ? contract.reference : null
	};
}

/**
 * Writes one document with the next number in its sequence.
 *
 * The number is read and written in two steps, so two issues racing for the
 * same number are expected now and then: the unique index refuses the loser,
 * and it simply tries the next one.
 */
async function issue(
	booking: Booking,
	kind: DocumentKind,
	data: DocumentData,
	owner: { organizationId?: number; creatorId?: number }
) {
	const existing = await db
		.select({ id: t.documents.id, number: t.documents.number })
		.from(t.documents)
		.where(and(eq(t.documents.bookingId, booking.id), eq(t.documents.kind, kind)))
		.limit(1);
	if (existing.length) return existing[0];

	const year = new Date().getUTCFullYear();
	for (let attempt = 0; attempt < 5; attempt++) {
		const last = await db
			.select({ sequence: t.documents.sequence })
			.from(t.documents)
			.where(and(eq(t.documents.kind, kind), eq(t.documents.year, year)))
			.orderBy(desc(t.documents.sequence))
			.limit(1);
		const sequence = (last.at(0)?.sequence ?? 0) + 1 + attempt;
		const number = documentNumber(kind, year, sequence);
		try {
			await db.insert(t.documents).values({
				bookingId: booking.id,
				kind,
				number,
				year,
				sequence,
				organizationId: owner.organizationId ?? null,
				creatorId: owner.creatorId ?? null,
				data: data as unknown as Record<string, unknown>,
				total: data.total,
				currencyCode: booking.currencyCode
			});
			await recordAudit({
				entity: 'booking',
				entityId: booking.id,
				action: 'document_issued',
				reason: `${number} (${kind}) for ${data.total} ${booking.currencyCode}`
			});
			return { number };
		} catch (err) {
			/* Another issue took this number, or this deal's document, first. */
			const again = await db
				.select({ id: t.documents.id, number: t.documents.number })
				.from(t.documents)
				.where(and(eq(t.documents.bookingId, booking.id), eq(t.documents.kind, kind)))
				.limit(1);
			if (again.length) return again[0];
			if (attempt === 4) throw err;
		}
	}
	return null;
}

/** The brand's invoice, once the contract is signed. Paid deals only. */
export async function issueBrandInvoice(booking: Booking) {
	if (booking.compensationType !== 'paid' || booking.price <= 0) return null;
	const [from, facts, org] = await Promise.all([
		issuer(),
		dealFacts(booking),
		db
			.select({ name: t.organizations.name })
			.from(t.organizations)
			.where(eq(t.organizations.id, booking.organizationId))
			.limit(1)
	]);
	return issue(
		booking,
		'brand_invoice',
		brandInvoice(from, { name: org.at(0)?.name ?? '' }, facts, from.vatPercent),
		{ organizationId: booking.organizationId }
	);
}

/**
 * The creator's statement, and the withholding certificate when tax was
 * withheld. Called with the booking as it stands after completion, so the
 * withholding fixed there is what is printed.
 */
export async function issueCreatorDocuments(booking: Booking) {
	if (booking.compensationType !== 'paid' || booking.price <= 0) return [];
	const [from, facts, creator] = await Promise.all([
		issuer(),
		dealFacts(booking),
		db
			.select({ name: t.creators.fullName, username: t.creators.username })
			.from(t.creators)
			.where(eq(t.creators.id, booking.creatorId))
			.limit(1)
	]);
	const who = { name: creator.at(0)?.name ?? '', handle: `@${creator.at(0)?.username ?? ''}` };
	const issued = [
		await issue(
			booking,
			'creator_statement',
			creatorStatement(from, who, facts, from.withholdingPercent),
			{ creatorId: booking.creatorId }
		)
	];
	if (booking.withholdingTax > 0) {
		issued.push(
			await issue(
				booking,
				'withholding_certificate',
				withholdingCertificate(from, who, facts, from.withholdingPercent),
				{ creatorId: booking.creatorId }
			)
		);
	}
	return issued;
}

/** The documents on a deal that this side of it may read. */
export async function listDocumentsFor(
	bookingId: number,
	side: 'admin' | 'organization' | 'creator'
) {
	const rows = await db
		.select({
			number: t.documents.number,
			kind: t.documents.kind,
			total: t.documents.total,
			currencyCode: t.documents.currencyCode,
			issuedAt: t.documents.issuedAt
		})
		.from(t.documents)
		.where(eq(t.documents.bookingId, bookingId))
		.orderBy(t.documents.issuedAt);
	return rows.filter((row) =>
		side === 'admin'
			? true
			: side === 'organization'
				? row.kind === 'brand_invoice'
				: row.kind !== 'brand_invoice'
	);
}
