import { describe, expect, it } from 'vitest';
import { LANDING_SECTIONS, heroHeadline, landingLayout } from './landing';

const keys = (layout: { key: string }[]) => layout.map((section) => section.key);

describe('landingLayout', () => {
	it('is the shipped order, everything shown, when nothing is stored', () => {
		expect(landingLayout(null)).toEqual(LANDING_SECTIONS.map((key) => ({ key, visible: true })));
	});

	it('keeps the stored order and visibility', () => {
		const stored = ['categories', 'gallery', 'trending', 'howItWorks', 'compensation'];
		const layout = landingLayout([
			{ key: 'categories', visible: true },
			{ key: 'gallery', visible: false },
			{ key: 'trending', visible: true },
			{ key: 'howItWorks', visible: true },
			{ key: 'compensation', visible: false }
		]);
		/* Only the stored ones are asserted here, in the order they were saved.
		   Where sections shipped since are placed is the next tests' subject —
		   spelling the whole list out again would fail on every section added. */
		expect(keys(layout).filter((key) => stored.includes(key))).toEqual(stored);
		expect(layout.filter((section) => !section.visible).map((s) => s.key)).toEqual([
			'gallery',
			'compensation'
		]);
	});

	it('reads the text a MariaDB JSON column comes back as', () => {
		expect(keys(landingLayout('[{"key":"trending","visible":false}]'))[0]).toBe('trending');
		expect(landingLayout('not json')).toEqual(landingLayout(null));
	});

	/* A section shipped after the operator last saved should appear, not vanish. */
	it('adds a section the saved list never mentioned, shown, after its shipped neighbour', () => {
		const layout = landingLayout([{ key: 'trending', visible: false }]);
		expect(keys(layout)).toEqual([
			'trending',
			...LANDING_SECTIONS.filter((key) => key !== 'trending')
		]);
		expect(layout.slice(1).every((section) => section.visible)).toBe(true);
	});

	it('puts a new section between the two it shipped between', () => {
		const stored = LANDING_SECTIONS.filter((key) => key !== 'creators').map((key) => ({
			key,
			visible: true
		}));
		const layout = keys(landingLayout(stored.reverse()));
		expect(layout.indexOf('creators')).toBe(layout.indexOf('trending') + 1);
	});

	it('appends a new section with no stored neighbour before it', () => {
		const layout = keys(landingLayout([{ key: 'blog', visible: true }]));
		expect(layout[0]).toBe('blog');
		expect(layout).toHaveLength(LANDING_SECTIONS.length);
		expect(new Set(layout).size).toBe(LANDING_SECTIONS.length);
	});

	it('drops unknown keys and repeats', () => {
		const layout = landingLayout([
			{ key: 'pricing', visible: true },
			{ key: 'gallery', visible: false },
			{ key: 'gallery', visible: true }
		]);
		expect(keys(layout).filter((key) => key === 'gallery')).toHaveLength(1);
		expect(keys(layout)).not.toContain('pricing');
		expect(layout.find((section) => section.key === 'gallery')).toEqual({
			key: 'gallery',
			visible: false
		});
	});
});

describe('heroHeadline', () => {
	it('uses the translated copy when no line is set', () => {
		const headline = heroHeadline({ heroTitle: '', heroAccent: '  ', heroTitleEnd: '' });
		expect(headline.title).not.toBe('');
		expect(headline.accent).not.toBe('');
		expect(headline.end).toBe('');
	});

	it('overrides every line together, even with only one typed', () => {
		expect(heroHeadline({ heroTitle: 'Book creators', heroAccent: '' })).toEqual({
			title: 'Book creators',
			accent: '',
			end: ''
		});
		expect(
			heroHeadline({ heroTitle: 'Book', heroAccent: 'Ethiopian creators', heroTitleEnd: 'today.' })
		).toEqual({ title: 'Book', accent: 'Ethiopian creators', end: 'today.' });
		expect(heroHeadline({ heroTitleEnd: 'today.' })).toEqual({
			title: '',
			accent: '',
			end: 'today.'
		});
	});
});
