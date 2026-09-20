import { error, redirect } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import * as m from '$lib/paraglide/messages';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireCreator } from '$lib/server/guards';
import { tiktokCredentials } from '$lib/server/tiktok';
import { authorizeUrl, codeChallenge, randomToken } from '$lib/server/tiktok-oauth';
import { TIKTOK_HANDSHAKE_COOKIE, handshakeCookieOptions } from './handshake';

/**
 * Starts the TikTok connect handshake for one channel.
 *
 * A POST rather than a GET, and reached from a form on the channels page, so
 * that nothing can send a creator to TikTok by putting an image in a page: the
 * origin check adapter-node applies to form posts is what stands between this
 * and a cross-site request that begins an authorisation the creator did not ask
 * for.
 *
 * Two things are settled here and carried in a cookie rather than the URL: the
 * PKCE verifier, which must never reach TikTok, and which channel is being
 * connected, which must not be something the callback takes on trust from a
 * query string it did not write.
 */
export const POST: RequestHandler = async (event) => {
	const { creator } = await requireCreator(event);

	const credentials = tiktokCredentials();
	if (!credentials) error(503, m.tt_unconfigured());

	const form = await event.request.formData();
	const socialAccountId = Number(form.get('socialAccountId'));
	if (!Number.isInteger(socialAccountId) || socialAccountId <= 0) {
		error(400, m.srv_invalid_request());
	}

	/*
	 * The channel is re-read and scoped to this creator: the id arrived in a
	 * form, which makes it a claim rather than a permission. The platform is
	 * checked too — a grant for a TikTok account has nothing to say about a
	 * row whose platform is Instagram, and storing one against it would put a
	 * TikTok follower count under an Instagram handle.
	 */
	const rows = await db
		.select({ id: t.socialAccounts.id, platform: t.platforms.name })
		.from(t.socialAccounts)
		.innerJoin(t.platforms, eq(t.platforms.id, t.socialAccounts.platformId))
		.where(
			and(
				eq(t.socialAccounts.id, socialAccountId),
				eq(t.socialAccounts.creatorId, creator.id),
				isNull(t.socialAccounts.deletedAt)
			)
		)
		.limit(1);

	const channel = rows.at(0);
	if (!channel) error(404, m.tt_no_channel());
	if (channel.platform.trim().toLowerCase() !== 'tiktok') error(400, m.tt_not_tiktok());

	const state = randomToken();
	const verifier = randomToken();

	event.cookies.set(
		TIKTOK_HANDSHAKE_COOKIE,
		JSON.stringify({ state, verifier, socialAccountId: channel.id }),
		handshakeCookieOptions(event.url)
	);

	redirect(303, authorizeUrl(credentials, state, await codeChallenge(verifier)));
};
