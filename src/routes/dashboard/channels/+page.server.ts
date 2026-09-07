import * as m from '$lib/paraglide/messages';
import { asc } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { contentCrud, CrudRefusal } from '$lib/server/crud';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { socialAdd, socialEdit } from '$lib/schemas';
import { requireCreator } from '$lib/server/guards';
import { refreshCreatorReach } from '$lib/server/score-service';
import { verifySubmittedLink } from '$lib/server/social-verify';
import { profileUrlFor } from '$lib/domain/social-link';

/**
 * The handle is looked up at the platform before the row is written.
 *
 * Checked on edit as well as on add, and not only because a handle can be
 * corrected: a check that ran on create alone would be a formality anyone could
 * walk past by saving a real account and then editing it into a fabricated one.
 *
 * Only an unambiguous `not_found` refuses. A platform that did not answer, or
 * one nobody can check anonymously — Instagram, Facebook, LinkedIn — comes back
 * `unknown`, and `unknown` saves: it is a statement about this server's reach,
 * not about the creator. The verdict is stored either way, so the listing can
 * say when it was last looked at rather than implying it is fresh.
 */
async function checkLink(values: Record<string, unknown>) {
	const platformId = Number(values.platformId);
	const handle = String(values.handle ?? '');
	const verdict = await verifySubmittedLink(platformId, handle);

	if (verdict.status === 'not_found') {
		throw new CrudRefusal(
			m.sc_refused({ platform: verdict.platform ?? '', url: verdict.url ?? '' })
		);
	}

	return {
		linkStatus: verdict.status,
		linkCheckedAt: new Date(),
		/* An empty URL field is filled in from the handle, since the check has
		   just proved that is where the account lives. One the creator typed is
		   left exactly as they typed it. */
		...(values.profileUrl
			? {}
			: { profileUrl: verdict.url ?? profileUrlFor(verdict.platform ?? '', handle) })
	};
}

/** Linked social accounts. Total reach is recomputed from them after each write. */
const crudFor = (creatorId: number) =>
	contentCrud({
		table: t.socialAccounts,
		label: () => m.ch_label(),
		addSchema: socialAdd,
		editSchema: socialEdit,
		scope: { column: t.socialAccounts.creatorId, key: 'creatorId', value: creatorId },
		beforeWrite: (_event, values) => checkLink(values),
		afterWrite: () => refreshCreatorReach(creatorId)
	});

export const load = async (event: RequestEvent) => {
	const { creator } = await requireCreator(event);
	const [base, platforms] = await Promise.all([
		crudFor(creator.id).load(event),
		db.select().from(t.platforms).orderBy(asc(t.platforms.sortOrder))
	]);
	return { ...base, platforms };
};

export const actions = {
	add: async (event: RequestEvent) => {
		const { creator } = await requireCreator(event);
		return crudFor(creator.id).actions.add(event);
	},
	edit: async (event: RequestEvent) => {
		const { creator } = await requireCreator(event);
		return crudFor(creator.id).actions.edit(event);
	},
	delete: async (event: RequestEvent) => {
		const { creator } = await requireCreator(event);
		return crudFor(creator.id).actions.delete(event);
	}
};
