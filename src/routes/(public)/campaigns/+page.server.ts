import type { PageServerLoad } from './$types';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { listCampaigns, campaignFacet, countCampaignsAcrossMarkets } from '$lib/server/queries';
import { getCreatorFor } from '$lib/server/guards';

export const load: PageServerLoad = async ({ url, locals }) => {
	const scope = { publicOnly: true } as const;

	const [campaigns, typeCounts, allMarketsTotal] = await Promise.all([
		listCampaigns(url, scope),
		campaignFacet(url, 'type', scope),
		countCampaignsAcrossMarkets(url, scope)
	]);

	/*
	 * Which of the briefs on this page the signed-in creator has already
	 * pitched on. Asked about the page rather than the creator's whole history,
	 * which is what the badges actually need.
	 */
	let appliedCampaignIds: number[] = [];
	let creatorId: number | null = null;

	if (locals.user) {
		const creator = await getCreatorFor(locals.user.id);
		if (creator) {
			creatorId = creator.id;
			const ids = campaigns.rows.map((campaign) => campaign.id);
			if (ids.length) {
				const rows = await db
					.select({ campaignId: t.applications.campaignId })
					.from(t.applications)
					.where(
						and(
							eq(t.applications.creatorId, creator.id),
							isNull(t.applications.deletedAt),
							inArray(t.applications.campaignId, ids)
						)
					);
				appliedCampaignIds = rows.map((row) => row.campaignId);
			}
		}
	}

	return { campaigns, typeCounts, allMarketsTotal, appliedCampaignIds, creatorId };
};
