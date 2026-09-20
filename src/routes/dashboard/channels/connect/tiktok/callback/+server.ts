import { redirect } from '@sveltejs/kit';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireCreator, recordAudit } from '$lib/server/guards';
import { refreshCreatorReach } from '$lib/server/score-service';
import { normaliseHandle } from '$lib/domain/social-link';
import { saveConnection, tiktokCredentials } from '$lib/server/tiktok';
import { engagementFrom, exchangeCode, fetchTikTokUser } from '$lib/server/tiktok-oauth';
import { TIKTOK_HANDSHAKE_COOKIE, handshakeCookieOptions, readHandshake } from '../handshake';

/**
 * Where TikTok sends the creator back.
 *
 * Everything this route is told arrives through the creator's browser, so
 * nothing in the query string is trusted on its own: the `state` is compared
 * against the cookie written when the flow started, the channel comes from that
 * cookie rather than from TikTok, and the account TikTok describes is checked
 * against the handle already on the row before a single figure is written.
 *
 * It always ends on /dashboard/channels with `?connected=` saying how it went,
 * because a raw error page at the end of a round trip through another site
 * leaves the creator with nowhere to go.
 */
export const GET: RequestHandler = async (event) => {
	const { user, creator } = await requireCreator(event);

	/* However this ends, the handshake is over: the cookie is one attempt. */
	const raw = event.cookies.get(TIKTOK_HANDSHAKE_COOKIE);
	event.cookies.delete(TIKTOK_HANDSHAKE_COOKIE, handshakeCookieOptions(event.url));

	const done = (outcome: string): never =>
		redirect(303, `/dashboard/channels?connected=${encodeURIComponent(outcome)}`);

	const handshake = readHandshake(raw);
	if (!handshake) return done('expired');

	/* TikTok reports a refused consent screen this way rather than with a code. */
	if (event.url.searchParams.get('error')) return done('declined');

	const state = event.url.searchParams.get('state') ?? '';
	const code = event.url.searchParams.get('code') ?? '';
	/* Length-independent comparison is not needed — both are ours and random —
	   but an empty state matching an empty cookie value would be, so both are
	   required to be non-empty before they are compared. */
	if (!state || !code || state !== handshake.state) return done('mismatch');

	const credentials = tiktokCredentials();
	if (!credentials) return done('unconfigured');

	/* The channel is re-read here, scoped to this creator, because the cookie is
	   ours but the row may have been deleted while the creator was at TikTok. */
	const rows = await db
		.select({
			id: t.socialAccounts.id,
			handle: t.socialAccounts.handle,
			followers: t.socialAccounts.followers,
			platform: t.platforms.name
		})
		.from(t.socialAccounts)
		.innerJoin(t.platforms, eq(t.platforms.id, t.socialAccounts.platformId))
		.where(
			and(
				eq(t.socialAccounts.id, handshake.socialAccountId),
				eq(t.socialAccounts.creatorId, creator.id),
				isNull(t.socialAccounts.deletedAt)
			)
		)
		.limit(1);

	const channel = rows.at(0);
	if (!channel || channel.platform.trim().toLowerCase() !== 'tiktok') return done('no_channel');

	const exchanged = await exchangeCode(credentials, code, handshake.verifier);
	if (!exchanged.ok) {
		console.error('TikTok token exchange failed:', exchanged.detail);
		return done('exchange_failed');
	}

	const profile = await fetchTikTokUser(exchanged.tokens.accessToken);
	if (!profile.ok) {
		console.error('TikTok user info failed:', profile.detail);
		/* The one worth telling apart: the creator unticked the stats scope on
		   the consent screen, so the grant exists and is useless. */
		return done(profile.detail === 'scope_not_granted' ? 'no_stats_scope' : 'profile_failed');
	}

	/*
	 * The connected account has to be the one the row claims to be.
	 *
	 * Without this, a creator could add a channel for a handle with a large
	 * audience and then connect their own small account to it — the followers
	 * written would be real, and attached to somebody else's name. TikTok's
	 * `username` is the handle as it spells it; both sides are normalised
	 * because the row may hold it as typed, with an @ or in mixed case.
	 */
	const claimed = normaliseHandle(channel.handle).toLowerCase();
	const actual = normaliseHandle(profile.user.username ?? '').toLowerCase();
	if (!actual || actual !== claimed) return done('handle_mismatch');

	const now = new Date();
	await saveConnection(db, {
		socialAccountId: channel.id,
		creatorId: creator.id,
		tokens: exchanged.tokens,
		user: profile.user,
		actorId: user.id,
		now
	});

	const engagementRate = engagementFrom(profile.user);

	await db
		.update(t.socialAccounts)
		.set({
			followers: profile.user.followers,
			followersSource: 'platform',
			followersUpdatedAt: now,
			...(engagementRate === null
				? {}
				: {
						engagementRate,
						engagementSource: 'platform' as const,
						engagementUpdatedAt: now
					}),
			statsFetchedAt: now,
			statsFetchDetail: 'ok',
			/*
			 * Signing in to the account is the strongest ownership evidence this
			 * site collects — stronger than the tick on the channels form, which
			 * is the creator's own word, and stronger than a screenshot. The link
			 * status follows for the same reason: TikTok just served us the
			 * profile from the inside.
			 */
			isVerified: true,
			linkStatus: 'found',
			linkCheckedAt: now,
			/* A follower count moving is not somebody editing the profile. */
			updatedAt: sql`${t.socialAccounts.updatedAt}`
		})
		.where(eq(t.socialAccounts.id, channel.id));

	await refreshCreatorReach(creator.id);

	await recordAudit({
		actorId: user.id,
		actorLabel: creator.fullName,
		entity: 'social_account',
		entityId: channel.id,
		action: 'tiktok_connected',
		toState: 'platform',
		reason: `@${actual}: ${channel.followers} → ${profile.user.followers} followers${
			engagementRate === null ? '' : `, ${engagementRate}% engagement`
		}`
	});

	return done('ok');
};
