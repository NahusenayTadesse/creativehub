import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicProfile, fetchablePlatform } from './index';
import { parseSubscriberCount } from './youtube';
import { parseMemberCount } from './telegram';
import type { ProfileFetcher } from './types';

/* The failure reason is logged, deliberately and on purpose; the tests below
   exercise a lot of failures and the log is not what is under test. */
beforeEach(() => void vi.spyOn(console, 'warn').mockImplementation(() => {}));

/** A `fetch` that answers once, and records the URL and headers it was given. */
function fakeFetch(status: number, body: string) {
	const calls: { url: string; headers: Record<string, string> }[] = [];
	const impl = (async (input: string | URL | Request, init?: RequestInit) => {
		calls.push({ url: String(input), headers: (init?.headers ?? {}) as Record<string, string> });
		return new Response(body, { status });
	}) as ProfileFetcher;
	return { impl, calls };
}

const deadFetch = (async () => {
	throw new Error('socket hang up');
}) as ProfileFetcher;

/* ------------------------------------------------------------------ *
 * Instagram
 * ------------------------------------------------------------------ */

describe('instagram', () => {
	const body = JSON.stringify({
		data: { user: { edge_followed_by: { count: 98_432 }, biography: 'Addis · CN-4F7K' } }
	});

	it('reads the follower count and the bio', async () => {
		const { impl, calls } = fakeFetch(200, body);
		const result = await fetchPublicProfile('Instagram', '@Nuru', impl);

		expect(result).toEqual({ ok: true, followers: 98_432, bio: 'Addis · CN-4F7K' });
		/* Lower-cased, and carrying the web client's app id — without that header
		   the endpoint does not answer at all. */
		expect(calls[0].url).toContain('username=nuru');
		expect(calls[0].headers['x-ig-app-id']).toBe('936619743392459');
	});

	it('reports the login wall as an ordinary failure, not an error', async () => {
		/* What the endpoint really answers from this server, verbatim. */
		const wall = JSON.stringify({ message: 'Please wait', require_login: true, status: 'fail' });
		const { impl } = fakeFetch(401, wall);
		await expect(fetchPublicProfile('instagram', 'nasa', impl)).resolves.toEqual({
			ok: false,
			reason: 'http_401'
		});
	});

	it('treats a 200 that is not JSON as a failure', async () => {
		const { impl } = fakeFetch(200, '<!DOCTYPE html><title>Login</title>');
		await expect(fetchPublicProfile('instagram', 'nasa', impl)).resolves.toEqual({
			ok: false,
			reason: 'not_json'
		});
	});

	it('does not invent a count when the shape changes under it', async () => {
		const { impl } = fakeFetch(200, JSON.stringify({ data: { user: { biography: 'hi' } } }));
		await expect(fetchPublicProfile('instagram', 'nasa', impl)).resolves.toEqual({
			ok: false,
			reason: 'no_follower_count'
		});
	});
});

/* ------------------------------------------------------------------ *
 * TikTok — the public page, not the creator's OAuth grant
 * ------------------------------------------------------------------ */

describe('tiktok', () => {
	const page = (scope: unknown) =>
		`<!DOCTYPE html><html><body><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(scope)}</script></body></html>`;

	it('reads the count and the signature out of the hydration blob', async () => {
		const { impl } = fakeFetch(
			200,
			page({
				__DEFAULT_SCOPE__: {
					'webapp.user-detail': {
						statusCode: 0,
						userInfo: { stats: { followerCount: 1_200_000 }, user: { signature: 'CN-4F7K' } }
					}
				}
			})
		);
		await expect(fetchPublicProfile('TikTok', 'mrbeast', impl)).resolves.toEqual({
			ok: true,
			followers: 1_200_000,
			bio: 'CN-4F7K'
		});
	});

	it('reports the WAF interstitial for what it is', async () => {
		/* 200, 1.4 KB, no hydration blob — the page this server is really served. */
		const { impl } = fakeFetch(200, '<!DOCTYPE html><script id="slardar-config">{}</script>');
		await expect(fetchPublicProfile('tiktok', 'mrbeast', impl)).resolves.toEqual({
			ok: false,
			reason: 'no_embedded_json'
		});
	});

	it('refuses a non-zero status rather than reading the empty shape behind it', async () => {
		const { impl } = fakeFetch(
			200,
			page({ __DEFAULT_SCOPE__: { 'webapp.user-detail': { statusCode: 10221 } } })
		);
		await expect(fetchPublicProfile('tiktok', 'nobody-at-all', impl)).resolves.toEqual({
			ok: false,
			reason: 'status_10221'
		});
	});
});

/* ------------------------------------------------------------------ *
 * YouTube
 * ------------------------------------------------------------------ */

describe('youtube', () => {
	const page = (data: unknown) =>
		`<!DOCTYPE html><html><body><script>var ytInitialData = ${JSON.stringify(data)};</script></body></html>`;

	const channel = (subscribers: string | null, description: string) => ({
		metadata: { channelMetadataRenderer: { description, title: 'MKBHD' } },
		header: {
			pageHeaderRenderer: {
				content: {
					pageHeaderViewModel: {
						metadata: {
							contentMetadataViewModel: {
								metadataRows: [
									{ metadataParts: [{ text: { content: '@mkbhd' } }] },
									...(subscribers
										? [
												{
													metadataParts: [
														{ text: { content: subscribers } },
														{ text: { content: '1.8K videos' } }
													]
												}
											]
										: [])
								]
							}
						}
					}
				}
			}
		}
	});

	it('reads the description and the rounded subscriber count', async () => {
		const { impl } = fakeFetch(200, page(channel('21.3M subscribers', 'Tech · CN-4F7K')));
		await expect(fetchPublicProfile('YouTube', 'mkbhd', impl)).resolves.toEqual({
			ok: true,
			followers: 21_300_000,
			bio: 'Tech · CN-4F7K'
		});
	});

	it('succeeds with a null count when the channel hides its subscribers', async () => {
		/* Proved but uncounted: the code can still be found, so this must not be a
		   failure — it is the creator typing one number in, not starting again. */
		const { impl } = fakeFetch(200, page(channel(null, 'CN-4F7K')));
		await expect(fetchPublicProfile('youtube', 'mkbhd', impl)).resolves.toEqual({
			ok: true,
			followers: null,
			bio: 'CN-4F7K'
		});
	});

	it('never reads a sidebar channel’s count as the creator’s own', async () => {
		/* The real page carries shelves of other channels, each with a
		   `subscriberCountText`. Reading the first match in the document would
		   report a stranger's audience as this creator's. */
		const data = channel('21.3M subscribers', 'CN-4F7K');
		const html = page(data).replace(
			'</script>',
			'</script><script>{"subscriberCountText":{"simpleText":"1.15M subscribers"}}</script>'
		);
		const { impl } = fakeFetch(200, html);
		const result = await fetchPublicProfile('youtube', 'mkbhd', impl);
		expect(result).toMatchObject({ ok: true, followers: 21_300_000 });
	});

	it('reports a missing channel', async () => {
		const { impl } = fakeFetch(404, 'not found');
		await expect(fetchPublicProfile('youtube', 'nobody', impl)).resolves.toEqual({
			ok: false,
			reason: 'http_404'
		});
	});
});

describe('parseSubscriberCount', () => {
	it('reads every shape the page uses', () => {
		expect(parseSubscriberCount('21.3M subscribers')).toBe(21_300_000);
		expect(parseSubscriberCount('1.15M subscribers')).toBe(1_150_000);
		expect(parseSubscriberCount('812 subscribers')).toBe(812);
		expect(parseSubscriberCount('1 subscriber')).toBe(1);
		expect(parseSubscriberCount('4.2K subscribers')).toBe(4_200);
		expect(parseSubscriberCount('2.1B subscribers')).toBe(2_100_000_000);
	});

	it('returns null rather than zero for anything it does not recognise', () => {
		/* 0 is a real subscriber count; "could not read it" is a different claim. */
		expect(parseSubscriberCount('1.8K videos')).toBeNull();
		expect(parseSubscriberCount('@mkbhd')).toBeNull();
		expect(parseSubscriberCount('')).toBeNull();
	});
});

/* ------------------------------------------------------------------ *
 * Telegram
 * ------------------------------------------------------------------ */

describe('telegram', () => {
	const page = (extra: string, description: string) =>
		`<html><head><meta property="og:description" content="${description}"></head>` +
		`<body><div class="tgme_page_extra">${extra}</div></body></html>`;

	it('reads a channel’s description and member count', async () => {
		const { impl } = fakeFetch(200, page('10 694 677 subscribers', 'Founder · CN-4F7K'));
		await expect(fetchPublicProfile('Telegram', '@durov', impl)).resolves.toEqual({
			ok: true,
			followers: 10_694_677,
			bio: 'Founder · CN-4F7K'
		});
	});

	it('unescapes a bio that had markup characters in it', async () => {
		const { impl } = fakeFetch(200, page('500 members', 'Rates &amp; bookings &quot;open&quot;'));
		await expect(fetchPublicProfile('telegram', 'x', impl)).resolves.toMatchObject({
			ok: true,
			bio: 'Rates & bookings "open"'
		});
	});

	it('refuses a personal account, whose page has no bio anyone can write in', async () => {
		/* t.me puts the handle where a channel puts its count, and writes the
		   description itself — there is nothing there to paste a code into. */
		const { impl } = fakeFetch(200, page('@nahusenay', 'You can contact @nahusenay right away.'));
		await expect(fetchPublicProfile('telegram', 'nahusenay', impl)).resolves.toEqual({
			ok: false,
			reason: 'not_a_channel'
		});
	});
});

describe('parseMemberCount', () => {
	it('reads Telegram’s space-grouped digits, whichever space they are', () => {
		expect(parseMemberCount('10 694 677 subscribers')).toBe(10_694_677);
		expect(parseMemberCount('9 511 019 subscribers')).toBe(9_511_019);
		expect(parseMemberCount('500 members')).toBe(500);
	});

	it('returns null for a handle, which is what a personal account shows', () => {
		expect(parseMemberCount('@nahusenay')).toBeNull();
		expect(parseMemberCount('\n  @durov\n')).toBeNull();
	});
});

/* ------------------------------------------------------------------ *
 * The dispatcher
 * ------------------------------------------------------------------ */

describe('fetchPublicProfile', () => {
	it('normalises whatever shape the handle arrived in', async () => {
		const body = JSON.stringify({
			data: { user: { edge_followed_by: { count: 10 }, biography: '' } }
		});
		for (const typed of ['nuru', '@nuru', 'https://www.instagram.com/nuru/', '  @nuru  ']) {
			const { impl, calls } = fakeFetch(200, body);
			await fetchPublicProfile('instagram', typed, impl);
			expect(calls[0].url, typed).toContain('username=nuru');
		}
	});

	it('refuses a platform nothing here can read, without a request', async () => {
		const { impl, calls } = fakeFetch(200, '');
		await expect(fetchPublicProfile('LinkedIn', 'someone', impl)).resolves.toEqual({
			ok: false,
			reason: 'no_fetcher'
		});
		expect(calls).toHaveLength(0);
	});

	it('refuses an empty handle without a request', async () => {
		const { impl, calls } = fakeFetch(200, '');
		await expect(fetchPublicProfile('instagram', '   ', impl)).resolves.toEqual({
			ok: false,
			reason: 'no_handle'
		});
		expect(calls).toHaveLength(0);
	});

	it('turns a thrown network failure into a refusal, never an exception', async () => {
		await expect(fetchPublicProfile('youtube', 'mkbhd', deadFetch)).resolves.toEqual({
			ok: false,
			reason: 'network_error'
		});
	});

	it('knows which platforms are worth asking', () => {
		expect(fetchablePlatform('TikTok')).toBe('tiktok');
		expect(fetchablePlatform('  instagram ')).toBe('instagram');
		expect(fetchablePlatform('Facebook')).toBeNull();
	});
});
