import { describe, expect, it } from 'vitest';
import {
	fetchTelegramStats,
	fetchYouTubeStats,
	statsPlatform,
	type StatsFetch
} from './platform-stats';

/** A `fetch` that answers by URL substring, and records what was asked. */
function fakeFetch(routes: [match: string, status: number, body: unknown][]) {
	const asked: string[] = [];
	const impl = (async (input: string | URL | Request) => {
		const url = String(input);
		asked.push(url);
		const route = routes.find(([match]) => url.includes(match));
		if (!route) throw new Error(`unexpected request: ${url}`);
		return new Response(JSON.stringify(route[2]), { status: route[1] });
	}) as StatsFetch;
	return { impl, asked };
}

const channel = (statistics: Record<string, unknown>, uploads: string | null = 'UUabc') => ({
	items: [
		{
			statistics,
			contentDetails: uploads ? { relatedPlaylists: { uploads } } : {}
		}
	]
});

describe('statsPlatform', () => {
	it('matches the two platforms it can ask, loosely', () => {
		expect(statsPlatform(' YouTube ')).toBe('youtube');
		expect(statsPlatform('telegram')).toBe('telegram');
		expect(statsPlatform('Instagram')).toBeNull();
	});
});

describe('fetchYouTubeStats', () => {
	it('returns subscribers and engagement per view over recent uploads', async () => {
		const { impl, asked } = fakeFetch([
			['/channels?', 200, channel({ subscriberCount: '125000' })],
			[
				'/playlistItems?',
				200,
				{ items: [{ contentDetails: { videoId: 'v1' } }, { contentDetails: { videoId: 'v2' } }] }
			],
			[
				'/videos?',
				200,
				{
					items: [
						{ statistics: { viewCount: '10000', likeCount: '400', commentCount: '100' } },
						/* Likes switched off: the field is simply absent. */
						{ statistics: { viewCount: '10000', commentCount: '100' } }
					]
				}
			]
		]);

		const result = await fetchYouTubeStats('@SomeChannel', 'KEY', impl);
		expect(result).toEqual({ ok: true, followers: 125000, engagementRate: 3, detail: 'ok' });
		expect(asked[0]).toContain('forHandle=%40SomeChannel');
	});

	it('looks a channel id up by id rather than as a handle', async () => {
		const { impl, asked } = fakeFetch([
			['/channels?', 200, channel({ subscriberCount: '5' }, null)]
		]);
		await fetchYouTubeStats('UC1234567890abcdefghijkl', 'KEY', impl);
		expect(asked[0]).toContain('id=UC1234567890abcdefghijkl');
	});

	it('keeps the subscriber count when the video lookups fail', async () => {
		const { impl } = fakeFetch([
			['/channels?', 200, channel({ subscriberCount: '900' })],
			['/playlistItems?', 404, { error: { errors: [{ reason: 'playlistNotFound' }] } }]
		]);
		expect(await fetchYouTubeStats('x', 'KEY', impl)).toEqual({
			ok: true,
			followers: 900,
			engagementRate: null,
			detail: 'ok_no_engagement'
		});
	});

	it('refuses to store a hidden subscriber count as zero', async () => {
		const { impl } = fakeFetch([
			['/channels?', 200, channel({ hiddenSubscriberCount: true, subscriberCount: '0' })]
		]);
		expect(await fetchYouTubeStats('x', 'KEY', impl)).toEqual({
			ok: false,
			detail: 'subscribers_hidden'
		});
	});

	it('reports a handle with no channel', async () => {
		const { impl } = fakeFetch([['/channels?', 200, { items: [] }]]);
		expect(await fetchYouTubeStats('nobody', 'KEY', impl)).toEqual({
			ok: false,
			detail: 'channel_not_found'
		});
	});

	it('stops the run on a spent quota or a bad key', async () => {
		const quota = fakeFetch([
			['/channels?', 403, { error: { errors: [{ reason: 'quotaExceeded' }] } }]
		]);
		expect(await fetchYouTubeStats('x', 'KEY', quota.impl)).toEqual({
			ok: false,
			detail: 'quota_exceeded',
			stop: true
		});

		const badKey = fakeFetch([
			[
				'/channels?',
				400,
				{ error: { errors: [{ reason: 'badRequest' }], details: [{ reason: 'API_KEY_INVALID' }] } }
			]
		]);
		expect(await fetchYouTubeStats('x', 'KEY', badKey.impl)).toEqual({
			ok: false,
			detail: 'key_invalid',
			stop: true
		});
	});

	it('treats a network failure as no answer, not as a verdict', async () => {
		const impl = (async () => {
			throw new TypeError('fetch failed');
		}) as StatsFetch;
		expect(await fetchYouTubeStats('x', 'KEY', impl)).toEqual({ ok: false, detail: 'no_response' });
	});
});

describe('fetchTelegramStats', () => {
	it('returns the member count of a public channel', async () => {
		const { impl, asked } = fakeFetch([['getChatMemberCount', 200, { ok: true, result: 48213 }]]);
		expect(await fetchTelegramStats('@addis_news', 'TOKEN', impl)).toEqual({
			ok: true,
			followers: 48213,
			engagementRate: null,
			detail: 'ok'
		});
		expect(asked[0]).toContain('chat_id=%40addis_news');
	});

	it('does not ask about a name Telegram would never allow', async () => {
		const { impl, asked } = fakeFetch([]);
		expect(await fetchTelegramStats('ab', 'TOKEN', impl)).toEqual({
			ok: false,
			detail: 'bad_handle'
		});
		expect(await fetchTelegramStats('has space', 'TOKEN', impl)).toEqual({
			ok: false,
			detail: 'bad_handle'
		});
		expect(asked).toEqual([]);
	});

	it('reports a chat that does not exist', async () => {
		const { impl } = fakeFetch([
			[
				'getChatMemberCount',
				400,
				{ ok: false, error_code: 400, description: 'Bad Request: chat not found' }
			]
		]);
		expect(await fetchTelegramStats('ghost_channel', 'TOKEN', impl)).toEqual({
			ok: false,
			detail: 'chat_not_found'
		});
	});

	it('stops the run on a bad token or a rate limit, and never echoes the token', async () => {
		const badToken = fakeFetch([
			['getChatMemberCount', 401, { ok: false, description: 'Unauthorized' }]
		]);
		const refused = await fetchTelegramStats('addis_news', 'SECRET-TOKEN', badToken.impl);
		expect(refused).toEqual({ ok: false, detail: 'bad_token', stop: true });
		expect(JSON.stringify(refused)).not.toContain('SECRET');

		const limited = fakeFetch([
			['getChatMemberCount', 429, { ok: false, parameters: { retry_after: 30 } }]
		]);
		expect(await fetchTelegramStats('addis_news', 'TOKEN', limited.impl)).toEqual({
			ok: false,
			detail: 'rate_limited',
			stop: true
		});
	});
});
