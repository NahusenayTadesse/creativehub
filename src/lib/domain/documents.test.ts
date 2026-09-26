import { describe, expect, it } from 'vitest';
import {
	brandInvoice,
	creatorStatement,
	documentNumber,
	withholdingCertificate,
	withholdingOn,
	type DealFacts
} from './documents';

const issuer = {
	siteName: 'Influencer Ethiopia',
	legalName: 'digitalconstruct',
	tin: '1',
	vatNumber: '2',
	address: 'Addis'
};
const deal: DealFacts = {
	reference: 'CN-2609-X',
	title: 'Launch',
	currencyCode: 'ETB',
	price: 100_000,
	platformFee: 15_000,
	commissionPercent: 15,
	creatorPayout: 85_000,
	brandServiceFee: 5_000,
	brandServiceFeeVat: 750,
	brandTotal: 105_750,
	withholdingTax: 2_550,
	completedAt: null,
	contractReference: 'CN-2609-X-C1'
};

describe('documents', () => {
	it('numbers one sequence per kind per year', () => {
		expect(documentNumber('brand_invoice', 2026, 42)).toBe('IE-INV-2026-00042');
		expect(documentNumber('withholding_certificate', 2027, 1)).toBe('IE-WHT-2027-00001');
	});

	it('invoices the brand for everything it pays, in one document', () => {
		const doc = brandInvoice(issuer, { name: 'Acme' }, deal, 15);
		expect(doc.total).toBe(105_750);
		expect(doc.lines.map((line) => line.label)).toEqual([
			'campaign_fee',
			'service_fee',
			'vat_on_service_fee'
		]);
	});

	it('shows the creator what was kept and withheld, and the net', () => {
		const doc = creatorStatement(issuer, { name: 'Selam', handle: '@selam' }, deal, 3);
		expect(doc.total).toBe(85_000 - 2_550);
		expect(doc.lines.filter((line) => line.deducted)).toHaveLength(2);
	});

	it('certifies the tax withheld', () => {
		expect(withholdingCertificate(issuer, { name: 'Selam', handle: '@selam' }, deal, 3).total).toBe(
			2_550
		);
		expect(withholdingOn(85_000, 3)).toBe(2_550);
		expect(withholdingOn(85_000, 0)).toBe(0);
	});
});
