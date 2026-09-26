import { describe, expect, it } from 'vitest';
import { contractText, type ContractInput } from './contract-text';

const input: ContractInput = {
	reference: 'IE-C-2609-0001',
	dealReference: 'CN-2609-ABCDEFGH',
	generatedAt: new Date('2026-09-26T10:00:00Z'),
	platform: {
		name: 'Influencer Ethiopia',
		legalName: 'digitalconstruct PLC',
		tin: '0012345678',
		address: 'Addis Ababa'
	},
	brand: { name: 'Acme Coffee' },
	creator: { fullName: 'Selam Tesfaye', handle: '@selam' },
	terms: {
		title: 'Launch video',
		deliverables: ['One TikTok video', 'Two Instagram stories'],
		compensationType: 'paid',
		currencyCode: 'ETB',
		price: 100_000,
		commission: 15_000,
		commissionPercent: 15,
		creatorPayout: 85_000,
		brandServiceFee: 5_000,
		brandServiceFeeVat: 750,
		brandTotal: 105_750,
		deadline: '2026-10-15',
		revisionsAllowed: 2
	},
	disputeWindowDays: 7
};

describe('contractText', () => {
	const text = contractText(input);

	it('names every party and every figure', () => {
		expect(text).toContain('digitalconstruct PLC');
		expect(text).toContain('Acme Coffee');
		expect(text).toContain('Selam Tesfaye (@selam)');
		expect(text).toContain('ETB 105,750');
		expect(text).toContain('ETB 85,000');
		expect(text).toContain('15 October 2026');
		expect(text).toContain('One TikTok video');
	});

	it('carries the non-circumvention clause and the concept stage', () => {
		expect(text).toContain('NON-CIRCUMVENTION');
		expect(text).toContain('submits a concept');
	});

	it('never uses the retired word for held funds', () => {
		expect(text.toLowerCase()).not.toContain('escrow');
		expect(
			contractText({
				...input,
				terms: { ...input.terms, compensationType: 'barter' }
			}).toLowerCase()
		).not.toContain('escrow');
	});

	it('is the same text for the same input, so its hash is stable', () => {
		expect(contractText(input)).toBe(text);
	});
});
