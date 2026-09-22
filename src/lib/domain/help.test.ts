import { describe, expect, it } from 'vitest';
import {
	HELP_QUICK_LINKS,
	HELP_SLUGS,
	filterByAudience,
	helpArticle,
	helpArticles,
	helpAudience,
	searchHelp
} from './help';

describe('the help catalogue', () => {
	it('has a unique slug for every article', () => {
		expect(new Set(HELP_SLUGS).size).toBe(HELP_SLUGS.length);
	});

	it('resolves every slug to an article, and nothing else', () => {
		for (const slug of HELP_SLUGS) expect(helpArticle(slug)?.slug).toBe(slug);
		expect(helpArticle('no-such-article')).toBeNull();
	});

	/* The index offers these before a reader searches, so a typo in one would
	   silently drop a card rather than fail. */
	it('points every quick link at a real article', () => {
		for (const slug of HELP_QUICK_LINKS) expect(HELP_SLUGS).toContain(slug);
	});

	it('gives every article prose to render', () => {
		for (const article of helpArticles()) {
			expect(article.title.length).toBeGreaterThan(0);
			expect(article.summary.length).toBeGreaterThan(0);
			expect(article.blocks.length).toBeGreaterThan(0);
		}
	});
});

describe('filtering by audience', () => {
	it('keeps one side plus what is for everybody', () => {
		const brands = filterByAudience(helpArticles(), 'brands');
		expect(brands.some((article) => article.audience === 'brands')).toBe(true);
		expect(brands.some((article) => article.audience === 'everyone')).toBe(true);
		expect(brands.some((article) => article.audience === 'creators')).toBe(false);
	});

	it('reads an unknown side as no filter at all', () => {
		expect(helpAudience('creators')).toBe('creators');
		expect(helpAudience('nonsense')).toBeNull();
		expect(helpAudience(null)).toBeNull();
		expect(filterByAudience(helpArticles(), helpAudience('nonsense'))).toHaveLength(
			HELP_SLUGS.length
		);
	});
});

describe('searching', () => {
	const all = helpArticles();

	it('returns everything for an empty query', () => {
		expect(searchHelp(all, '   ')).toHaveLength(all.length);
	});

	it('matches words the prose never says, from the keywords', () => {
		expect(searchHelp(all, 'telebirr').map((one) => one.slug)).toContain('pay-a-deposit');
	});

	it('narrows rather than widens as words are added', () => {
		const one = searchHelp(all, 'profile');
		const two = searchHelp(all, 'profile claim');
		expect(two.length).toBeLessThan(one.length);
		expect(two.length).toBeGreaterThan(0);
	});

	it('ignores case and finds nothing for gibberish', () => {
		expect(searchHelp(all, 'DEPOSIT').length).toBeGreaterThan(0);
		expect(searchHelp(all, 'zzzzq')).toHaveLength(0);
	});
});
