import { describe, expect, it } from 'vitest';
import {
	LIVE_PAYOUT_STATUSES,
	maskAccount,
	payoutIsLive,
	payoutProblem,
	payoutReference,
	type PayoutProblem,
	type PayoutStatus
} from './payout';

const etbOnly = (code: string) => code === 'ETB';

/** A booking that is owed and payable. Each test spoils exactly one thing. */
const payable = {
	compensationType: 'paid',
	creatorPayout: 12_750,
	escrowStatus: 'released',
	currencyCode: 'ETB'
};

const account = { isVerified: true, currencyCode: 'ETB' };

const problemFor = (
	booking: Partial<typeof payable> = {},
	acct: typeof account | null = account,
	live = 0
): PayoutProblem | null => payoutProblem({ ...payable, ...booking }, acct, live, etbOnly);

describe('payoutProblem', () => {
	it('clears a completed, funded, verified deal', () => {
		expect(problemFor()).toBeNull();
	});

	it('owes nothing on barter or an event pass', () => {
		expect(problemFor({ compensationType: 'barter' })).toBe('not_paid');
		expect(problemFor({ compensationType: 'event_pass' })).toBe('not_paid');
	});

	it('owes nothing when the split leaves the creator zero', () => {
		expect(problemFor({ creatorPayout: 0 })).toBe('not_paid');
		expect(problemFor({ creatorPayout: -1 })).toBe('not_paid');
	});

	/*
	 * The guard that matters most. `held` is the brand's money against work it
	 * has not accepted, and paying it out early hands over funds that are still
	 * disputable — so every escrow state but `released` has to be refused.
	 */
	it('refuses every escrow state except released', () => {
		for (const escrowStatus of ['unfunded', 'pending', 'held', 'refunded']) {
			expect(problemFor({ escrowStatus })).toBe('not_released');
		}
		expect(problemFor({ escrowStatus: 'released' })).toBeNull();
	});

	it('refuses a second attempt while one is live', () => {
		expect(problemFor({}, account, 1)).toBe('already');
		expect(problemFor({}, account, 9)).toBe('already');
	});

	it('needs an account, and needs it checked', () => {
		expect(problemFor({}, null)).toBe('no_account');
		expect(problemFor({}, { ...account, isVerified: false })).toBe('account_unverified');
	});

	it('refuses a currency the provider will not transfer', () => {
		expect(problemFor({ currencyCode: 'USD' }, { ...account, currencyCode: 'USD' })).toBe(
			'currency'
		);
	});

	it('refuses an account held in another currency', () => {
		expect(problemFor({}, { ...account, currencyCode: 'USD' })).toBe('currency_mismatch');
	});

	/*
	 * The order is the message. An operator looking at a barter booking with no
	 * bank account on file should be told there is nothing owed — "no bank
	 * account" would send them chasing a creator for details that will never be
	 * used.
	 */
	it('reports the deal-level reason before the account-level one', () => {
		expect(problemFor({ compensationType: 'barter' }, null)).toBe('not_paid');
		expect(problemFor({ escrowStatus: 'held' }, null)).toBe('not_released');
		expect(problemFor({}, null, 1)).toBe('already');
	});
});

describe('payoutIsLive', () => {
	it('counts in-flight and settled attempts, not failed ones', () => {
		expect(LIVE_PAYOUT_STATUSES).toEqual(['pending', 'queued', 'success']);
		for (const status of LIVE_PAYOUT_STATUSES) expect(payoutIsLive(status)).toBe(true);
		/* The two that must leave a booking payable again. */
		for (const status of ['failed', 'cancelled'] satisfies PayoutStatus[]) {
			expect(payoutIsLive(status)).toBe(false);
		}
	});

	it('does not answer for a status nobody declared', () => {
		expect(payoutIsLive('')).toBe(false);
		expect(payoutIsLive('constructor')).toBe(false);
	});
});

describe('payoutReference', () => {
	it('keeps the booking readable and marks the direction', () => {
		const reference = payoutReference('CN-2608-K4F2WQ7A');
		expect(reference).toMatch(/^CN-2608-K4F2WQ7A-PO-[0-9A-HJKMNP-TV-Z]{8}$/);
	});

	/* A collision is an unexplained failure against a unique index, with no
	   retry — the same reason `bookingReference` moved off four characters. */
	it('does not repeat itself', () => {
		const seen = new Set(Array.from({ length: 2_000 }, () => payoutReference('CN-2608-AAAAAAAA')));
		expect(seen.size).toBe(2_000);
	});
});

describe('maskAccount', () => {
	it('leaves the ends readable', () => {
		expect(maskAccount('1000123453417')).toBe('1000••••3417');
	});

	/* Masking eight digits leaves nothing but the mask: it identifies nothing
	   and hides nothing, so a short number is returned whole. */
	it('does not mask a number too short to survive it', () => {
		expect(maskAccount('12345678')).toBe('12345678');
		expect(maskAccount('123')).toBe('123');
	});

	it('ignores surrounding whitespace', () => {
		expect(maskAccount('  1000123453417  ')).toBe('1000••••3417');
	});
});
