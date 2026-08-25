import { describe, expect, it } from 'vitest';
import { canDecideClaim, claimIsOpen, handleFromEmail, looksLikeSamePerson } from './claim';
import type { ClaimStatus } from './claim';

const ALL: ClaimStatus[] = ['pending', 'approved', 'rejected', 'withdrawn'];

describe('canDecideClaim', () => {
	it('lets an operator approve or reject a claim that is waiting', () => {
		expect(canDecideClaim('pending', 'approved')).toBe(true);
		expect(canDecideClaim('pending', 'rejected')).toBe(true);
	});

	it('lets the claimant withdraw while it is still waiting', () => {
		expect(canDecideClaim('pending', 'withdrawn')).toBe(true);
	});

	it('refuses to decide a claim that is already closed', () => {
		for (const from of ['approved', 'rejected', 'withdrawn'] as ClaimStatus[]) {
			for (const to of ALL) {
				expect(canDecideClaim(from, to)).toBe(false);
			}
		}
	});

	it('refuses to re-open a decision as a way back to pending', () => {
		for (const from of ALL) {
			expect(canDecideClaim(from, 'pending')).toBe(false);
		}
	});

	it('refuses inherited object keys', () => {
		for (const key of ['__proto__', 'constructor', 'toString']) {
			expect(canDecideClaim(key as ClaimStatus, 'approved')).toBe(false);
		}
	});
});

describe('claimIsOpen', () => {
	it('is true only while nobody has decided', () => {
		expect(claimIsOpen('pending')).toBe(true);
		expect(claimIsOpen('approved')).toBe(false);
		expect(claimIsOpen('rejected')).toBe(false);
		expect(claimIsOpen('withdrawn')).toBe(false);
	});
});

describe('handleFromEmail', () => {
	it('takes the local part and drops the punctuation that varies', () => {
		expect(handleFromEmail('Sara.Mengistu@example.com')).toBe('saramengistu');
		expect(handleFromEmail('sara_mengistu+work@example.com')).toBe('saramengistuwork');
	});

	it('is empty for an address with no local part', () => {
		expect(handleFromEmail('@example.com')).toBe('');
		expect(handleFromEmail('')).toBe('');
	});
});

describe('looksLikeSamePerson', () => {
	const account = { name: 'Sara Mengistu', email: 'sara.mengistu@example.com' };

	it('matches on the name however it was spaced or cased', () => {
		expect(looksLikeSamePerson(account, { fullName: 'sara mengistu', username: 'other' })).toBe(
			true
		);
		expect(looksLikeSamePerson(account, { fullName: 'Sara  Mengistu', username: 'other' })).toBe(
			true
		);
	});

	it('matches when the imported handle is the email handle', () => {
		expect(
			looksLikeSamePerson(account, { fullName: 'Somebody Else', username: 'sara_mengistu' })
		).toBe(true);
	});

	it('does not match a different person who happens to share a first name', () => {
		expect(
			looksLikeSamePerson(account, { fullName: 'Sara Tesfaye', username: 'saratesfaye' })
		).toBe(false);
	});

	it('does not match on a substring', () => {
		expect(looksLikeSamePerson(account, { fullName: 'Sara', username: 'sara' })).toBe(false);
	});

	/*
	 * The blank cases are the dangerous ones: an account with no name and a
	 * profile with no name normalise to the same empty string, which would
	 * offer every unnamed import to every unnamed account.
	 */
	it('never matches on emptiness', () => {
		expect(
			looksLikeSamePerson({ name: '', email: '@example.com' }, { fullName: '', username: '' })
		).toBe(false);
		expect(
			looksLikeSamePerson({ name: '!!!', email: 'a@b.com' }, { fullName: '???', username: 'x' })
		).toBe(false);
	});
});
