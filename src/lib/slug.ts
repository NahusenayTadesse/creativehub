/**
 * A title, as the URL it will live at.
 *
 * Pure, and kept apart from `$lib/server/slug.ts` for the same reason
 * `$lib/query.ts` is kept apart from `$lib/server/query.ts`: the other half
 * needs a database connection, and this half is wanted by things that have
 * none — the seed script, which makes its own connection and cannot resolve
 * `$env/dynamic/private`, and any component that wants to show a permalink
 * before it is saved.
 */

/** "Telebirr SuperApp 5G Launch" → "telebirr-superapp-5g-launch". */
export function slugify(value: string, fallback = 'item'): string {
	return (
		value
			.toLowerCase()
			/*
			 * Latin letters and digits only. A title written in Ge'ez script
			 * reduces to nothing here and falls back to `fallback` plus the
			 * uniqueness suffix — an opaque URL, but a stable and linkable one,
			 * which percent-encoded Amharic in a permalink is not.
			 */
			.replace(/[^a-z0-9]+/g, '-')
			/* Trimmed *after* the cut as well as before it: a title long enough to
			   be truncated can land the knife on a separator, and `…-guide-` is a
			   permalink with a dangling hyphen in it forever. */
			.slice(0, 240)
			.replace(/^-+|-+$/g, '') || fallback
	);
}
