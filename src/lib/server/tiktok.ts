/**
 * The stored side of a TikTok connection: credentials, the grant row, and
 * keeping an access token usable.
 *
 * `tiktok-oauth.ts` knows how to talk to TikTok and nothing else. This knows
 * where the grant lives, when it has to be renewed, and what a dead grant
 * should leave behind — so the routes and the hourly refresh share one answer
 * to all three rather than each having their own.
 */
import { env } from '$env/dynamic/private';
import { and, eq } from 'drizzle-orm';
import * as t from './db/schema';
import type { Database } from './db/rollups';
import { absoluteUrl } from './urls';
import {
	engagementFrom,
	fetchTikTokUser,
	refreshTokens,
	type OAuthFetch,
	type TikTokCredentials,
	type TikTokTokens,
	type TikTokUser
} from './tiktok-oauth';
import type { StatsResult } from './platform-stats';

/** Where TikTok sends the creator back. Registered in the TikTok app, so it must not drift. */
export const TIKTOK_REDIRECT_PATH = '/dashboard/channels/connect/tiktok/callback';

/**
 * The app's TikTok credentials, or null when it has none.
 *
 * Null is a supported state, not a misconfiguration to throw over: the connect
 * button is simply not offered, exactly as the stats refresh skips a platform
 * whose key is unset. `TIKTOK_CLIENT_ID` is TikTok's `client_key` — see the
 * note in `tiktok-oauth.ts` about the name.
 */
export function tiktokCredentials(): TikTokCredentials | null {
	const clientId = (env.TIKTOK_CLIENT_ID ?? '').trim();
	const clientSecret = (env.TIKTOK_SECRET_KEY ?? '').trim();
	if (!clientId || !clientSecret) return null;
	return { clientId, clientSecret, redirectUri: absoluteUrl(TIKTOK_REDIRECT_PATH) };
}

/** Seconds from now, as a date, for the expiry columns. */
const expiryFrom = (seconds: number | null, now: Date): Date | null =>
	seconds === null ? null : new Date(now.getTime() + seconds * 1000);

/**
 * Writes a fresh grant against a channel.
 *
 * An upsert rather than an insert, because reconnecting is the ordinary fix for
 * an expired refresh token and should not require disconnecting first. The
 * unique index on `social_account_id` is what makes it one row either way.
 */
export async function saveConnection(
	db: Database,
	input: {
		socialAccountId: number;
		creatorId: number;
		tokens: TikTokTokens;
		user: TikTokUser;
		actorId: string;
		now?: Date;
	}
) {
	const now = input.now ?? new Date();
	const row = {
		socialAccountId: input.socialAccountId,
		creatorId: input.creatorId,
		provider: 'tiktok' as const,
		externalId: input.tokens.openId,
		externalUsername: input.user.username,
		accessToken: input.tokens.accessToken,
		accessTokenExpiresAt: new Date(now.getTime() + input.tokens.expiresIn * 1000),
		refreshToken: input.tokens.refreshToken,
		refreshTokenExpiresAt: expiryFrom(input.tokens.refreshExpiresIn, now),
		scope: input.tokens.scope.slice(0, 500),
		connectedAt: now,
		lastSyncedAt: now,
		lastSyncDetail: 'ok'
	};

	await db
		.insert(t.platformConnections)
		.values({ ...row, createdBy: input.actorId })
		.onDuplicateKeyUpdate({ set: { ...row, updatedBy: input.actorId, deletedAt: null } });
}

/** Drops the grant. A delete, not a soft delete — see the schema comment. */
export async function disconnect(db: Database, socialAccountId: number, creatorId: number) {
	await db
		.delete(t.platformConnections)
		.where(
			and(
				eq(t.platformConnections.socialAccountId, socialAccountId),
				eq(t.platformConnections.creatorId, creatorId)
			)
		);
}

/** The columns the refresh needs. The token columns are selected nowhere else. */
const connectionColumns = {
	id: t.platformConnections.id,
	socialAccountId: t.platformConnections.socialAccountId,
	creatorId: t.platformConnections.creatorId,
	externalId: t.platformConnections.externalId,
	accessToken: t.platformConnections.accessToken,
	accessTokenExpiresAt: t.platformConnections.accessTokenExpiresAt,
	refreshToken: t.platformConnections.refreshToken,
	refreshTokenExpiresAt: t.platformConnections.refreshTokenExpiresAt
};

export type StoredConnection = {
	id: number;
	socialAccountId: number;
	creatorId: number;
	externalId: string;
	accessToken: string;
	accessTokenExpiresAt: Date;
	refreshToken: string | null;
	refreshTokenExpiresAt: Date | null;
};

/** One channel's grant, if it has one. */
export async function connectionFor(
	db: Database,
	socialAccountId: number
): Promise<StoredConnection | undefined> {
	const rows = await db
		.select(connectionColumns)
		.from(t.platformConnections)
		.where(eq(t.platformConnections.socialAccountId, socialAccountId))
		.limit(1);
	return rows.at(0);
}

/**
 * Renewed a little before it runs out.
 *
 * An access token that expires mid-request is a failure the creator has to fix
 * by reconnecting, so the margin is generous relative to how long a refresh
 * takes. TikTok's access tokens last a day; a refresh costs one request.
 */
const RENEW_WITHIN_MS = 10 * 60 * 1000;

/**
 * An access token that can be used right now, renewing the grant if needed.
 *
 * The renewed pair is written back before it is used, because TikTok retires
 * the old refresh token the moment it issues a new one: a crash between the two
 * would otherwise leave a stored token that can never be redeemed again.
 */
async function usableToken(
	db: Database,
	connection: StoredConnection,
	credentials: TikTokCredentials,
	fetchImpl: OAuthFetch | undefined,
	now: Date
): Promise<{ ok: true; accessToken: string } | { ok: false; detail: string; fatal: boolean }> {
	if (connection.accessTokenExpiresAt.getTime() - now.getTime() > RENEW_WITHIN_MS) {
		return { ok: true, accessToken: connection.accessToken };
	}

	if (!connection.refreshToken) return { ok: false, detail: 'no_refresh_token', fatal: true };
	if (connection.refreshTokenExpiresAt && connection.refreshTokenExpiresAt <= now) {
		return { ok: false, detail: 'refresh_expired', fatal: true };
	}

	const renewed = await refreshTokens(credentials, connection.refreshToken, fetchImpl);
	if (!renewed.ok) return { ok: false, detail: renewed.detail, fatal: renewed.fatal === true };

	await db
		.update(t.platformConnections)
		.set({
			accessToken: renewed.tokens.accessToken,
			accessTokenExpiresAt: new Date(now.getTime() + renewed.tokens.expiresIn * 1000),
			/* TikTok returns a new refresh token and retires the old one. Keeping
			   the old one on a reply that omitted it is better than nulling it. */
			...(renewed.tokens.refreshToken ? { refreshToken: renewed.tokens.refreshToken } : {}),
			refreshTokenExpiresAt:
				expiryFrom(renewed.tokens.refreshExpiresIn, now) ?? connection.refreshTokenExpiresAt
		})
		.where(eq(t.platformConnections.id, connection.id));

	return { ok: true, accessToken: renewed.tokens.accessToken };
}

/**
 * This channel's figures, from the creator's own grant.
 *
 * Answers in `StatsResult`, the shape `stats-refresh.ts` already handles, so
 * TikTok joins the hourly sweep without that file learning anything about
 * OAuth beyond which rows have a grant.
 *
 * `stop` is never set: a dead TikTok grant is about one creator's channel, not
 * about the run, so it must not halt the other channels the way a spent YouTube
 * quota does. A grant that has genuinely ended is recorded on the connection as
 * `lastSyncDetail`, which is what the channels page reads to say "reconnect".
 */
export async function fetchConnectedTikTokStats(
	db: Database,
	connection: StoredConnection,
	credentials: TikTokCredentials,
	fetchImpl?: OAuthFetch,
	now: Date = new Date()
): Promise<StatsResult> {
	const noteFailure = async (detail: string) => {
		await db
			.update(t.platformConnections)
			.set({ lastSyncedAt: now, lastSyncDetail: detail.slice(0, 80) })
			.where(eq(t.platformConnections.id, connection.id));
	};

	const token = await usableToken(db, connection, credentials, fetchImpl, now);
	if (!token.ok) {
		await noteFailure(token.detail);
		return { ok: false, detail: token.detail };
	}

	const result = await fetchTikTokUser(token.accessToken, fetchImpl);
	if (!result.ok) {
		await noteFailure(result.detail);
		return { ok: false, detail: result.detail };
	}

	/*
	 * The grant is checked against the account it was stored for. A creator who
	 * reconnects a *different* TikTok account to the same row would otherwise
	 * have another account's followers written onto this channel's handle.
	 */
	if (result.user.openId !== connection.externalId) {
		await noteFailure('account_changed');
		return { ok: false, detail: 'account_changed' };
	}

	await db
		.update(t.platformConnections)
		.set({
			lastSyncedAt: now,
			lastSyncDetail: 'ok',
			externalUsername: result.user.username
		})
		.where(eq(t.platformConnections.id, connection.id));

	return {
		ok: true,
		followers: result.user.followers,
		engagementRate: engagementFrom(result.user),
		detail: 'ok'
	};
}
