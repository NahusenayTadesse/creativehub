import * as m from '$lib/paraglide/messages';

/**
 * Anti-disintermediation. Deals stay on-platform because the escrow, the
 * delivery record and the review only exist here — masking contact details in
 * messages is what keeps that true.
 */

const EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
/** Ethiopian mobile formats (+251, 09…, 07…) plus generic long runs of digits. */
const PHONE = /(\+?251[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}|\b0[79]\d{8}\b|\+?\d{10,14})/g;
const HANDOFF = /(t\.me\/[\w]+|wa\.me\/\d+|telegram:\s*@[\w]+|whatsapp[:\s]+\+?\d+)/gi;

export type MaskResult = { text: string; masked: boolean };

export function maskContact(input: string): MaskResult {
	let masked = false;
	let text = input;

	// Fresh regex per pass: a shared /g literal carries `lastIndex` between calls.
	if (new RegExp(EMAIL.source, EMAIL.flags).test(text)) {
		text = text.replace(new RegExp(EMAIL.source, EMAIL.flags), m.mask_email());
		masked = true;
	}
	if (new RegExp(PHONE.source, PHONE.flags).test(text)) {
		text = text.replace(new RegExp(PHONE.source, PHONE.flags), m.mask_phone());
		masked = true;
	}
	if (new RegExp(HANDOFF.source, HANDOFF.flags).test(text)) {
		text = text.replace(new RegExp(HANDOFF.source, HANDOFF.flags), m.mask_link());
		masked = true;
	}

	return { text, masked };
}
