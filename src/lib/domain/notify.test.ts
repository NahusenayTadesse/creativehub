import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, EDITABLE, shouldNotify } from './notify';
import type { NotifyCategory, Preferences } from './notify';

const allOff: Preferences = {
	dealsEmail: false,
	dealsApp: false,
	messagesEmail: false,
	messagesApp: false,
	accountEmail: false,
	productEmail: false
};

describe('shouldNotify', () => {
	it('follows the preference when there is one', () => {
		expect(shouldNotify(DEFAULT_PREFERENCES, 'deals', 'email')).toBe(true);
		expect(shouldNotify(allOff, 'deals', 'email')).toBe(false);
		expect(shouldNotify(allOff, 'messages', 'app')).toBe(false);
	});

	it('falls back to the defaults when no row has been written', () => {
		expect(shouldNotify(null, 'deals', 'email')).toBe(true);
		expect(shouldNotify(undefined, 'messages', 'app')).toBe(true);
		/* Marketing is the one thing that has to be asked for. */
		expect(shouldNotify(null, 'product', 'email')).toBe(false);
	});

	/*
	 * The point of the module. Somebody who has switched off everything the page
	 * offers still gets told their password was reset.
	 */
	it('sends security mail whatever anyone has chosen', () => {
		expect(shouldNotify(allOff, 'security', 'email')).toBe(true);
		expect(shouldNotify(allOff, 'security', 'app')).toBe(true);
	});

	it('always records an account decision in the interface', () => {
		expect(shouldNotify(allOff, 'account', 'app')).toBe(true);
		/* …while the mail about it is genuinely optional. */
		expect(shouldNotify(allOff, 'account', 'email')).toBe(false);
	});

	it('never puts marketing in the notification bell', () => {
		const allOn = { ...DEFAULT_PREFERENCES, productEmail: true };
		expect(shouldNotify(allOn, 'product', 'app')).toBe(false);
	});

	it('is silent about a category it does not know', () => {
		for (const key of ['__proto__', 'constructor', 'toString', 'nonsense']) {
			expect(shouldNotify(DEFAULT_PREFERENCES, key as NotifyCategory, 'email')).toBe(false);
			expect(shouldNotify(DEFAULT_PREFERENCES, key as NotifyCategory, 'app')).toBe(false);
		}
	});

	it('does not trust a preference object missing the key it needs', () => {
		expect(shouldNotify({} as Preferences, 'deals', 'email')).toBe(false);
	});
});

describe('EDITABLE', () => {
	it('never offers a switch for something that is not a choice', () => {
		const categories = EDITABLE.map((row) => row.category);
		expect(categories).not.toContain('security');
		/* An account decision always appears in-app, so it must not be listed
		   as an in-app toggle. */
		expect(EDITABLE.find((r) => r.category === 'account')?.channels).toEqual(['email']);
		expect(EDITABLE.find((r) => r.category === 'product')?.channels).toEqual(['email']);
	});

	it('offers a switch for everything a person can actually change', () => {
		for (const row of EDITABLE) {
			for (const channel of row.channels) {
				const on = shouldNotify(
					{ ...DEFAULT_PREFERENCES, ...allOn(row.category) },
					row.category,
					channel
				);
				const off = shouldNotify(allOff, row.category, channel);
				expect(on === true || off === false).toBe(true);
				/* the switch has to actually move the answer */
				expect(off).toBe(false);
			}
		}
	});
});

function allOn(category: string): Partial<Preferences> {
	return category === 'product' ? { productEmail: true } : {};
}
