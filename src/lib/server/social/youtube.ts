/**
 * A YouTube channel's description and subscriber count, from the channel page.
 *
 * Unlike Instagram and TikTok, this one answers: the page is served in full to
 * anyone, and everything needed is in the `ytInitialData` blob it hydrates
 * from. That makes YouTube the platform where the bio-code proof actually
 * closes today, which is why it is here although the brief named only two.
 *
 * ## Two numbers, and which one wins
 *
 * The count on the page is rounded for everyone who is not the channel's owner
 * — "21.3M subscribers", never 21,342,908. `platform-stats.ts` already asks the
 * Data API for the exact figure with a key, hourly. So the figure returned here
 * is a starting point that the scheduled refresh corrects within the hour, and
 * both carry a confirmed source, so nothing is downgraded in between. What this
 * module is really for is the description.
 *
 * Read only: nothing here signs in, and nothing is fetched that a signed-out
 * visitor is not served.
 */
import { getText, logFailure } from './http';
import type { ProfileFetch, ProfileFetcher } from './types';

/**
 * The hydration blob. `.*?` up to the first `};</script>` — the assignment is
 * the only thing in its own tag, so the first close is the right one.
 */
const INITIAL_DATA = /var ytInitialData = (\{[\s\S]*?\});<\/script>/;

/** Only the leaves read below; every one optional and none trusted. */
type MetadataPart = { text?: { content?: unknown }; accessibilityLabel?: unknown };
type InitialData = {
	metadata?: { channelMetadataRenderer?: { description?: unknown; title?: unknown } };
	header?: {
		pageHeaderRenderer?: {
			content?: {
				pageHeaderViewModel?: {
					metadata?: {
						contentMetadataViewModel?: { metadataRows?: { metadataParts?: MetadataPart[] }[] };
					};
				};
			};
		};
	};
};

/** What each suffix on a rounded count is worth. */
const SUFFIXES: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9 };

/**
 * "21.3M subscribers" → 21300000, "812 subscribers" → 812.
 *
 * Returns null rather than 0 for anything it does not recognise, because 0 is a
 * real subscriber count and "we could not read it" is not the same claim.
 * Commas and thin spaces are stripped first: the page groups digits and the
 * separator is not always the ASCII one.
 */
export function parseSubscriberCount(text: string): number | null {
	const cleaned = text.replace(/[\s,\u00a0\u202f]/g, '');
	const match = cleaned.match(/^([\d.]+)([KMB])?subscribers?$/i);
	if (!match) return null;

	const value = Number(match[1]);
	if (!Number.isFinite(value)) return null;

	const multiplier = match[2] ? (SUFFIXES[match[2].toUpperCase()] ?? 1) : 1;
	return Math.round(value * multiplier);
}

/**
 * The channel's own subscriber row.
 *
 * Taken from the page header specifically, and never by searching the document
 * for `subscriberCountText`: the page also carries sidebar shelves of *other*
 * channels, each with its own count, and the first one in the markup belongs to
 * one of those. Reading it would report a stranger's audience as the creator's.
 */
function subscribersFrom(data: InitialData): number | null {
	const rows =
		data.header?.pageHeaderRenderer?.content?.pageHeaderViewModel?.metadata
			?.contentMetadataViewModel?.metadataRows ?? [];

	for (const row of rows) {
		for (const part of row.metadataParts ?? []) {
			const content = part.text?.content;
			if (typeof content !== 'string') continue;
			const count = parseSubscriberCount(content);
			if (count !== null) return count;
		}
	}
	/* Hidden subscriber counts leave the row out entirely. */
	return null;
}

export async function fetchYouTubeProfile(
	username: string,
	fetchImpl: ProfileFetcher = fetch
): Promise<ProfileFetch> {
	/* Not lower-cased: YouTube handles are case-preserving and the page is
	   served for either spelling, so what the creator typed is what is asked for. */
	const handle = username.trim().replace(/^@/, '');
	if (!handle) return { ok: false, reason: 'no_handle' };

	const url = `https://www.youtube.com/@${encodeURIComponent(handle)}`;
	const fetched = await getText(
		url,
		{ Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
		fetchImpl
	);

	if (!fetched.ok) {
		/* 404 is the honest "no such channel". */
		logFailure('youtube', handle, fetched.reason);
		return { ok: false, reason: fetched.reason };
	}

	const raw = fetched.body.match(INITIAL_DATA)?.[1];
	if (!raw) {
		logFailure('youtube', handle, 'no_initial_data');
		return { ok: false, reason: 'no_initial_data' };
	}

	let data: InitialData;
	try {
		data = JSON.parse(raw) as InitialData;
	} catch {
		logFailure('youtube', handle, 'bad_initial_data');
		return { ok: false, reason: 'bad_initial_data' };
	}

	/*
	 * The full description, not the `<meta name="description">` twin, which
	 * YouTube truncates — a code pasted at the end of a long channel description
	 * would fall off the end of that one and read as absent.
	 */
	const description = data.metadata?.channelMetadataRenderer?.description;
	if (typeof description !== 'string') {
		/* No channel metadata at all means the page was not a channel page. */
		logFailure('youtube', handle, 'no_channel_metadata');
		return { ok: false, reason: 'no_channel_metadata' };
	}

	return { ok: true, followers: subscribersFrom(data), bio: description };
}
