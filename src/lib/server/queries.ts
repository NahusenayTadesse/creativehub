import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { liveSocialFilter, ratingReviewFilter } from '$lib/server/db/rollups';

/** Rows that exist and have not been soft-deleted. */
const live = <T extends { isActive: any; deletedAt: any }>(table: T) =>
	and(eq(table.isActive, true), isNull(table.deletedAt));

/* ------------------------------------------------------------------ *
 * Reference data — small, cached per request by the layout load.
 * ------------------------------------------------------------------ */

export const listCountries = () =>
	db.select().from(t.countries).where(live(t.countries)).orderBy(asc(t.countries.sortOrder));

export const listRegions = () =>
	db.select().from(t.regions).where(live(t.regions)).orderBy(asc(t.regions.sortOrder));

export const listCategories = () =>
	db.select().from(t.categories).where(live(t.categories)).orderBy(asc(t.categories.sortOrder));

export const listPlatforms = () =>
	db.select().from(t.platforms).where(live(t.platforms)).orderBy(asc(t.platforms.sortOrder));

export const listLanguages = () =>
	db.select().from(t.languages).where(live(t.languages)).orderBy(asc(t.languages.sortOrder));

export const getSettings = async () => (await db.select().from(t.siteSettings).limit(1)).at(0);

/** Everything the filter panels need, in one round trip. */
export async function getReferenceData() {
	const [countries, regions, categories, platforms, languages] = await Promise.all([
		listCountries(),
		listRegions(),
		listCategories(),
		listPlatforms(),
		listLanguages()
	]);
	return { countries, regions, categories, platforms, languages };
}

/* ------------------------------------------------------------------ *
 * Creators
 * ------------------------------------------------------------------ */

export type CreatorCard = Awaited<ReturnType<typeof listCreators>>[number];

/**
 * Published creators with the joined labels discovery needs, plus their
 * category ids so the client can filter without another query.
 */
export async function listCreators(options: { featured?: boolean; trending?: boolean } = {}) {
	const conditions = [live(t.creators), eq(t.creators.isPublished, true)];
	if (options.featured) conditions.push(eq(t.creators.isFeatured, true));
	if (options.trending) conditions.push(eq(t.creators.isTrending, true));

	const rows = await db
		.select({
			id: t.creators.id,
			username: t.creators.username,
			fullName: t.creators.fullName,
			avatar: t.creators.avatar,
			cover: t.creators.cover,
			bio: t.creators.bio,
			city: t.creators.city,
			totalReach: t.creators.totalReach,
			startingPrice: t.creators.startingPrice,
			currencyCode: t.creators.currencyCode,
			score: t.creators.score,
			verificationLevel: t.creators.verificationLevel,
			availability: t.creators.availability,
			isFeatured: t.creators.isFeatured,
			isTrending: t.creators.isTrending,
			overseasPercentage: t.creators.overseasPercentage,
			topCountries: t.creators.topCountries,
			reviewsCount: t.creators.reviewsCount,
			averageRating: t.creators.averageRating,
			completedBookings: t.creators.completedBookings,
			countryId: t.creators.countryId,
			countryName: t.countries.name,
			countryFlag: t.countries.flag,
			regionId: t.creators.regionId,
			regionName: t.regions.name,
			platformId: t.creators.primaryPlatformId,
			platformName: t.platforms.name
		})
		.from(t.creators)
		.leftJoin(t.countries, eq(t.countries.id, t.creators.countryId))
		.leftJoin(t.regions, eq(t.regions.id, t.creators.regionId))
		.leftJoin(t.platforms, eq(t.platforms.id, t.creators.primaryPlatformId))
		.where(and(...conditions))
		.orderBy(desc(t.creators.score));

	if (!rows.length) return [];

	const ids = rows.map((row) => row.id);
	const [cats, socials] = await Promise.all([
		db
			.select({
				creatorId: t.creatorCategories.creatorId,
				categoryId: t.creatorCategories.categoryId,
				name: t.categories.name
			})
			.from(t.creatorCategories)
			.innerJoin(t.categories, eq(t.categories.id, t.creatorCategories.categoryId))
			.where(inArray(t.creatorCategories.creatorId, ids)),
		db
			.select({
				creatorId: t.socialAccounts.creatorId,
				platformId: t.socialAccounts.platformId,
				engagementRate: t.socialAccounts.engagementRate
			})
			.from(t.socialAccounts)
			/* Same definition the profile page and the score use, so a card and the
			   profile it opens cannot disagree about a creator's channels. */
			.where(and(inArray(t.socialAccounts.creatorId, ids), liveSocialFilter()))
	]);

	const cards = rows.map((row) => {
		const mine = socials.filter((s) => s.creatorId === row.id);
		return {
			...row,
			categoryIds: cats.filter((c) => c.creatorId === row.id).map((c) => c.categoryId),
			categories: cats.filter((c) => c.creatorId === row.id).map((c) => c.name),
			platformIds: mine.map((s) => s.platformId),
			engagementRate: mine.length
				? Number((mine.reduce((sum, s) => sum + s.engagementRate, 0) / mine.length).toFixed(1))
				: 0
		};
	});

	/*
	 * The trending strip is an ordered board, not a set: slot 1 was earned. The
	 * flag above is what the run wrote, so the ids always match; the ranks are
	 * read separately only to put them back in the operator's order. Falls back
	 * to score order when no board has been published yet.
	 */
	if (options.trending) {
		const board = await db
			.select({ creatorId: t.trendingEntries.creatorId, rank: t.trendingEntries.rank })
			.from(t.trendingEntries)
			.orderBy(asc(t.trendingEntries.rank));
		if (board.length) {
			const rankOf = new Map(board.map((entry) => [entry.creatorId, entry.rank]));
			cards.sort((a, b) => (rankOf.get(a.id) ?? Infinity) - (rankOf.get(b.id) ?? Infinity));
		}
	}

	return cards;
}

/** A full profile page: creator, related lists and published reviews. */
export async function getCreatorByUsername(username: string) {
	const rows = await db
		.select()
		.from(t.creators)
		.where(and(eq(t.creators.username, username), isNull(t.creators.deletedAt)))
		.limit(1);

	const creator = rows.at(0);
	if (!creator) return null;

	return { ...(await hydrateCreator(creator)) };
}

export async function getCreatorById(id: number) {
	const rows = await db.select().from(t.creators).where(eq(t.creators.id, id)).limit(1);
	const creator = rows.at(0);
	return creator ? hydrateCreator(creator) : null;
}

async function hydrateCreator(creator: typeof t.creators.$inferSelect) {
	const [country, region, platform, cats, langs, socials, pkgs, portfolio, revs, breakdown] =
		await Promise.all([
			creator.countryId
				? db.select().from(t.countries).where(eq(t.countries.id, creator.countryId)).limit(1)
				: [],
			creator.regionId
				? db.select().from(t.regions).where(eq(t.regions.id, creator.regionId)).limit(1)
				: [],
			creator.primaryPlatformId
				? db
						.select()
						.from(t.platforms)
						.where(eq(t.platforms.id, creator.primaryPlatformId))
						.limit(1)
				: [],
			db
				.select({ id: t.categories.id, name: t.categories.name })
				.from(t.creatorCategories)
				.innerJoin(t.categories, eq(t.categories.id, t.creatorCategories.categoryId))
				.where(eq(t.creatorCategories.creatorId, creator.id)),
			db
				.select({ id: t.languages.id, name: t.languages.name })
				.from(t.creatorLanguages)
				.innerJoin(t.languages, eq(t.languages.id, t.creatorLanguages.languageId))
				.where(eq(t.creatorLanguages.creatorId, creator.id)),
			db
				.select({
					id: t.socialAccounts.id,
					handle: t.socialAccounts.handle,
					followers: t.socialAccounts.followers,
					engagementRate: t.socialAccounts.engagementRate,
					isVerified: t.socialAccounts.isVerified,
					profileUrl: t.socialAccounts.profileUrl,
					platformId: t.socialAccounts.platformId,
					platformName: t.platforms.name
				})
				.from(t.socialAccounts)
				.leftJoin(t.platforms, eq(t.platforms.id, t.socialAccounts.platformId))
				.where(and(eq(t.socialAccounts.creatorId, creator.id), liveSocialFilter()))
				.orderBy(desc(t.socialAccounts.followers)),
			db
				.select({
					id: t.packages.id,
					title: t.packages.title,
					description: t.packages.description,
					deliverables: t.packages.deliverables,
					price: t.packages.price,
					currencyCode: t.packages.currencyCode,
					deliveryDays: t.packages.deliveryDays,
					revisions: t.packages.revisions,
					platformId: t.packages.platformId,
					platformName: t.platforms.name
				})
				.from(t.packages)
				.leftJoin(t.platforms, eq(t.platforms.id, t.packages.platformId))
				.where(and(eq(t.packages.creatorId, creator.id), live(t.packages)))
				.orderBy(asc(t.packages.sortOrder)),
			db
				.select({
					id: t.portfolioItems.id,
					mediaType: t.portfolioItems.mediaType,
					url: t.portfolioItems.url,
					caption: t.portfolioItems.caption,
					views: t.portfolioItems.views,
					likes: t.portfolioItems.likes,
					platformName: t.platforms.name
				})
				.from(t.portfolioItems)
				.leftJoin(t.platforms, eq(t.platforms.id, t.portfolioItems.platformId))
				.where(and(eq(t.portfolioItems.creatorId, creator.id), live(t.portfolioItems)))
				.orderBy(asc(t.portfolioItems.sortOrder)),
			getCreatorReviews(creator.id),
			getCreatorRatingBreakdown(creator.id)
		]);

	return {
		...creator,
		country: country.at(0) ?? null,
		region: region.at(0) ?? null,
		platform: platform.at(0) ?? null,
		categories: cats,
		languages: langs,
		socialAccounts: socials,
		packages: pkgs,
		portfolio,
		/* The first page only. `reviewsCount` says how many there are in total,
		   and the profile fetches the rest from the reviews endpoint. */
		reviews: revs,
		ratingBreakdown: breakdown
	};
}

/** How many reviews a profile shows before the reader asks for more. */
export const REVIEW_PAGE_SIZE = 5;

/**
 * One page of the reviews that count towards a creator's rating, newest
 * first. The profile load and the reviews endpoint both come through here, so
 * a later page is drawn from the same set as the first.
 */
export async function getCreatorReviews(creatorId: number, offset = 0, limit = REVIEW_PAGE_SIZE) {
	return (
		db
			.select({
				id: t.reviews.id,
				rating: t.reviews.rating,
				communication: t.reviews.communication,
				professionalism: t.reviews.professionalism,
				timeliness: t.reviews.timeliness,
				quality: t.reviews.quality,
				body: t.reviews.body,
				createdAt: t.reviews.createdAt,
				organizationName: t.organizations.name
			})
			.from(t.reviews)
			.leftJoin(t.organizations, eq(t.organizations.id, t.reviews.organizationId))
			.where(and(eq(t.reviews.creatorId, creatorId), ratingReviewFilter()))
			/* Two reviews can share a timestamp, so the id keeps the order total —
		   without it a row could repeat or be skipped across pages. */
			.orderBy(desc(t.reviews.createdAt), desc(t.reviews.id))
			.limit(limit)
			.offset(offset)
	);
}

/**
 * The per-criterion averages behind the rating bars. Computed over every
 * review that counts rather than the page on screen, so the bars do not move
 * as more reviews load.
 */
async function getCreatorRatingBreakdown(creatorId: number) {
	const rows = await db
		.select({
			communication: sql<number>`coalesce(avg(${t.reviews.communication}), 0)`,
			professionalism: sql<number>`coalesce(avg(${t.reviews.professionalism}), 0)`,
			timeliness: sql<number>`coalesce(avg(${t.reviews.timeliness}), 0)`,
			quality: sql<number>`coalesce(avg(${t.reviews.quality}), 0)`
		})
		.from(t.reviews)
		.where(and(eq(t.reviews.creatorId, creatorId), ratingReviewFilter()));

	const row = rows.at(0);
	return {
		communication: Number(row?.communication ?? 0),
		professionalism: Number(row?.professionalism ?? 0),
		timeliness: Number(row?.timeliness ?? 0),
		quality: Number(row?.quality ?? 0)
	};
}

/* ------------------------------------------------------------------ *
 * Campaigns
 * ------------------------------------------------------------------ */

export async function listCampaigns(
	options: { organizationId?: number; publicOnly?: boolean; slug?: string } = {}
) {
	const conditions = [isNull(t.campaigns.deletedAt)];
	if (options.publicOnly) conditions.push(eq(t.campaigns.status, 'published'));
	if (options.organizationId)
		conditions.push(eq(t.campaigns.organizationId, options.organizationId));
	if (options.slug) conditions.push(eq(t.campaigns.slug, options.slug));

	return db
		.select({
			id: t.campaigns.id,
			title: t.campaigns.title,
			slug: t.campaigns.slug,
			description: t.campaigns.description,
			objective: t.campaigns.objective,
			compensationType: t.campaigns.compensationType,
			creatorsNeeded: t.campaigns.creatorsNeeded,
			followerMin: t.campaigns.followerMin,
			followerMax: t.campaigns.followerMax,
			budgetMin: t.campaigns.budgetMin,
			budgetMax: t.campaigns.budgetMax,
			currencyCode: t.campaigns.currencyCode,
			barterDetails: t.campaigns.barterDetails,
			eventName: t.campaigns.eventName,
			eventDate: t.campaigns.eventDate,
			eventLocation: t.campaigns.eventLocation,
			passType: t.campaigns.passType,
			deliverables: t.campaigns.deliverables,
			deadline: t.campaigns.deadline,
			language: t.campaigns.language,
			tags: t.campaigns.tags,
			status: t.campaigns.status,
			applicationsCount: t.campaigns.applicationsCount,
			platformIds: t.campaigns.platformIds,
			targetRegions: t.campaigns.targetRegions,
			createdAt: t.campaigns.createdAt,
			categoryId: t.campaigns.categoryId,
			categoryName: t.categories.name,
			countryId: t.campaigns.countryId,
			countryName: t.countries.name,
			countryFlag: t.countries.flag,
			organizationId: t.campaigns.organizationId,
			organizationName: t.organizations.name,
			organizationLogo: t.organizations.logo,
			orgType: t.organizations.orgType
		})
		.from(t.campaigns)
		.leftJoin(t.categories, eq(t.categories.id, t.campaigns.categoryId))
		.leftJoin(t.countries, eq(t.countries.id, t.campaigns.countryId))
		.innerJoin(t.organizations, eq(t.organizations.id, t.campaigns.organizationId))
		.where(and(...conditions))
		.orderBy(desc(t.campaigns.createdAt));
}

/** One campaign by its slug — matched in SQL, not by scanning every campaign. */
export async function getCampaignBySlug(slug: string) {
	const rows = await listCampaigns({ slug });
	return rows.at(0) ?? null;
}

/* ------------------------------------------------------------------ *
 * Bookings
 * ------------------------------------------------------------------ */

export type BookingRow = Awaited<ReturnType<typeof listBookings>>[number];

export async function listBookings(
	filter: { id?: number; creatorId?: number; organizationId?: number } = {}
) {
	const conditions = [isNull(t.bookings.deletedAt)];
	if (filter.id) conditions.push(eq(t.bookings.id, filter.id));
	if (filter.creatorId) conditions.push(eq(t.bookings.creatorId, filter.creatorId));
	if (filter.organizationId) conditions.push(eq(t.bookings.organizationId, filter.organizationId));

	return db
		.select({
			id: t.bookings.id,
			reference: t.bookings.reference,
			title: t.bookings.title,
			deliverables: t.bookings.deliverables,
			compensationType: t.bookings.compensationType,
			price: t.bookings.price,
			currencyCode: t.bookings.currencyCode,
			platformFee: t.bookings.platformFee,
			creatorPayout: t.bookings.creatorPayout,
			status: t.bookings.status,
			escrowStatus: t.bookings.escrowStatus,
			paymentMethod: t.bookings.paymentMethod,
			paymentRef: t.bookings.paymentRef,
			deadline: t.bookings.deadline,
			revisionsUsed: t.bookings.revisionsUsed,
			revisionsAllowed: t.bookings.revisionsAllowed,
			termsSnapshot: t.bookings.termsSnapshot,
			termsFrozenAt: t.bookings.termsFrozenAt,
			completedAt: t.bookings.completedAt,
			createdAt: t.bookings.createdAt,
			campaignId: t.bookings.campaignId,
			creatorId: t.bookings.creatorId,
			creatorName: t.creators.fullName,
			creatorUsername: t.creators.username,
			creatorAvatar: t.creators.avatar,
			organizationId: t.bookings.organizationId,
			organizationName: t.organizations.name,
			organizationLogo: t.organizations.logo
		})
		.from(t.bookings)
		.innerJoin(t.creators, eq(t.creators.id, t.bookings.creatorId))
		.innerJoin(t.organizations, eq(t.organizations.id, t.bookings.organizationId))
		.where(and(...conditions))
		.orderBy(desc(t.bookings.createdAt));
}

export async function getBookingDetail(bookingId: number) {
	/* Filtered in SQL. This used to select every booking on the platform, join
	   both sides, and discard all but one — on every load of the detail page. */
	const [booking] = await listBookings({ id: bookingId });
	if (!booking) return null;

	const [proposals, subs, msgs, revs] = await Promise.all([
		db
			.select()
			.from(t.termProposals)
			.where(eq(t.termProposals.bookingId, bookingId))
			.orderBy(asc(t.termProposals.createdAt)),
		db
			.select()
			.from(t.submissions)
			.where(eq(t.submissions.bookingId, bookingId))
			.orderBy(desc(t.submissions.createdAt)),
		db
			.select({
				id: t.messages.id,
				body: t.messages.body,
				isMasked: t.messages.isMasked,
				createdAt: t.messages.createdAt,
				senderId: t.messages.senderId,
				senderName: t.user.name,
				senderRole: t.user.role
			})
			.from(t.messages)
			.leftJoin(t.user, eq(t.user.id, t.messages.senderId))
			.where(eq(t.messages.bookingId, bookingId))
			.orderBy(asc(t.messages.createdAt)),
		db.select().from(t.reviews).where(eq(t.reviews.bookingId, bookingId))
	]);

	return { booking, proposals, submissions: subs, messages: msgs, reviews: revs };
}

/* ------------------------------------------------------------------ *
 * Applications
 * ------------------------------------------------------------------ */

export async function listApplications(
	filter: { creatorId?: number; organizationId?: number; campaignId?: number } = {}
) {
	const conditions = [isNull(t.applications.deletedAt)];
	if (filter.creatorId) conditions.push(eq(t.applications.creatorId, filter.creatorId));
	if (filter.campaignId) conditions.push(eq(t.applications.campaignId, filter.campaignId));
	if (filter.organizationId) {
		conditions.push(eq(t.campaigns.organizationId, filter.organizationId));
	}

	return db
		.select({
			id: t.applications.id,
			pitch: t.applications.pitch,
			proposedPrice: t.applications.proposedPrice,
			currencyCode: t.applications.currencyCode,
			status: t.applications.status,
			decisionNote: t.applications.decisionNote,
			createdAt: t.applications.createdAt,
			campaignId: t.applications.campaignId,
			campaignTitle: t.campaigns.title,
			campaignSlug: t.campaigns.slug,
			compensationType: t.campaigns.compensationType,
			organizationId: t.campaigns.organizationId,
			organizationName: t.organizations.name,
			creatorId: t.applications.creatorId,
			creatorName: t.creators.fullName,
			creatorUsername: t.creators.username,
			creatorAvatar: t.creators.avatar,
			creatorScore: t.creators.score,
			creatorReach: t.creators.totalReach
		})
		.from(t.applications)
		.innerJoin(t.campaigns, eq(t.campaigns.id, t.applications.campaignId))
		.innerJoin(t.organizations, eq(t.organizations.id, t.campaigns.organizationId))
		.innerJoin(t.creators, eq(t.creators.id, t.applications.creatorId))
		.where(and(...conditions))
		.orderBy(desc(t.applications.createdAt));
}

/* ------------------------------------------------------------------ *
 * Dashboard aggregates
 * ------------------------------------------------------------------ */

export async function getPlatformStats() {
	const [creatorCount, campaignCount, bookingAgg, orgCount] = await Promise.all([
		db
			.select({ count: sql<number>`count(*)` })
			.from(t.creators)
			.where(and(live(t.creators), eq(t.creators.isPublished, true))),
		db
			.select({ count: sql<number>`count(*)` })
			.from(t.campaigns)
			/* Every other count here excludes deleted rows; this one inflated the
			   homepage figure with them. */
			.where(and(eq(t.campaigns.status, 'published'), isNull(t.campaigns.deletedAt))),
		db
			.select({
				count: sql<number>`count(*)`,
				volume: sql<number>`coalesce(sum(${t.bookings.price}), 0)`,
				fees: sql<number>`coalesce(sum(${t.bookings.platformFee}), 0)`
			})
			.from(t.bookings)
			.where(isNull(t.bookings.deletedAt)),
		db
			.select({ count: sql<number>`count(*)` })
			.from(t.organizations)
			.where(live(t.organizations))
	]);

	const reach = await db
		.select({ total: sql<number>`coalesce(sum(${t.creators.totalReach}), 0)` })
		.from(t.creators)
		.where(and(live(t.creators), eq(t.creators.isPublished, true)));

	return {
		creators: Number(creatorCount[0]?.count ?? 0),
		campaigns: Number(campaignCount[0]?.count ?? 0),
		organizations: Number(orgCount[0]?.count ?? 0),
		bookings: Number(bookingAgg[0]?.count ?? 0),
		volume: Number(bookingAgg[0]?.volume ?? 0),
		fees: Number(bookingAgg[0]?.fees ?? 0),
		totalReach: Number(reach[0]?.total ?? 0)
	};
}

/** Booking value grouped by calendar month, for the brand spend chart. */
export async function getMonthlySpend(organizationId?: number) {
	const conditions = [isNull(t.bookings.deletedAt)];
	if (organizationId) conditions.push(eq(t.bookings.organizationId, organizationId));

	const rows = await db
		.select({
			month: sql<string>`date_format(${t.bookings.createdAt}, '%Y-%m')`,
			total: sql<number>`coalesce(sum(${t.bookings.price}), 0)`,
			count: sql<number>`count(*)`,
			reach: sql<number>`coalesce(sum(${t.creators.totalReach}), 0)`
		})
		.from(t.bookings)
		.innerJoin(t.creators, eq(t.creators.id, t.bookings.creatorId))
		.where(and(...conditions))
		.groupBy(sql`date_format(${t.bookings.createdAt}, '%Y-%m')`)
		.orderBy(sql`date_format(${t.bookings.createdAt}, '%Y-%m')`);

	return rows.map((row) => ({
		month: row.month,
		total: Number(row.total),
		count: Number(row.count),
		reach: Number(row.reach)
	}));
}

export const countPendingVerifications = async () => {
	const rows = await db
		.select({ count: sql<number>`count(*)` })
		.from(t.verificationRequests)
		.where(eq(t.verificationRequests.status, 'pending'));
	return Number(rows[0]?.count ?? 0);
};

export const listVerificationRequests = () =>
	db
		.select({
			id: t.verificationRequests.id,
			subjectType: t.verificationRequests.subjectType,
			requestedLevel: t.verificationRequests.requestedLevel,
			documentUrl: t.verificationRequests.documentUrl,
			socialProofs: t.verificationRequests.socialProofs,
			status: t.verificationRequests.status,
			adminNotes: t.verificationRequests.adminNotes,
			createdAt: t.verificationRequests.createdAt,
			creatorId: t.verificationRequests.creatorId,
			creatorName: t.creators.fullName,
			creatorUsername: t.creators.username,
			creatorAvatar: t.creators.avatar,
			organizationId: t.verificationRequests.organizationId,
			organizationName: t.organizations.name
		})
		.from(t.verificationRequests)
		.leftJoin(t.creators, eq(t.creators.id, t.verificationRequests.creatorId))
		.leftJoin(t.organizations, eq(t.organizations.id, t.verificationRequests.organizationId))
		.orderBy(desc(t.verificationRequests.createdAt));
