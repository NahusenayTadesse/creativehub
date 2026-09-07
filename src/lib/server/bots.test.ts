import { describe, it, expect } from 'vitest';
import { classifyAgent, DISALLOWED_ROBOTS } from './bots';

/**
 * The cost of getting this wrong is asymmetric, so the tests are too. A
 * harvester slipping through costs a slice of the directory; a real browser
 * classified as one costs a reader the site. Most of what follows is the
 * second kind — the strings that must *not* be refused.
 */
describe('classifyAgent', () => {
	it('refuses the training and dataset crawlers', () => {
		for (const ua of [
			'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot',
			'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
			'CCBot/2.0 (https://commoncrawl.org/faq/)',
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) PerplexityBot/1.0',
			'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)',
			'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
			'Scrapy/2.11.0 (+https://scrapy.org)',
			'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.0) HTTrack 3.0'
		]) {
			expect(classifyAgent(ua), ua).toBe('harvester');
		}
	});

	it('separates Applebot from Applebot-Extended, which differ only in what they take', () => {
		expect(classifyAgent('Mozilla/5.0 (compatible; Applebot/0.1)')).toBe('search');
		expect(classifyAgent('Mozilla/5.0 (compatible; Applebot-Extended/0.1)')).toBe('harvester');
	});

	it('lets the search engines that send readers back through', () => {
		for (const ua of [
			'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
			'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116 Safari/537.36',
			'Mozilla/5.0 (compatible; DuckDuckBot-Https/1.1; https://duckduckgo.com/duckduckbot)',
			'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)'
		]) {
			expect(classifyAgent(ua), ua).toBe('search');
		}
	});

	it('lets link unfurlers through, because somebody pasted a profile somewhere', () => {
		expect(classifyAgent('Twitterbot/1.0')).toBe('preview');
		expect(classifyAgent('facebookexternalhit/1.1')).toBe('preview');
		expect(classifyAgent('WhatsApp/2.23.20.0')).toBe('preview');
		expect(classifyAgent('Mozilla/5.0 (compatible; Discordbot/2.0)')).toBe('preview');
	});

	it('throttles rather than refuses the tools an operator might be holding', () => {
		/* `curl` is what this app's own deploy script smoke-tests with. */
		expect(classifyAgent('curl/8.5.0')).toBe('tool');
		expect(classifyAgent('python-requests/2.31.0')).toBe('tool');
		expect(classifyAgent('Go-http-client/2.0')).toBe('tool');
		/* SEO crawlers read everything and send nobody, but they are frequently
		   the site's own tooling — a small budget, not a closed door. */
		expect(classifyAgent('Mozilla/5.0 (compatible; AhrefsBot/7.0)')).toBe('tool');
		expect(classifyAgent('Mozilla/5.0 (compatible; SemrushBot/7~bl)')).toBe('tool');
	});

	it('treats anything self-describing as a crawler as one, named here or not', () => {
		expect(classifyAgent('Mozilla/5.0 (compatible; SomeNewCrawler/1.0)')).toBe('tool');
		expect(classifyAgent('ExampleSpider/0.9')).toBe('tool');
	});

	it('counts a missing user agent as automation, not as a browser', () => {
		expect(classifyAgent(null)).toBe('tool');
		expect(classifyAgent('')).toBe('tool');
		expect(classifyAgent('   ')).toBe('tool');
	});

	it('leaves real browsers alone', () => {
		for (const ua of [
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
			'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1',
			'Mozilla/5.0 (Linux; Android 13; SM-A martin) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
			'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
			/* Opera Mini and UC Browser carry weight in this market. */
			'Opera/9.80 (Android; Opera Mini/78.0.2254/191.303; U; en) Presto/2.12.423 Version/12.16',
			'Mozilla/5.0 (Linux; U; Android 11; en-US) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.58 UCBrowser/13.4.0.1306 Mobile Safari/537.36'
		]) {
			expect(classifyAgent(ua), ua).toBe('browser');
		}
	});
});

describe('DISALLOWED_ROBOTS', () => {
	/*
	 * The point of the pairing is that a crawler is never refused at the door
	 * without having been asked politely first. If a token here does not match
	 * the substrings `classifyAgent` refuses, robots.txt is telling one story
	 * and the server another.
	 */
	it('names only agents the server actually refuses', () => {
		for (const token of DISALLOWED_ROBOTS) {
			expect(classifyAgent(`Mozilla/5.0 (compatible; ${token}/1.0)`), token).toBe('harvester');
		}
	});
});
