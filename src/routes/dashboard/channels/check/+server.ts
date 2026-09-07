import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireCreator } from '$lib/server/guards';
import { verifySubmittedLink } from '$lib/server/social-verify';

/**
 * What the "Check" button in the channels dialog calls.
 *
 * It reports and nothing more — the save does its own check, because a verdict
 * fetched here and posted back would be a claim the client makes about itself.
 * Behind `requireCreator` for the same reason every other outbound call on this
 * site is behind a session: it makes requests to third parties, and an open
 * endpoint that does that is a proxy for whoever finds it.
 */
export const POST: RequestHandler = async (event) => {
	await requireCreator(event);

	const body = await event.request.json().catch(() => null);
	const platformId = Number((body as { platformId?: unknown })?.platformId);
	const handle = String((body as { handle?: unknown })?.handle ?? '');

	const verdict = await verifySubmittedLink(platformId, handle);

	return json({
		status: verdict.status,
		url: verdict.url,
		checkable: verdict.checkable,
		text: verdict.text
	});
};
