/**
 * The short code a creator pastes into their bio to prove the account is theirs.
 *
 * A follower count is worth nothing if anyone can type somebody else's handle
 * next to it. The cheapest proof that does not need a login is to ask the
 * claimant to write something into the one place on the profile only its owner
 * can edit, and then go and read it back. This module is both halves of that:
 * minting the string, and recognising it again in a bio that has been through
 * a phone keyboard, an autocorrect and a platform's own text mangling.
 *
 * Pure and client-safe — the channels page shows the code it will be checked
 * against, rather than a prettified copy of it.
 */

/**
 * The characters a code is built from.
 *
 * `0/O`, `1/I/L` and `5/S` are the pairs people transcribe wrongly, and a code
 * is transcribed by hand on a phone at least once by definition, so both halves
 * of each pair go. `U` is left out with them, which costs one more character and
 * removes the whole class of four-letter accidents. What is left is 28
 * characters that cannot be mistaken for one another.
 */
const ALPHABET = '2346789ABCDEFGHJKMNPQRTVWXYZ';

/** Marks the string as ours in a bio that may have other things in it. */
const PREFIX = 'CN';

/** Characters after the prefix. 28^4 ≈ 615,000 — far more than a guesser gets attempts at. */
const LENGTH = 4;

/**
 * A code, as `CN-4F7K`.
 *
 * Rejection sampling rather than `% ALPHABET.length`: 256 is not a multiple of
 * 28, so plain modulo would make the first 4 characters of the alphabet
 * likelier than the rest. The bias would be small and would still be a
 * needlessly weaker code than the one asked for.
 */
export function generateOwnershipCode(): string {
	/** The largest multiple of 28 that fits in a byte; anything above it is redrawn. */
	const ceiling = 256 - (256 % ALPHABET.length);
	let code = '';

	while (code.length < LENGTH) {
		const bytes = new Uint8Array(LENGTH);
		crypto.getRandomValues(bytes);
		for (const byte of bytes) {
			if (code.length === LENGTH) break;
			if (byte >= ceiling) continue;
			code += ALPHABET[byte % ALPHABET.length];
		}
	}

	return `${PREFIX}-${code}`;
}

/**
 * Everything a comparison should ignore, removed.
 *
 * A bio is not a form field. Platforms re-encode the hyphen as a non-breaking
 * one, phones insert zero-width joiners around emoji, creators type the code in
 * lower case or wrap it in brackets or split it over a line. None of that is a
 * different code, and a check that said so would send people back to edit a bio
 * that already says the right thing. Letters and digits only, upper-cased.
 */
const squash = (value: string): string => value.toUpperCase().replace(/[^0-9A-Z]/g, '');

/**
 * Is this code written somewhere in this bio?
 *
 * Substring rather than equality: the instruction is to paste the code
 * *anywhere* in the bio, so it arrives surrounded by whatever else the creator
 * has written there.
 */
export function bioContainsCode(bio: string | null | undefined, code: string | null | undefined) {
	const needle = squash(code ?? '');
	if (!needle) return false;
	return squash(bio ?? '').includes(needle);
}

/** Whether a string looks like one of ours, for narrowing what gets checked at all. */
export function isOwnershipCode(value: string): boolean {
	return new RegExp(`^${PREFIX}[${ALPHABET}]{${LENGTH}}$`).test(squash(value));
}
