import { describe, it, expect } from 'vitest';
import { isExempt, looksAutomated, normaliseAddress, tierFor } from './bot-defence';
import { classifyAgent } from './bots';

const CHROME =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** What a browser actually sends when a person clicks a link. */
const navigation = (extra: Record<string, string> = {}) =>
	new Headers({
		'user-agent': CHROME,
		'accept-language': 'en-GB,en;q=0.9',
		'sec-fetch-site': 'none',
		'sec-fetch-mode': 'navigate',
		'sec-fetch-dest': 'document',
		...extra
	});

const tier = (pathname: string, headers: Headers) =>
	tierFor(pathname, headers, classifyAgent(headers.get('user-agent')));

describe('normaliseAddress', () => {
	it('keeps an IPv4 address as itself', () => {
		expect(normaliseAddress('196.188.1.24')).toBe('196.188.1.24');
	});

	it('drops the port some proxies append', () => {
		expect(normaliseAddress('196.188.1.24:51823')).toBe('196.188.1.24');
		expect(normaliseAddress('[2001:db8:abcd:1234::1]:443')).toBe('2001:db8:abcd:1234::/64');
	});

	it('unwraps the IPv4-mapped form Node hands back', () => {
		expect(normaliseAddress('::ffff:196.188.1.24')).toBe('196.188.1.24');
	});

	/*
	 * The reason this is not simply the address. A subscriber is routinely
	 * given a whole /64 and often more, so limiting one v6 address limits
	 * nothing: the next request comes from a different one at no cost. Two
	 * addresses in the same allocation have to spend the same budget.
	 */
	it('holds an entire IPv6 /64 to one budget', () => {
		const first = normaliseAddress('2001:db8:abcd:1234:5678:90ab:cdef:1');
		const second = normaliseAddress('2001:db8:abcd:1234:ffff:ffff:ffff:ffff');
		expect(first).toBe(second);
		expect(normaliseAddress('2001:db8:abcd:9999::1')).not.toBe(first);
	});
});

describe('isExempt', () => {
	/*
	 * These three are the ways this defence could take the site down instead of
	 * protecting it: a throttled health check reads as a dead app, a throttled
	 * `/files` is a grid of creators with no faces, and a throttled webhook is a
	 * paid booking stuck in escrow.
	 */
	it('never counts the traffic that is meant to look robotic', () => {
		expect(isExempt('/health')).toBe(true);
		expect(isExempt('/files/avatar-1a2b.webp')).toBe(true);
		expect(isExempt('/api/chapa/webhook')).toBe(true);
	});

	it('counts the pages worth taking', () => {
		expect(isExempt('/discover')).toBe(false);
		expect(isExempt('/creators/selam-t')).toBe(false);
		expect(isExempt('/sitemap.xml')).toBe(false);
	});
});

describe('looksAutomated', () => {
	it('accepts a browser navigation as a person reading', () => {
		expect(looksAutomated(navigation(), 'browser')).toBe(false);
	});

	/*
	 * Safari only began sending Sec-Fetch-* in 16.4, and this market runs older
	 * iPhones. Missing fetch metadata alone must not cost a real reader their
	 * budget — Accept-Language is the second opinion, and every browser ever
	 * shipped sends one.
	 */
	it('accepts a browser too old to send fetch metadata', () => {
		const old = new Headers({
			'user-agent':
				'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1',
			'accept-language': 'am-ET,am;q=0.9'
		});
		expect(looksAutomated(old, 'browser')).toBe(false);
	});

	it('judges a request carrying neither signal to be automation', () => {
		const bare = new Headers({ 'user-agent': CHROME });
		expect(looksAutomated(bare, 'browser')).toBe(true);
	});

	it('takes a named tool at its word', () => {
		expect(looksAutomated(new Headers({ 'user-agent': 'curl/8.5.0' }), 'tool')).toBe(true);
	});

	it('does not penalise crawlers that are wanted for lacking browser habits', () => {
		const googlebot = new Headers({
			'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
		});
		expect(looksAutomated(googlebot, 'search')).toBe(false);
		expect(looksAutomated(new Headers({ 'user-agent': 'Twitterbot/1.0' }), 'preview')).toBe(false);
	});
});

describe('tierFor', () => {
	it('gives a reader browsing the directory the generous budget', () => {
		expect(tier('/discover', navigation())).toBe('page');
		expect(tier('/creators/selam-t', navigation())).toBe('page');
	});

	/*
	 * A client-side navigation inside the app fetches the same payload as JSON.
	 * That is a page view, and charging it as bulk collection would throttle
	 * ordinary browsing after the first few clicks.
	 */
	it('charges the app fetching its own data as a page view', () => {
		const clientNav = navigation({ 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors' });
		expect(tier('/discover/__data.json', clientNav)).toBe('page');
	});

	it('charges the same JSON asked for directly as bulk collection', () => {
		const direct = new Headers({ 'user-agent': CHROME, 'accept-language': 'en' });
		expect(tier('/discover/__data.json', direct)).toBe('structured');
		expect(tier('/creators/selam-t/reviews', direct)).toBe('structured');
		expect(tier('/sitemap.xml', direct)).toBe('structured');
		expect(tier('/blog/rss.xml', direct)).toBe('structured');
	});

	it('puts a scraper wearing a browser name on the smallest budget', () => {
		const spoofed = new Headers({ 'user-agent': CHROME });
		expect(tier('/discover', spoofed)).toBe('automation');
		expect(tier('/creators/selam-t', spoofed)).toBe('automation');
	});

	it('puts a named tool on the smallest budget wherever it asks', () => {
		const curl = new Headers({ 'user-agent': 'python-requests/2.31.0' });
		expect(tier('/discover', curl)).toBe('automation');
		expect(tier('/discover/__data.json', curl)).toBe('automation');
	});
});
