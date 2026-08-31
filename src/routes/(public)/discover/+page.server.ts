import * as m from '$lib/paraglide/messages';
import { fail } from '@sveltejs/kit';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { listCreators, creatorFacet } from '$lib/server/queries';
import { getLocalRanker } from '$lib/server/trending-service';
import { getOrganizationFor } from '$lib/server/guards';
import { calculateMatch, ADJACENT_CATEGORIES } from '$lib/domain/match';
import type { CreatorCard } from '$lib/server/queries';

/** How many briefs the match picker offers. It is a chooser, not a listing. */
const MATCH_PICKER_LIMIT = 40;

export const load: PageServerLoad = async ({ url, locals, parent }) => {
	/* `src/routes/+layout.server.ts` already loaded this for every page. Asking
	   again would add five queries to the busiest public route — nothing
	   memoises `getReferenceData`, the comment beside it notwithstanding. */
	const { reference } = await parent();

	/*
	 * The briefs the match panel can score against. A short list on purpose:
	 * this is a dropdown, and the ranking itself happens below over creators.
	 */
	const campaigns = await db
		.select({
			id: t.campaigns.id,
			title: t.campaigns.title,
			categoryId: t.campaigns.categoryId,
			platformIds: t.campaigns.platformIds,
			countryId: t.campaigns.countryId,
			targetRegions: t.campaigns.targetRegions,
			budgetMax: t.campaigns.budgetMax,
			followerMin: t.campaigns.followerMin,
			followerMax: t.campaigns.followerMax,
			compensationType: t.campaigns.compensationType
		})
		.from(t.campaigns)
		.where(and(isNull(t.campaigns.deletedAt), eq(t.campaigns.status, 'published')))
		.orderBy(asc(t.campaigns.title))
		.limit(MATCH_PICKER_LIMIT);

	/*
	 * Fit is arithmetic over columns the database does not hold together —
	 * category membership, channel mix — so ordering by it means ranking in the
	 * server rather than in SQL. `listCreators` caps how far that reaches and
	 * says so on the result.
	 */
	const matchId = Number(url.searchParams.get('campaign') ?? 0);
	const selected = campaigns.find((campaign) => campaign.id === matchId) ?? null;
	const wantsMatch = url.searchParams.get('sort') === 'match' && Boolean(selected);

	const scoreFor = (() => {
		if (!selected) return undefined;
		const campaignCategory = reference.categories.find((c) => c.id === selected.categoryId);
		const adjacentCategoryIds = (ADJACENT_CATEGORIES[campaignCategory?.slug ?? ''] ?? [])
			.map((slug) => reference.categories.find((c) => c.slug === slug)?.id)
			.filter((id): id is number => id !== undefined);

		return (creator: CreatorCard) =>
			calculateMatch({
				campaign: { ...selected, categoryName: campaignCategory?.name },
				creator: {
					...creator,
					topCountries: creator.topCountries ?? []
				},
				adjacentCategoryIds
			}).total;
	})();

	/*
	 * Putting the reader's own market first, when the reader has not already
	 * said how they want this list ordered.
	 *
	 * A chosen sort, a country or region filter, or a brief to match against are
	 * all statements of intent, and quietly reordering underneath any of them
	 * would make the control the reader just used look broken. What is left is
	 * the default view, where "near me" is the better guess than nothing. The
	 * strength and the match level are the operator's, set on the trending
	 * control — see $lib/server/trending-service.ts.
	 */
	const sort = url.searchParams.get('sort');
	const readerChoseOrder =
		wantsMatch ||
		(!!sort && sort !== 'score') ||
		url.searchParams.has('country') ||
		url.searchParams.has('region');
	const local = readerChoseOrder ? null : await getLocalRanker();

	const rank = wantsMatch
		? scoreFor
		: local
			? (creator: CreatorCard) => creator.score + local(creator)
			: undefined;

	const creators = await listCreators(url, rank ? { rank } : {});

	/* Scores for the cards on this page. Cheap: the page is already in hand. */
	const matchScores: Record<number, number> = {};
	if (scoreFor) {
		for (const creator of creators.rows) matchScores[creator.id] = scoreFor(creator);
	}

	const [countryCounts, savedIds] = await Promise.all([
		creatorFacet(url, 'country'),
		savedFor(
			locals.user?.id,
			creators.rows.map((creator) => creator.id)
		)
	]);

	return {
		creators,
		campaigns,
		matchScores,
		matchCampaignId: selected?.id ?? null,
		countryCounts,
		savedIds
	};
};

/**
 * Which of the creators on this page the reader's organisation has shortlisted.
 *
 * Scoped to the page rather than to the whole shortlist: the badges only need
 * an answer for the cards on screen, and a brand's saved list has no ceiling.
 */
async function savedFor(userId: string | undefined, creatorIds: number[]): Promise<number[]> {
	if (!userId || !creatorIds.length) return [];

	const organization = await getOrganizationFor(userId);
	if (!organization) return [];

	const rows = await db
		.select({ creatorId: t.savedCreators.creatorId })
		.from(t.savedCreators)
		.where(
			and(
				eq(t.savedCreators.organizationId, organization.id),
				inArray(t.savedCreators.creatorId, creatorIds)
			)
		);

	return rows.map((row) => row.creatorId);
}

export const actions: Actions = {
	/** Adds or removes a creator from the acting organisation's shortlist. */
	toggleSave: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: m.srv_sign_in_to_save() });

		const organization = await getOrganizationFor(locals.user.id);
		if (!organization) return fail(403, { message: m.srv_brands_only_shortlist() });

		const form = await request.formData();
		const creatorId = Number(form.get('creatorId'));
		if (!creatorId) return fail(400, { message: m.srv_unknown_creator() });

		const existing = await db
			.select({ id: t.savedCreators.id })
			.from(t.savedCreators)
			.where(
				and(
					eq(t.savedCreators.organizationId, organization.id),
					eq(t.savedCreators.creatorId, creatorId)
				)
			)
			.limit(1);

		if (existing.length) {
			await db.delete(t.savedCreators).where(eq(t.savedCreators.id, existing[0].id));
			return { saved: false };
		}

		await db.insert(t.savedCreators).values({
			organizationId: organization.id,
			creatorId,
			createdBy: locals.user.id
		});
		return { saved: true };
	}
};
