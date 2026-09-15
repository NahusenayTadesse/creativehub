import { describe, expect, it } from 'vitest';
import { jsonLdScript, metaSummary } from './seo';

describe('metaSummary', () => {
	it('leaves a short description alone, whitespace folded', () => {
		expect(metaSummary('  Sketch comedy\n about   Addis life. ')).toBe(
			'Sketch comedy about Addis life.'
		);
	});

	it('cuts a long one at a space, with an ellipsis, inside the limit', () => {
		const long = 'word '.repeat(60);
		const summary = metaSummary(long);
		expect(summary.length).toBeLessThanOrEqual(160);
		expect(summary.endsWith('word…')).toBe(true);
	});

	it('cuts mid-word rather than losing most of a sentence to one long word', () => {
		const summary = metaSummary(`Short ${'x'.repeat(300)}`);
		expect(summary.length).toBe(158);
		expect(summary.startsWith('Short x')).toBe(true);
	});

	it('is empty for nothing', () => {
		expect(metaSummary(null)).toBe('');
	});
});

describe('jsonLdScript', () => {
	const hostile = {
		'@type': 'Person',
		description: 'Nice bio </script><script>alert(1)</script> and "quotes" \\ done',
		name: `line${String.fromCharCode(0x2028)}separator`
	};

	it('cannot be closed early by anything inside a value', () => {
		const tag = jsonLdScript(hostile);
		const body = tag.slice(tag.indexOf('>') + 1, tag.lastIndexOf('</script>'));
		expect(body).not.toMatch(/<\/?script/i);
		expect(body).not.toContain('<');
		expect(tag.match(/<\/script>/g)).toHaveLength(1);
	});

	it('still parses back to exactly the data it was given', () => {
		const tag = jsonLdScript(hostile);
		const body = tag.slice(tag.indexOf('>') + 1, tag.lastIndexOf('</script>'));
		expect(JSON.parse(body)).toEqual(hostile);
	});

	it('leaves no raw line separators in the output', () => {
		const tag = jsonLdScript(hostile);
		expect(tag).not.toContain(String.fromCharCode(0x2028));
	});
});
