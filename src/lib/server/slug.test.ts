import { describe, it, expect } from 'vitest';
import { slugify } from './slug';

/* `uniqueSlug` is not covered here: it is a database round trip, which is what
   the Playwright suite is for. This is the half that is pure. */
describe('slugify', () => {
	it('lowercases and joins words with hyphens', () => {
		expect(slugify('Telebirr SuperApp 5G Launch')).toBe('telebirr-superapp-5g-launch');
	});

	it('collapses punctuation rather than encoding it', () => {
		expect(slugify('What now? — a guide (2026)')).toBe('what-now-a-guide-2026');
	});

	it('never leaves a leading or trailing hyphen', () => {
		expect(slugify('  ...Hello!  ')).toBe('hello');
	});

	/* A title in Ge'ez reduces to nothing, and an empty slug would make the
	   permalink the index page. The fallback keeps it opaque but linkable. */
	it('falls back when nothing survives', () => {
		expect(slugify('የፈጣሪ ኢኮኖሚ', 'post')).toBe('post');
		expect(slugify('')).toBe('item');
	});

	it('stays inside the column, without a hyphen left dangling', () => {
		const slug = slugify('word '.repeat(200));
		expect(slug.length).toBeLessThanOrEqual(240);
		expect(slug.endsWith('-')).toBe(false);
	});
});
