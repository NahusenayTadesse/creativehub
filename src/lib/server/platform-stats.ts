/**
 * Asking a platform for a channel's numbers, where a platform will say.
 *
 * `social-check.ts` asks whether an account exists; this asks how big it is.
 * Only two platforms answer that for a channel nobody has signed in to, and
 * both through a documented API with a free key:
 *
 * | Platform | Endpoint                                  | Gives                          |
 * | -------- | ----------------------------------------- | ------------------------------ |
 * | YouTube  | Data API v3 `channels`, `playlistItems`,   | subscribers; engagement over   |
 * |          | `videos` — an API key, 3 quota units each  | the latest uploads             |
 * | Telegram | Bot API `getChatMemberCount` — a bot token | members of a public channel    |
 *
 * Instagram is not here because it will not: Business Discovery needs a
 * verified Meta business app. Its figures are confirmed by an operator from a
 * screenshot instead — see `stat_proofs`.
 *
 * TikTok is not here either, but for a different reason: its stats do come
 * from an account that has signed in to ours, which is exactly what
 * `tiktok.ts` arranges. It is absent from this file only because it needs a
 * stored grant, and nothing here touches the database.
 *
 * Nothing here touches the database or the environment. Keys arrive as
 * arguments and `fetch` can be replaced, so the parsing below is tested without
 * a network, and the in-app scheduler and the CLI script share it.
 */

export type StatsFetch = typeof fetch;

export type StatsResult =
	| {
			ok: true;
			followers: number;
			/** Percent, or null when the platform gives nothing to compute it from. */
			engagementRate: number | null;
			detail: string;
	  }
	| {
			ok: false;
			/** A word for the log and the row: `channel_not_found`, `quota_exceeded`. */
			detail: string;
			/**
			 * The failure is about us, not this channel — a spent quota, a bad key —
			 * and every further request this run would fail the same way.
			 */
			stop?: boolean;
	  };

/** Long enough for a slow morning, short enough that a run of hundreds finishes. */
const TIMEOUT_MS = 10_000;

/**
 * The platforms the refresh can ask about, by `platforms.name`, matched loosely.
 *
 * TikTok is in the list although this module has no function for it: it is
 * asked through the creator's own grant, which lives in `tiktok.ts` because it
 * needs the database. What the name means here is "the hourly sweep knows how
 * to get a number for this", which is now true of all three.
 */
export function statsPlatform(platform: string): 'youtube' | 'telegram' | 'tiktok' | null {
	const name = platform.trim().toLowerCase();
	return name === 'youtube' || name === 'telegram' || name === 'tiktok' ? name : null;
}

/*
 * The parts of each response read below. Every field is optional because none
 * of it is trusted: a body that does not match is read as missing, never thrown on.
 */
type YouTubeError = {
	error?: { errors?: { reason?: string }[]; details?: { reason?: string }[] };
};
type YouTubeChannels = YouTubeError & {
	items?: {
		statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean };
		contentDetails?: { relatedPlaylists?: { uploads?: string } };
	}[];
};
type YouTubePlaylist = { items?: { contentDetails?: { videoId?: unknown } }[] };
type YouTubeVideos = {
	items?: { statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }[];
};
type TelegramReply = { ok?: boolean; result?: unknown; description?: string };

type JsonResponse<T> = { status: number; body: T | null } | null;

/** A GET that never throws. Null is "no answer at all" — a timeout, a DNS failure. */
async function getJson<T>(url: string, fetchImpl: StatsFetch): Promise<JsonResponse<T>> {
	try {
		const response = await fetchImpl(url, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		const body = (await response.json().catch(() => null)) as T | null;
		return { status: response.status, body };
	} catch {
		return null;
	}
}

/* ------------------------------------------------------------------ *
 * YouTube
 * ------------------------------------------------------------------ */

const YOUTUBE = 'https://www.googleapis.com/youtube/v3';

/** How many recent uploads the engagement rate is taken over. */
const RECENT_VIDEOS = 10;

/** A channel id rather than a handle: `UC` and twenty-two more. */
const CHANNEL_ID = /^UC[\w-]{22}$/;

/** Reads the reason out of a Data API error body. */
function youtubeFailure(response: JsonResponse<YouTubeError>): StatsResult {
	if (!response) return { ok: false, detail: 'no_response' };
	const error = response.body?.error;
	const reason: string | undefined = error?.errors?.[0]?.reason;

	if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
		return { ok: false, detail: 'quota_exceeded', stop: true };
	}
	/* A bad key is a 400, spelled differently depending on which layer refused it. */
	const keyInvalid =
		reason === 'keyInvalid' ||
		(error?.details ?? []).some((detail) => detail?.reason === 'API_KEY_INVALID');
	if (keyInvalid) return { ok: false, detail: 'key_invalid', stop: true };
	if (response.status === 403) return { ok: false, detail: reason ?? 'forbidden', stop: true };
	return { ok: false, detail: reason ?? `http_${response.status}` };
}

/**
 * Subscribers, and engagement over the latest uploads.
 *
 * Engagement is (likes + comments) ÷ views across up to `RECENT_VIDEOS` of the
 * newest uploads — per view, which is how YouTube engagement is conventionally
 * read, because a subscriber count says little about who watches a given video.
 *
 * Two things the API does to the numbers: subscriber counts are rounded to three
 * significant figures (1,234,567 comes back as 1,230,000), and a channel can hide
 * its count, in which case there is no follower figure to store and this fails
 * with `subscribers_hidden` rather than writing 0.
 *
 * If the channel lookup works and the video lookups do not, the subscriber
 * count is still returned, with no engagement rate.
 */
export async function fetchYouTubeStats(
	handle: string,
	apiKey: string,
	fetchImpl: StatsFetch = fetch
): Promise<StatsResult> {
	const bare = handle.trim().replace(/^@/, '');
	if (!bare) return { ok: false, detail: 'no_handle' };

	const lookup = CHANNEL_ID.test(bare)
		? `id=${encodeURIComponent(bare)}`
		: `forHandle=${encodeURIComponent(`@${bare}`)}`;

	const channel = await getJson<YouTubeChannels>(
		`${YOUTUBE}/channels?part=statistics,contentDetails&${lookup}&key=${encodeURIComponent(apiKey)}`,
		fetchImpl
	);
	if (!channel || channel.status !== 200) return youtubeFailure(channel);

	const item = channel.body?.items?.[0];
	if (!item) return { ok: false, detail: 'channel_not_found' };
	if (item.statistics?.hiddenSubscriberCount) return { ok: false, detail: 'subscribers_hidden' };

	const followers = Number(item.statistics?.subscriberCount);
	if (!Number.isFinite(followers) || followers < 0) {
		return { ok: false, detail: 'no_subscriber_count' };
	}

	const uploads: string | undefined = item.contentDetails?.relatedPlaylists?.uploads;
	const engagementRate = uploads ? await recentEngagement(uploads, apiKey, fetchImpl) : null;

	return {
		ok: true,
		followers: Math.round(followers),
		engagementRate,
		detail: engagementRate === null ? 'ok_no_engagement' : 'ok'
	};
}

async function recentEngagement(
	uploadsPlaylist: string,
	apiKey: string,
	fetchImpl: StatsFetch
): Promise<number | null> {
	const playlist = await getJson<YouTubePlaylist>(
		`${YOUTUBE}/playlistItems?part=contentDetails&maxResults=${RECENT_VIDEOS}` +
			`&playlistId=${encodeURIComponent(uploadsPlaylist)}&key=${encodeURIComponent(apiKey)}`,
		fetchImpl
	);
	if (!playlist || playlist.status !== 200) return null;

	const ids = (playlist.body?.items ?? [])
		.map((entry) => entry?.contentDetails?.videoId)
		.filter((id): id is string => typeof id === 'string' && id.length > 0);
	if (!ids.length) return null;

	const videos = await getJson<YouTubeVideos>(
		`${YOUTUBE}/videos?part=statistics&id=${ids.map(encodeURIComponent).join(',')}` +
			`&key=${encodeURIComponent(apiKey)}`,
		fetchImpl
	);
	if (!videos || videos.status !== 200) return null;

	let views = 0;
	let interactions = 0;
	for (const video of videos.body?.items ?? []) {
		const stats = video?.statistics ?? {};
		const viewCount = Number(stats.viewCount);
		if (!Number.isFinite(viewCount) || viewCount <= 0) continue;
		views += viewCount;
		/* Either can be switched off on a video, and then the field is absent. */
		interactions += (Number(stats.likeCount) || 0) + (Number(stats.commentCount) || 0);
	}

	return views > 0 ? Math.round((interactions / views) * 10_000) / 100 : null;
}

/* ------------------------------------------------------------------ *
 * Telegram
 * ------------------------------------------------------------------ */

/** Telegram's own rule for a public username. */
const TELEGRAM_USERNAME = /^[A-Za-z][A-Za-z0-9_]{3,31}$/;

/**
 * Members of a public channel or group.
 *
 * `getChatMemberCount` takes `@username` for public chats. It says nothing
 * about engagement, so the rate is always null and the caller leaves the stored
 * one — and its source — as they were. A personal account is not a chat and
 * comes back as an error, which is the honest answer: a person has no members.
 *
 * The token is part of the URL, so no URL built here is ever logged or stored;
 * the detail is a word from the response, never the request.
 */
export async function fetchTelegramStats(
	handle: string,
	botToken: string,
	fetchImpl: StatsFetch = fetch
): Promise<StatsResult> {
	const bare = handle.trim().replace(/^@/, '');
	if (!TELEGRAM_USERNAME.test(bare)) return { ok: false, detail: 'bad_handle' };

	const response = await getJson<TelegramReply>(
		`https://api.telegram.org/bot${botToken}/getChatMemberCount?chat_id=${encodeURIComponent(`@${bare}`)}`,
		fetchImpl
	);
	if (!response) return { ok: false, detail: 'no_response' };

	const body = response.body;
	if (body?.ok === true && Number.isFinite(Number(body.result))) {
		return { ok: true, followers: Number(body.result), engagementRate: null, detail: 'ok' };
	}

	if (response.status === 401 || response.status === 404) {
		/* 404 from the Bot API means the token path matched no bot. */
		return { ok: false, detail: 'bad_token', stop: true };
	}
	if (response.status === 429) return { ok: false, detail: 'rate_limited', stop: true };

	const description = String(body?.description ?? '').toLowerCase();
	if (description.includes('chat not found')) return { ok: false, detail: 'chat_not_found' };
	return { ok: false, detail: `http_${response.status}` };
}
