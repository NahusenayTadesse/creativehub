import { describe, it, expect } from 'vitest';
import {
	avatarUrlOf,
	categoriesFor,
	mapCreatorRow,
	mapCreatorRows,
	parseCount,
	parseRate,
	profileUrlFor,
	toUsername,
	type CsvRow
} from './creator-import';

/** A row in the shape the export produces, overridable field by field. */
const row = (overrides: Partial<CsvRow> = {}): CsvRow => ({
	Name: 'K Money',
	Country: 'Ethiopia',
	'State/Province/Region': 'Addis Ababa',
	City: 'Addis Ababa',
	'Bio / Focus': 'Creator focused on lifestyle / culture / travel.',
	'Primary Platform': 'TikTok',
	'Primary Handle': '@KmoneyinEthiopia',
	'Instagram Handle': '@K_Moneyyy1',
	'Instagram Followers': '60,000',
	'TikTok Handle': '@KmoneyinEthiopia',
	'TikTok Followers': '300,000',
	'YouTube Handle': 'KmoneyTooClever',
	'YouTube Subscribers': '45,000',
	'Other Socials': '',
	'Combined Audience Proxy': '405,000',
	'Average Views / Reach Metric': '',
	'Engagement Rate': '',
	'Starting Price': '',
	Currency: 'ETB',
	'Pricing Status': 'Request quote / not publicly verified',
	'Avatar URL': 'https://kmoneyinethiopia.com/kmoney.jpg',
	'Cover URL': '',
	'Primary Profile URL': 'https://www.tiktok.com/@KmoneyinEthiopia',
	'Source URL': 'https://kmoneyinethiopia.com/',
	'Source Updated': '2026-05',
	Notes: 'First-party creator site; 300K+ TikTok, 60K+ Instagram, 45K+ YouTube. Custom quote only.',
	...overrides
});

describe('field parsing', () => {
	it('reads grouped numbers and refuses to produce NaN', () => {
		expect(parseCount('10,300,000')).toBe(10_300_000);
		expect(parseCount('')).toBe(0);
		expect(parseCount(undefined)).toBe(0);
		expect(parseCount('n/a')).toBe(0);
	});

	it('reads a percentage into the 0–100 the column accepts', () => {
		expect(parseRate('21.02%')).toBe(21.02);
		expect(parseRate('0.20%')).toBe(0.2);
		expect(parseRate('')).toBe(0);
		expect(parseRate('900%')).toBe(100);
	});

	it('turns a handle into a username the profile URL can carry', () => {
		expect(toUsername('@KmoneyinEthiopia')).toBe('kmoneyinethiopia');
		expect(toUsername('cuisine_halima__filali')).toBe('cuisine_halima__filali');
		expect(toUsername('@ifys.kitchen')).toBe('ifys.kitchen');
		/* The same `^[a-z0-9_.]+$` the admin form enforces. */
		expect(toUsername('@Chef Néné!')).toBe('chefnn');
	});

	it('builds profile URLs per platform and skips the ones it cannot', () => {
		expect(profileUrlFor('Instagram', '@nuruvazi01')).toBe('https://www.instagram.com/nuruvazi01/');
		expect(profileUrlFor('TikTok', 'napiofficial27')).toBe(
			'https://www.tiktok.com/@napiofficial27'
		);
		expect(profileUrlFor('YouTube', 'NURUVAZI')).toBe('https://www.youtube.com/@NURUVAZI');
		expect(profileUrlFor('Snapchat', 'maimaher777')).toBeNull();
		expect(profileUrlFor('TikTok', '  ')).toBeNull();
	});
});

describe('categoriesFor', () => {
	it('maps each focus term to a seeded category slug', () => {
		expect(categoriesFor('Creator focused on food / travel.').slugs).toEqual([
			'food-dining',
			'travel-tourism'
		]);
	});

	it('falls back to the words of a phrase it does not know whole', () => {
		expect(categoriesFor('Creator focused on food / family lifestyle.').slugs).toEqual([
			'food-dining',
			'lifestyle'
		]);
		expect(categoriesFor('Creator focused on lifestyle short-form.').slugs).toEqual([
			'lifestyle',
			'entertainment'
		]);
	});

	it('does not repeat a slug two terms share', () => {
		expect(categoriesFor('Creator focused on food / restaurants / catering.').slugs).toEqual([
			'food-dining'
		]);
	});

	it('reports a term it cannot place instead of guessing', () => {
		const { slugs, unmapped } = categoriesFor('Creator focused on beekeeping.');
		expect(slugs).toEqual([]);
		expect(unmapped).toEqual(['beekeeping']);
	});
});

describe('avatarUrlOf', () => {
	it('reads the column the newer export uses', () => {
		expect(avatarUrlOf({ 'Avatar / Profile Image URL': 'https://unavatar.io/tiktok/x' })).toBe(
			'https://unavatar.io/tiktok/x'
		);
	});

	it('still reads the name the first export used', () => {
		expect(avatarUrlOf({ 'Avatar URL': 'https://example.test/a.jpg' })).toBe(
			'https://example.test/a.jpg'
		);
	});

	it('prefers the newer column when a row somehow carries both', () => {
		expect(
			avatarUrlOf({
				'Avatar / Profile Image URL': 'https://unavatar.io/tiktok/x',
				'Avatar URL': 'https://example.test/old.jpg'
			})
		).toBe('https://unavatar.io/tiktok/x');
	});

	it('falls through an empty newer column to the older one', () => {
		expect(
			avatarUrlOf({
				'Avatar / Profile Image URL': '  ',
				'Avatar URL': 'https://example.test/a.jpg'
			})
		).toBe('https://example.test/a.jpg');
	});

	it('is null when there is no avatar at all', () => {
		expect(avatarUrlOf({})).toBeNull();
		expect(avatarUrlOf({ 'Avatar / Profile Image URL': '' })).toBeNull();
	});
});

describe('mapCreatorRow', () => {
	it('takes the avatar from the renamed column', () => {
		const mapped = mapCreatorRow(
			row({ 'Avatar URL': '', 'Avatar / Profile Image URL': 'https://unavatar.io/tiktok/kmoney' }),
			0
		);
		expect(mapped.creator.avatar).toBe('https://unavatar.io/tiktok/kmoney');
	});

	it('fills the creators row from the CSV', () => {
		const { creator } = mapCreatorRow(row(), 0);
		expect(creator).toMatchObject({
			username: 'kmoneyinethiopia',
			fullName: 'K Money',
			country: 'ET',
			region: 'Addis Ababa',
			city: 'Addis Ababa',
			primaryPlatform: 'TikTok',
			totalReach: 405_000,
			currencyCode: 'ETB',
			avatar: 'https://kmoneyinethiopia.com/kmoney.jpg',
			cover: null
		});
	});

	it('leaves an unquoted price at 0 and keeps the pricing status out of the row', () => {
		const { creator, source } = mapCreatorRow(row(), 0);
		expect(creator.startingPrice).toBe(0);
		expect(source.pricingStatus).toBe('Request quote / not publicly verified');
	});

	it('imports unverified, unclaimed and unpublished', () => {
		const { creator } = mapCreatorRow(row(), 3);
		expect(creator.verificationLevel).toBe('unverified');
		expect(creator.isPublished).toBe(false);
		expect(creator.isClaimed).toBe(false);
		expect(creator.isFeatured).toBe(false);
		expect(creator.isActive).toBe(true);
		expect(creator.sortOrder).toBe(3);
	});

	it('keeps the scrape notes off the public bio', () => {
		const mapped = mapCreatorRow(
			row({ Notes: 'Source bio reports 770K+ TikTok but does not expose the handle.' }),
			0
		);
		expect(mapped.creator.bio).toBe('Creator focused on lifestyle / culture / travel.');
		expect(mapped.source.notes).toContain('does not expose the handle');
	});

	it('never puts the source it was scraped from on the public profile', () => {
		const { creator, source } = mapCreatorRow(row(), 0);
		expect(creator.bio).not.toContain('kmoneyinethiopia.com/');
		expect(source.sourceUrl).toBe('https://kmoneyinethiopia.com/');
		expect(source.sourceUpdated).toBe('2026-05');
	});

	it('fans the platform columns out into one social account each', () => {
		const { socials } = mapCreatorRow(row({ 'Engagement Rate': '12.5%' }), 0);
		expect(socials.map((s) => [s.platform, s.followers])).toEqual([
			['Instagram', 60_000],
			['TikTok', 300_000],
			['YouTube', 45_000]
		]);
		/* One engagement figure per creator, so it lands on the account that
		   produced it rather than being copied onto all three. */
		expect(socials.find((s) => s.platform === 'TikTok')?.engagementRate).toBe(12.5);
		expect(socials.find((s) => s.platform === 'Instagram')?.engagementRate).toBe(0);
		expect(socials.find((s) => s.platform === 'TikTok')?.profileUrl).toBe(
			'https://www.tiktok.com/@KmoneyinEthiopia'
		);
		expect(socials.find((s) => s.platform === 'Instagram')?.profileUrl).toBe(
			'https://www.instagram.com/K_Moneyyy1/'
		);
	});

	it('reuses the primary handle when a platform reports followers without one', () => {
		const mapped = mapCreatorRow(
			row({
				'Primary Handle': '@shegergebeta',
				'TikTok Handle': '',
				'TikTok Followers': '770,000'
			}),
			0
		);
		expect(mapped.socials.find((s) => s.platform === 'TikTok')).toMatchObject({
			handle: '@shegergebeta',
			followers: 770_000
		});
		expect(mapped.warnings.some((w) => w.includes('no handle'))).toBe(true);
	});

	it('reads the overflow column and drops platforms with no row to point at', () => {
		const mapped = mapCreatorRow(
			row({
				'Instagram Handle': '@maimaher',
				'TikTok Handle': '',
				'TikTok Followers': '',
				'YouTube Handle': '',
				'YouTube Subscribers': '',
				'Other Socials': 'Facebook: maimaher; TikTok: @maimaherrr7; Snapchat: maimaher777'
			}),
			0
		);
		expect(mapped.socials.map((s) => s.platform)).toEqual(['Instagram', 'Facebook', 'TikTok']);
		expect(mapped.warnings.some((w) => w.includes('Snapchat'))).toBe(true);
	});

	it('does not add a second account for a platform the columns already covered', () => {
		const mapped = mapCreatorRow(row({ 'Other Socials': 'YouTube: NURUVAZI' }), 0);
		expect(mapped.socials.filter((s) => s.platform === 'YouTube')).toHaveLength(1);
	});

	it('scores an unverified profile with no rate card below a seeded one', () => {
		const { creator } = mapCreatorRow(row(), 0);
		expect(creator.score).toBeGreaterThanOrEqual(10);
		expect(creator.score).toBeLessThan(60);
	});
});

describe('mapCreatorRows', () => {
	it('rejects a row it cannot key, and keeps the rest', () => {
		const result = mapCreatorRows([
			row(),
			row({ Name: 'Nowhere', Country: 'Atlantis', 'Primary Handle': '@nowhere' }),
			row({ Name: 'Same Handle Again' })
		]);
		expect(result.creators.map((c) => c.creator.username)).toEqual(['kmoneyinethiopia']);
		expect(result.rejected).toEqual([
			{ name: 'Nowhere', reason: 'unknown country "Atlantis"' },
			{ name: 'Same Handle Again', reason: 'duplicate username "kmoneyinethiopia"' }
		]);
	});

	it('collects the regions the rows imply, with their cities', () => {
		const result = mapCreatorRows([
			row(),
			row({
				Name: 'Bahir Dar Creator',
				'Primary Handle': '@bahirdar',
				'State/Province/Region': 'Amhara',
				City: 'Bahir Dar'
			}),
			row({
				Name: 'No Region',
				'Primary Handle': '@noregion',
				'State/Province/Region': '',
				City: ''
			})
		]);
		expect(result.regions).toEqual({
			ET: [
				{ name: 'Addis Ababa', majorCities: ['Addis Ababa'] },
				{ name: 'Amhara', majorCities: ['Bahir Dar'] }
			]
		});
		expect(result.creators[2].creator.region).toBeNull();
	});
});
