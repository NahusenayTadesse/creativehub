/**
 * The two pieces of `PageMeta` worth testing on their own: the text a results
 * page shows, and the one script element a template writes by hand.
 */

/**
 * A description cut to what a results page shows.
 *
 * Search engines stop at around 160 characters. Cutting at the last space
 * before that, with an ellipsis, reads better than a word cut in half — unless
 * the last space is so early that most of the sentence would go.
 */
export function metaSummary(text: string | null | undefined, limit = 160): string {
	const flat = (text ?? '').replace(/\s+/g, ' ').trim();
	if (flat.length <= limit) return flat;
	const cut = flat.slice(0, limit - 3);
	const space = cut.lastIndexOf(' ');
	return `${space > limit * 0.6 ? cut.slice(0, space) : cut}…`;
}

/**
 * A schema.org object as a complete `<script type="application/ld+json">` tag.
 *
 * `JSON.stringify` escapes the quotes and backslashes a creator's bio may
 * contain. `<` is escaped after it, so no value — `</script>` in a bio, say —
 * can close the element early and have what follows run as markup. U+2028 and
 * U+2029 are escaped too: valid inside a JSON string, line terminators to an
 * older JavaScript parser.
 */
export function jsonLdScript(data: Record<string, unknown>): string {
	const json = JSON.stringify(data)
		.replace(/</g, '\\u003c')
		.replaceAll(String.fromCharCode(0x2028), '\\u2028')
		.replaceAll(String.fromCharCode(0x2029), '\\u2029');
	return `<script type="application/ld+json">${json}</` + `script>`;
}
