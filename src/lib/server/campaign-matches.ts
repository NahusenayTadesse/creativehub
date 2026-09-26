import { maskedBrandName } from '$lib/server/nda';
import * as m from '$lib/paraglide/messages';
import { and, count, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { db, rowsAffected } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { notify } from '$lib/server/notify';
import { recordAudit } from '$lib/server/guards';
import { getReferenceData, listClaimedCreatorCards } from '$lib/server/queries';
import { ADJACENT_CATEGORIES, selectCampaignMatches } from '$lib/domain/match';

/**
 * Telling the creators a new brief fits.
 *
 * Discovery already scores every creator against a brief when a brand asks —
 * that is how the fit column there is ordered. Until now nothing turned that
 * number round: a creator found a brief only by going looking. This runs once
 * per brief, on its first publish, and tells the best-fitting creators it
 * exists. The rules for who qualifies are `selectCampaignMatches`.
 *
 * Called without awaiting from the action that published the brief: the brand
 * who clicked publish should not wait while a few dozen notifications and
 * emails go out, and a failure here must not look to them like the publish
 * failed. It logs instead.
 */
export async function notifyCampaignMatches(
	campaignId: number,
	actor: { id: string; label: string | null }
): Promise<number> {
	const rows = await db
		.select({
			id: t.campaigns.id,
			title: t.campaigns.title,
			slug: t.campaigns.slug,
			status: t.campaigns.status,
			matchNotifiedAt: t.campaigns.matchNotifiedAt,
			categoryId: t.campaigns.categoryId,
			platformIds: t.campaigns.platformIds,
			countryId: t.campaigns.countryId,
			targetRegions: t.campaigns.targetRegions,
			budgetMax: t.campaigns.budgetMax,
			followerMin: t.campaigns.followerMin,
			followerMax: t.campaigns.followerMax,
			compensationType: t.campaigns.compensationType,
			organizationName: t.organizations.name,
			organizationIndustry: t.organizations.industry,
			confidential: t.campaigns.confidential
		})
		.from(t.campaigns)
		.innerJoin(t.organizations, eq(t.organizations.id, t.campaigns.organizationId))
		.where(and(eq(t.campaigns.id, campaignId), isNull(t.campaigns.deletedAt)))
		.limit(1);

	const campaign = rows.at(0);
	if (!campaign || campaign.status !== 'published' || campaign.matchNotifiedAt) return 0;

	/*
	 * Claimed before anything is sent, in one conditional write: two saves of the
	 * same brief landing together would otherwise both see "not yet notified"
	 * and both send. Whichever write changes the row is the one that sends.
	 */
	const claim = await db
		.update(t.campaigns)
		.set({ matchNotifiedAt: sql`now(3)`, updatedAt: sql`${t.campaigns.updatedAt}` })
		.where(and(eq(t.campaigns.id, campaignId), isNull(t.campaigns.matchNotifiedAt)));
	if (rowsAffected(claim) === 0) return 0;

	const [reference, candidates, applied] = await Promise.all([
		getReferenceData(),
		listClaimedCreatorCards(),
		db
			.select({ creatorId: t.applications.creatorId })
			.from(t.applications)
			.where(eq(t.applications.campaignId, campaignId))
	]);

	const category = reference.categories.find((row) => row.id === campaign.categoryId);
	const adjacentCategoryIds = (ADJACENT_CATEGORIES[category?.slug ?? ''] ?? [])
		.map((slug) => reference.categories.find((row) => row.slug === slug)?.id)
		.filter((id): id is number => id !== undefined);

	const userIds = candidates.map((creator) => creator.userId);
	/* The weekly cap is counted on the database clock, like the rows it counts. */
	const recent = userIds.length
		? await db
				.select({ userId: t.notifications.userId, n: count() })
				.from(t.notifications)
				.where(
					and(
						inArray(t.notifications.userId, userIds),
						eq(t.notifications.kind, 'campaign_match'),
						gte(t.notifications.createdAt, sql`now() - interval 7 day`)
					)
				)
				.groupBy(t.notifications.userId)
		: [];

	const matches = selectCampaignMatches(
		{
			categoryId: campaign.categoryId,
			platformIds: campaign.platformIds ?? [],
			countryId: campaign.countryId,
			targetRegions: campaign.targetRegions ?? [],
			budgetMax: campaign.budgetMax,
			followerMin: campaign.followerMin,
			followerMax: campaign.followerMax,
			compensationType: campaign.compensationType,
			categoryName: category?.name
		},
		candidates.map((creator) => ({ ...creator, topCountries: creator.topCountries ?? [] })),
		{
			adjacentCategoryIds,
			appliedCreatorIds: new Set(applied.map((row) => row.creatorId)),
			recentByUser: new Map(recent.map((row) => [row.userId, Number(row.n)]))
		}
	);

	/* One notification each, because the body names that creator's own fit. */
	for (const match of matches) {
		await notify(match.userId, {
			category: 'opportunities',
			kind: 'campaign_match',
			title: m.notif_campaign_match_title({ campaign: campaign.title }),
			body: m.notif_campaign_match_body({
				/* The email goes to creators who have not accepted the brief's NDA,
				   so a confidential brief names its industry, not its brand. */
				organization: campaign.confidential
					? maskedBrandName(campaign.organizationIndustry)
					: campaign.organizationName,
				tier: match.breakdown.tierLabel,
				score: match.breakdown.total
			}),
			link: `/campaigns/${campaign.slug}`,
			actionLabel: m.mail_view_campaign(),
			footnote: m.mail_prefs_footnote(),
			actorId: actor.id
		});
	}

	await recordAudit({
		actorId: actor.id,
		actorLabel: actor.label,
		entity: 'campaign',
		entityId: campaignId,
		action: 'matches_notified',
		reason: `${matches.length} of ${candidates.length} claimed creators`
	});

	return matches.length;
}
