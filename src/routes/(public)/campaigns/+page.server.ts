import type { PageServerLoad } from './$types';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { listCampaigns } from '$lib/server/queries';
import { getCreatorFor } from '$lib/server/guards';

export const load: PageServerLoad = async ({ locals }) => {
	const campaigns = await listCampaigns({ publicOnly: true });

	/* A signed-in creator sees which briefs they have already pitched on. */
	let appliedCampaignIds: number[] = [];
	let creatorId: number | null = null;

	if (locals.user) {
		const creator = await getCreatorFor(locals.user.id);
		if (creator) {
			creatorId = creator.id;
			const rows = await db
				.select({ campaignId: t.applications.campaignId })
				.from(t.applications)
				.where(eq(t.applications.creatorId, creator.id));
			appliedCampaignIds = rows.map((row) => row.campaignId);
		}
	}

	return { campaigns, appliedCampaignIds, creatorId };
};
