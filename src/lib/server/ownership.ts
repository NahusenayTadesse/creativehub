/**
 * Proving a creator owns the handle on a channel.
 *
 * The problem this solves is the one the whole marketplace rests on: a follower
 * count is typed in, and nothing about typing it proves the account is yours.
 * A creator can write down a famous handle and a famous number, and until
 * somebody checks, the row prices exactly as if they had earned it.
 *
 * The check is the oldest one there is. We hand the creator a short string, ask
 * them to put it in their bio — the one field on a profile only its owner can
 * edit — and then go and read the profile ourselves. If the string is there,
 * whoever is holding this account is also holding that profile. The follower
 * count is read off the same page in the same breath, so the number and the
 * proof of ownership arrive together and neither is taken on trust.
 *
 * ## The three endings, and why none of them is a wall
 *
 * `verified` — the code was found. The handle is theirs, the count is ours to
 * keep, and the code can come out of the bio again.
 *
 * `code_not_found` — the profile was read and the code was not on it. Almost
 * always a bio that has not been saved yet, so this is a retry and the channel
 * stays `pending`.
 *
 * `unreachable` — the platform would not answer. This is Instagram and TikTok,
 * every time, from this server: see the table in `$lib/server/social/index.ts`.
 * It is a fact about our address, not about the creator, so the creator is
 * offered the manual entry instead and their figure is labelled `self_reported`
 * — honestly weaker, and never a refusal. **Nothing here can stop a creator
 * finishing their profile.** That is the rule the whole module is arranged
 * around.
 *
 * ## What is deliberately not done
 *
 * Nothing retries in a loop, nothing is scheduled, and nothing asks a platform
 * about a handle unless a signed-in creator pressed a button about their own
 * channel. One lookup per press, five presses per ten minutes.
 *
 * `db` is a parameter rather than the app's own connection, for the same reason
 * it is in `tiktok.ts` and `creator-score.ts`: it is what lets this be driven
 * from a script against a real database without standing up SvelteKit.
 */
import { and, eq, isNull, ne } from 'drizzle-orm';
import * as t from '$lib/server/db/schema';
import type { Database } from '$lib/server/db/rollups';
import { recalcCreatorReach, recalcCreatorScore } from '$lib/server/db/creator-score';
import { recalcCreatorVerification } from '$lib/server/db/creator-verification';
import { bioContainsCode, generateOwnershipCode } from '$lib/domain/ownership-code';
import { normaliseHandle } from '$lib/domain/social-link';
import { fetchPublicProfile, fetchablePlatform } from '$lib/server/social';
import { take } from '$lib/server/ratelimit';

/**
 * Five presses per ten minutes, per the brief, counted per creator rather than
 * per channel: the cost being limited is the outbound request, and a creator
 * with six channels can still make six lookups' worth of noise from one seat.
 */
const VERIFY_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 };

export type OwnershipOutcome =
	| { kind: 'verified'; handle: string; platform: string; followers: number | null }
	| { kind: 'code_not_found'; platform: string }
	| { kind: 'unreachable'; platform: string; reason: string }
	| { kind: 'not_fetchable'; platform: string }
	| { kind: 'taken'; platform: string }
	| { kind: 'rate_limited'; retryAfter: number }
	| { kind: 'no_channel' };

/**
 * Total reach and the score, recomputed from the channels as they now stand.
 *
 * `$lib/server/score-service` is the app's name for this and closes over the
 * app's connection; these two calls are the same work on whichever connection
 * the caller handed in.
 */
async function refreshReach(db: Database, creatorId: number) {
	await recalcCreatorReach(db, creatorId);
	await recalcCreatorScore(db, creatorId);
}

/** The channel, if it is this creator's and still alive. The id in a form is a claim. */
async function channelFor(db: Database, socialAccountId: number, creatorId: number) {
	const rows = await db
		.select({
			id: t.socialAccounts.id,
			handle: t.socialAccounts.handle,
			platformId: t.socialAccounts.platformId,
			platform: t.platforms.name,
			code: t.socialAccounts.ownershipCode,
			status: t.socialAccounts.ownershipStatus
		})
		.from(t.socialAccounts)
		.innerJoin(t.platforms, eq(t.platforms.id, t.socialAccounts.platformId))
		.where(
			and(
				eq(t.socialAccounts.id, socialAccountId),
				eq(t.socialAccounts.creatorId, creatorId),
				isNull(t.socialAccounts.deletedAt)
			)
		)
		.limit(1);
	return rows.at(0) ?? null;
}

export type IssuedCode = { code: string; platform: string; handle: string; fetchable: boolean };

/**
 * Gives this channel a code, or hands back the one it already has.
 *
 * Re-issuing on every press would be actively unhelpful: a creator who pasted
 * the code, saved the bio and came back to a *different* code would be sent
 * round the loop forever. The code is minted once and kept until the channel is
 * verified, so the string on the screen is always the string being looked for.
 */
export async function issueCode(
	db: Database,
	socialAccountId: number,
	creatorId: number
): Promise<IssuedCode | null> {
	const channel = await channelFor(db, socialAccountId, creatorId);
	if (!channel) return null;

	const code = channel.code ?? generateOwnershipCode();

	if (!channel.code || channel.status === 'none') {
		await db
			.update(t.socialAccounts)
			.set({
				ownershipCode: code,
				/* A channel that has already been verified keeps that standing while
				   it looks at its own code again. */
				...(channel.status === 'verified' ? {} : { ownershipStatus: 'pending' as const })
			})
			.where(eq(t.socialAccounts.id, channel.id));
	}

	return {
		code,
		platform: channel.platform,
		handle: channel.handle,
		fetchable: fetchablePlatform(channel.platform) !== null
	};
}

/**
 * Has some *other* creator already proved this handle?
 *
 * Asked before the write as well as caught after it. The unique index is what
 * actually guarantees the rule — two presses landing together cannot both win —
 * but reaching it means catching a driver error and guessing at its meaning, and
 * a plain query lets the ordinary case say plainly what happened.
 */
async function claimedElsewhere(
	db: Database,
	platformId: number,
	handle: string,
	socialAccountId: number
) {
	const rows = await db
		.select({ id: t.socialAccounts.id })
		.from(t.socialAccounts)
		.where(
			and(
				eq(t.socialAccounts.platformId, platformId),
				eq(t.socialAccounts.verifiedHandle, handle),
				ne(t.socialAccounts.id, socialAccountId)
			)
		)
		.limit(1);
	return rows.length > 0;
}

/**
 * MySQL's duplicate-key error, whichever layer wrapped it.
 *
 * Both spellings are checked because the driver's error survives some paths
 * intact and is re-wrapped in others, and the two wrappings keep different
 * halves of it.
 */
function isDuplicateKey(err: unknown): boolean {
	if (typeof err !== 'object' || err === null) return false;
	const candidate = err as { code?: unknown; errno?: unknown };
	return candidate.code === 'ER_DUP_ENTRY' || candidate.errno === 1062;
}

/**
 * Reads the profile and decides what it proves.
 *
 * Every ending is recorded on the row — the time of the attempt and a word for
 * how it went — so the page can say when we last looked rather than implying
 * the verdict is fresh, and so an operator reading a dispute can see the
 * history rather than the last frame of it.
 */
export async function verifyOwnership(
	db: Database,
	socialAccountId: number,
	creatorId: number
): Promise<OwnershipOutcome> {
	const channel = await channelFor(db, socialAccountId, creatorId);
	if (!channel) return { kind: 'no_channel' };

	const platform = channel.platform;
	if (!fetchablePlatform(platform)) return { kind: 'not_fetchable', platform };

	/* Counted before the lookup, so a refused attempt still costs an attempt —
	   otherwise the limit only slows down the requests that succeed. */
	const decision = take(`ownership:${creatorId}`, VERIFY_LIMIT);
	if (!decision.ok) return { kind: 'rate_limited', retryAfter: decision.retryAfter };

	const now = new Date();
	const code = channel.code ?? (await issueCode(db, socialAccountId, creatorId))?.code;
	if (!code) return { kind: 'no_channel' };

	const profile = await fetchPublicProfile(platform, channel.handle);

	if (!profile.ok) {
		await db
			.update(t.socialAccounts)
			.set({ ownershipCheckedAt: now, ownershipDetail: profile.reason })
			.where(eq(t.socialAccounts.id, channel.id));
		return { kind: 'unreachable', platform, reason: profile.reason };
	}

	if (!bioContainsCode(profile.bio, code)) {
		await db
			.update(t.socialAccounts)
			.set({ ownershipCheckedAt: now, ownershipDetail: 'code_not_found' })
			.where(eq(t.socialAccounts.id, channel.id));
		return { kind: 'code_not_found', platform };
	}

	/*
	 * Lower-cased for the claim, and only for the claim. Handles are
	 * case-insensitive on all four of these platforms, so "@Nuru" and "@nuru"
	 * are one account and must collide in the index; the creator's own spelling
	 * stays untouched in `handle`, which is what their profile displays.
	 */
	const claim = normaliseHandle(channel.handle).toLowerCase();
	if (await claimedElsewhere(db, channel.platformId, claim, channel.id)) {
		await db
			.update(t.socialAccounts)
			.set({ ownershipCheckedAt: now, ownershipDetail: 'handle_claimed' })
			.where(eq(t.socialAccounts.id, channel.id));
		return { kind: 'taken', platform };
	}

	try {
		await db
			.update(t.socialAccounts)
			.set({
				ownershipStatus: 'verified',
				ownershipVerifiedAt: now,
				ownershipCheckedAt: now,
				ownershipDetail: 'ok',
				verifiedHandle: claim,
				/* The claim this has been the evidence for all along. */
				isVerified: true,
				/* The profile we just read is also where the count came from, so it
				   carries the platform's word rather than the creator's. A count the
				   platform hides leaves the existing figure exactly as it was. */
				...(profile.followers === null
					? {}
					: {
							followers: profile.followers,
							followersSource: 'bio_code' as const,
							followersUpdatedAt: now
						})
			})
			.where(eq(t.socialAccounts.id, channel.id));
	} catch (err) {
		/* Two presses at once; the other one got there first. */
		if (isDuplicateKey(err)) return { kind: 'taken', platform };
		throw err;
	}

	if (profile.followers !== null) await refreshReach(db, creatorId);

	/* A proved channel is a confirmed channel, so this is the moment the creator
	   reaches `social_verified` and becomes visible in the directory. The
	   operator queue is for the channels nobody has proved this way. */
	await recalcCreatorVerification(db, creatorId);

	return { kind: 'verified', handle: channel.handle, platform, followers: profile.followers };
}

/**
 * The way out when the platform will not talk to us.
 *
 * The creator types the number themselves and it is stored as exactly what it
 * is: `self_reported`, with `unverified` beside it, which is weaker than every
 * other source and says so on their own profile. That is the honest trade, and
 * it is the one that keeps a platform's refusal from becoming the creator's
 * problem.
 */
export async function saveManualCount(
	db: Database,
	socialAccountId: number,
	creatorId: number,
	followers: number
): Promise<boolean> {
	const channel = await channelFor(db, socialAccountId, creatorId);
	if (!channel) return false;

	const now = new Date();
	await db
		.update(t.socialAccounts)
		.set({
			followers,
			followersSource: 'self_reported',
			followersUpdatedAt: now,
			/* A channel that has genuinely been proved keeps its standing; this is
			   only about where the number came from. */
			...(channel.status === 'verified'
				? {}
				: { ownershipStatus: 'unverified' as const, ownershipCheckedAt: now })
		})
		.where(eq(t.socialAccounts.id, channel.id));

	await refreshReach(db, creatorId);
	return true;
}
