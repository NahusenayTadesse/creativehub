import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ db: {} }));

import { safeLink } from './inbox';

describe('safeLink', () => {
	it('keeps a link that stays on this site', () => {
		expect(safeLink('/dashboard/bookings/12')).toBe('/dashboard/bookings/12');
		expect(safeLink('/dashboard/channels?tab=proofs')).toBe('/dashboard/channels?tab=proofs');
	});

	it('refuses anything that would leave it', () => {
		for (const link of [
			'https://evil.example/phish',
			'//evil.example/phish',
			'/\\evil.example',
			'javascript:alert(1)',
			'dashboard/bookings/12'
		]) {
			expect(safeLink(link), link).toBeNull();
		}
	});

	it('is null for no link at all', () => {
		expect(safeLink(null)).toBeNull();
		expect(safeLink('')).toBeNull();
	});
});
