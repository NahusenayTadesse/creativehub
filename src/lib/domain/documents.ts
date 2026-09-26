/**
 * What the platform's invoices and certificates say, built from a deal.
 *
 * Pure: the server captures the result as the document's `data` at issue and
 * renders from that snapshot for ever after, so a rate or an address changed
 * later never rewrites a document already in someone's accounts.
 */

export type DocumentKind = 'brand_invoice' | 'creator_statement' | 'withholding_certificate';

export const DOCUMENT_PREFIX: Record<DocumentKind, string> = {
	brand_invoice: 'INV',
	creator_statement: 'STM',
	withholding_certificate: 'WHT'
};

/** IE-INV-2026-00042 — one sequence per kind per calendar year. */
export const documentNumber = (kind: DocumentKind, year: number, sequence: number) =>
	`IE-${DOCUMENT_PREFIX[kind]}-${year}-${String(sequence).padStart(5, '0')}`;

export type Issuer = {
	siteName: string;
	legalName: string;
	tin: string;
	vatNumber: string;
	address: string;
};

export type DealFacts = {
	reference: string;
	title: string;
	currencyCode: string;
	price: number;
	platformFee: number;
	commissionPercent: number;
	creatorPayout: number;
	brandServiceFee: number;
	brandServiceFeeVat: number;
	brandTotal: number;
	withholdingTax: number;
	completedAt: string | null;
	contractReference: string | null;
};

export type DocumentLine = {
	/** A key the renderer translates, so a document reads in the reader's language. */
	label:
		| 'campaign_fee'
		| 'service_fee'
		| 'vat_on_service_fee'
		| 'commission'
		| 'withholding'
		| 'net_payout'
		| 'gross_payment';
	/** Shown beside the label: a rate, e.g. "15%". */
	rate?: string;
	amount: number;
	/** A deduction, printed as negative. */
	deducted?: boolean;
};

export type DocumentData = {
	kind: DocumentKind;
	issuer: Issuer;
	recipient: { name: string; detail?: string };
	deal: DealFacts;
	lines: DocumentLine[];
	total: number;
	/** The rates in force when issued, so the document explains itself. */
	vatPercent: number;
	withholdingPercent: number;
};

const pct = (value: number) => `${Number(value.toFixed(2))}%`;

export function brandInvoice(
	issuer: Issuer,
	brand: { name: string },
	deal: DealFacts,
	vatPercent: number
): DocumentData {
	const lines: DocumentLine[] = [
		{ label: 'campaign_fee', amount: deal.price },
		{ label: 'service_fee', amount: deal.brandServiceFee }
	];
	if (deal.brandServiceFeeVat) {
		lines.push({
			label: 'vat_on_service_fee',
			rate: pct(vatPercent),
			amount: deal.brandServiceFeeVat
		});
	}
	return {
		kind: 'brand_invoice',
		issuer,
		recipient: { name: brand.name },
		deal,
		lines,
		total: deal.price + deal.brandServiceFee + deal.brandServiceFeeVat,
		vatPercent,
		withholdingPercent: 0
	};
}

export function creatorStatement(
	issuer: Issuer,
	creator: { name: string; handle: string },
	deal: DealFacts,
	withholdingPercent: number
): DocumentData {
	const lines: DocumentLine[] = [
		{ label: 'campaign_fee', amount: deal.price },
		{
			label: 'commission',
			rate: pct(deal.commissionPercent),
			amount: deal.platformFee,
			deducted: true
		}
	];
	if (deal.withholdingTax) {
		lines.push({
			label: 'withholding',
			rate: pct(withholdingPercent),
			amount: deal.withholdingTax,
			deducted: true
		});
	}
	return {
		kind: 'creator_statement',
		issuer,
		recipient: { name: creator.name, detail: creator.handle },
		deal,
		lines,
		total: deal.creatorPayout - deal.withholdingTax,
		vatPercent: 0,
		withholdingPercent
	};
}

export function withholdingCertificate(
	issuer: Issuer,
	creator: { name: string; handle: string },
	deal: DealFacts,
	withholdingPercent: number
): DocumentData {
	return {
		kind: 'withholding_certificate',
		issuer,
		recipient: { name: creator.name, detail: creator.handle },
		deal,
		lines: [
			{ label: 'gross_payment', amount: deal.creatorPayout },
			{ label: 'withholding', rate: pct(withholdingPercent), amount: deal.withholdingTax }
		],
		total: deal.withholdingTax,
		vatPercent: 0,
		withholdingPercent
	};
}

/** Tax withheld from a payout at the given rate, rounded to the birr. */
export const withholdingOn = (payout: number, percent: number) =>
	percent > 0 ? Math.round((Math.max(0, payout) * percent) / 100) : 0;
