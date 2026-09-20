import { describe, expect, it } from 'vitest';
import { bioContainsCode, generateOwnershipCode, isOwnershipCode } from './ownership-code';
import { OWNERSHIP_STATUSES, isOwnershipProved } from './ownership';
import { ownershipStatusEnum } from '$lib/server/db/schema';

describe('generateOwnershipCode', () => {
	it('is shaped the way the instructions describe it', () => {
		expect(generateOwnershipCode()).toMatch(/^CN-[0-9A-Z]{4}$/);
	});

	it('never mints a character somebody could transcribe as another', () => {
		/* 0/O, 1/I/L and 5/S are the confusable pairs, and U is left out with them.
		   A code is copied off a screen and typed into a phone at least once. */
		const minted = Array.from({ length: 300 }, generateOwnershipCode).join('');
		expect(minted).not.toMatch(/[01ILOSU5]/);
	});

	it('does not hand the same code to everybody', () => {
		const codes = new Set(Array.from({ length: 200 }, generateOwnershipCode));
		/* 30^4 possibilities: a couple of collisions in 200 draws would be bad luck,
		   a handful of distinct values would be a broken generator. */
		expect(codes.size).toBeGreaterThan(190);
	});

	it('recognises its own output', () => {
		for (let i = 0; i < 50; i++) expect(isOwnershipCode(generateOwnershipCode())).toBe(true);
		expect(isOwnershipCode('CN-0000')).toBe(false);
		expect(isOwnershipCode('hello')).toBe(false);
	});
});

describe('bioContainsCode', () => {
	const code = 'CN-4F7K';

	it('finds the code sitting on its own', () => {
		expect(bioContainsCode('CN-4F7K', code)).toBe(true);
	});

	it('finds it among everything else a bio holds', () => {
		expect(bioContainsCode('📍 Addis · DM for rates · CN-4F7K · link below', code)).toBe(true);
	});

	it('does not care how the creator typed it', () => {
		/* Lower case, no separator, a space instead, and the non-breaking hyphen
		   these platforms substitute for the ASCII one. */
		expect(bioContainsCode('cn-4f7k', code)).toBe(true);
		expect(bioContainsCode('CN4F7K', code)).toBe(true);
		expect(bioContainsCode('CN 4F7K', code)).toBe(true);
		expect(bioContainsCode('CN‑4F7K', code)).toBe(true);
		expect(bioContainsCode('[CN-4F7K]', code)).toBe(true);
	});

	it('survives a bio that a phone keyboard has been through', () => {
		/* Zero-width joiners arrive around emoji and would split the code in two
		   for any comparison that did not strip them. */
		expect(bioContainsCode('creator‍ CN-​4F7K ⁣', code)).toBe(true);
	});

	it('says no when the code is simply not there', () => {
		expect(bioContainsCode('Creator · Addis Ababa', code)).toBe(false);
		expect(bioContainsCode('CN-4F7J', code)).toBe(false);
		expect(bioContainsCode('', code)).toBe(false);
		expect(bioContainsCode(null, code)).toBe(false);
	});

	it('never matches on an empty or missing code', () => {
		/* The dangerous direction: an empty needle inside any haystack is a
		   substring, so a row with no code would verify against any bio at all. */
		expect(bioContainsCode('anything at all', '')).toBe(false);
		expect(bioContainsCode('anything at all', null)).toBe(false);
		expect(bioContainsCode('anything at all', '—')).toBe(false);
	});
});

describe('ownership statuses', () => {
	it('match the column the database stores them in', () => {
		expect([...OWNERSHIP_STATUSES]).toEqual([...ownershipStatusEnum]);
	});

	it('call only a checked handle proved', () => {
		expect(OWNERSHIP_STATUSES.filter(isOwnershipProved)).toEqual(['verified']);
		/* `unverified` is the platform refusing us, not a judgement on the creator,
		   and `pending` is a bio that has not been saved yet. Neither is a failure
		   anything is allowed to act on. */
		expect(isOwnershipProved('unverified')).toBe(false);
		expect(isOwnershipProved(null)).toBe(false);
	});
});
