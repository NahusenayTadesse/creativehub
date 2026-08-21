import { describe, expect, it } from 'vitest';
import { maskContact } from './mask';

/**
 * Contact masking is the whole anti-disintermediation story: deals stay on the
 * platform because the escrow, the delivery record and the review only exist
 * here, and that is only true while a message cannot simply carry a phone
 * number out of it.
 *
 * The tests below check the two failure modes separately — something that
 * should have been caught getting through, and ordinary text being mangled.
 */
describe('maskContact', () => {
	const leaks = [
		'reach me at sara@example.com',
		'SARA.T+work@sub.example.co.uk please',
		'call +251 91 234 5678',
		'call +251912345678',
		'0912345678 is my number',
		'0712345678 works too',
		'my number is 1234567890',
		'ping me t.me/sarahandles',
		'wa.me/251912345678',
		'telegram: @sara_t',
		'whatsapp: +251912345678'
	];

	it.each(leaks)('catches %j', (text) => {
		const result = maskContact(text);
		expect(result.masked).toBe(true);
		expect(result.text).not.toBe(text);
	});

	it('leaves the surrounding sentence readable', () => {
		const { text, masked } = maskContact('Send the brief to sara@example.com by Friday please');
		expect(masked).toBe(true);
		expect(text).toContain('Send the brief to');
		expect(text).toContain('by Friday please');
		expect(text).not.toContain('sara@example.com');
	});

	it('replaces every occurrence, not just the first', () => {
		const { text } = maskContact('a@b.com and c@d.com');
		expect(text).not.toContain('a@b.com');
		expect(text).not.toContain('c@d.com');
	});

	const innocent = [
		'Looking forward to the shoot on Tuesday.',
		'The budget is 12,000 ETB for three videos.',
		'Deliverables: 2 reels and 1 story.',
		'Version 2.5 of the brief is attached.',
		'ለስራው በጣም ደስ ብሎኛል', // Amharic: "I am very happy about the work"
		''
	];

	it.each(innocent)('leaves %j alone', (text) => {
		expect(maskContact(text)).toEqual({ text, masked: false });
	});

	/**
	 * The module comment calls this out and it is worth holding: a shared `/g`
	 * literal carries `lastIndex` between calls, so the second message with an
	 * address in it would slip through.
	 */
	it('does not go stale between calls', () => {
		for (let i = 0; i < 5; i++) {
			expect(maskContact('sara@example.com').masked, `call ${i}`).toBe(true);
		}
	});

	it('catches everything in a message carrying several kinds at once', () => {
		const { text, masked } = maskContact('sara@example.com or 0912345678 or t.me/sara');
		expect(masked).toBe(true);
		expect(text).not.toContain('sara@example.com');
		expect(text).not.toContain('0912345678');
		expect(text).not.toContain('t.me/sara');
	});
});
