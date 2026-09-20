import * as m from '$lib/paraglide/messages';
import { fail } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import type { PageServerLoad, Actions, RequestEvent } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { channelOwnershipQuery, ownershipQueueScope } from '$lib/server/queries';
import { referenceDataGuard, recordAudit } from '$lib/server/guards';
import { recalcCreatorVerification } from '$lib/server/db/creator-verification';
import { channelOwnershipDecision } from '$lib/schemas';

/**
 * Confirming that a handle really belongs to the creator claiming it.
 *
 * The creator used to tick this for themselves, on their own channels form,
 * over a label that said an operator had done it. Now somebody actually does:
 * this is the queue, and until a creator has one confirmed channel they are
 * hidden from the directory and refused by trending. That makes the queue the
 * gate on new supply, which is why an encoder works it as well as an operator —
 * it is the same job as entering the profiles in the first place.
 *
 * Nothing here is irreversible. Confirming and un-confirming are the same
 * action with a different answer, and both are written to the audit log with
 * the handle they were about.
 */
export const load: PageServerLoad = async (event) => {
	/*
	 * Opens on what is waiting. `?state=all` falls outside the filter's
	 * vocabulary and so drops out, showing everything — the same convention the
	 * figure-proof and verification queues use.
	 */
	const scope = event.url.searchParams.get('state') ? [] : [eq(t.socialAccounts.isVerified, false)];

	const [channels, platforms, waiting, confirmed] = await Promise.all([
		channelOwnershipQuery.run(event.url, { where: [...ownershipQueueScope(), ...scope] }),
		db.select().from(t.platforms).orderBy(t.platforms.sortOrder),
		countIn(false),
		countIn(true)
	]);

	return { channels, platforms, counts: { unconfirmed: waiting, confirmed } };
};

/** The two tabs' totals, over the whole queue rather than the page. */
async function countIn(isVerified: boolean) {
	const rows = await db
		.select({ id: t.socialAccounts.id })
		.from(t.socialAccounts)
		.innerJoin(t.creators, eq(t.creators.id, t.socialAccounts.creatorId))
		.where(and(eq(t.socialAccounts.isVerified, isVerified), ...ownershipQueueScope()));
	return rows.length;
}

export const actions: Actions = {
	/**
	 * One operator's answer about one channel.
	 *
	 * The creator's verification level is recomputed straight afterwards, since
	 * this is the only thing that moves them on or off the bottom rung — and
	 * that rung is what the directory and the trending board read.
	 */
	decide: async (event: RequestEvent) => {
		const user = referenceDataGuard(event);

		const form = await event.request.formData();
		const parsed = channelOwnershipDecision.safeParse({
			id: form.get('id'),
			confirmed: form.get('confirmed')
		});
		if (!parsed.success) return fail(400, { message: m.srv_invalid_request() });

		const channel = (
			await db
				.select({
					id: t.socialAccounts.id,
					creatorId: t.socialAccounts.creatorId,
					handle: t.socialAccounts.handle,
					isVerified: t.socialAccounts.isVerified,
					platform: t.platforms.name
				})
				.from(t.socialAccounts)
				.leftJoin(t.platforms, eq(t.platforms.id, t.socialAccounts.platformId))
				.where(and(eq(t.socialAccounts.id, parsed.data.id), isNull(t.socialAccounts.deletedAt)))
				.limit(1)
		).at(0);
		if (!channel) return fail(404, { message: m.cown_not_found() });

		/* Nothing to do, and saying so beats writing an audit line that records
		   somebody confirming what was already confirmed. */
		if (channel.isVerified === parsed.data.confirmed) {
			return { channel: { id: channel.id, confirmed: channel.isVerified, unchanged: true } };
		}

		await db
			.update(t.socialAccounts)
			.set({ isVerified: parsed.data.confirmed, updatedBy: user.id })
			.where(eq(t.socialAccounts.id, channel.id));

		await recalcCreatorVerification(db, channel.creatorId);

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name ?? user.email ?? 'operator',
			entity: 'social_account',
			entityId: channel.id,
			action: parsed.data.confirmed ? 'ownership_confirmed' : 'ownership_withdrawn',
			toState: parsed.data.confirmed ? 'confirmed' : 'unconfirmed',
			reason: `${channel.platform ?? 'channel'} @${channel.handle}`
		});

		return { channel: { id: channel.id, confirmed: parsed.data.confirmed, unchanged: false } };
	}
};
