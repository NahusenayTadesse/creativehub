/* eslint-disable @typescript-eslint/no-explicit-any --
   Same seam as `query.ts`: the `joins` callbacks take Drizzle's `$dynamic()`
   builder, whose type widens with each join and so cannot be named. The row
   types these definitions produce are `RowOf<typeof …>` and fully checked. */

import { and, asc, desc, eq, gt, inArray, isNull, like, or, sql, type SQL } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { liveSocialFilter, ratingReviewFilter } from '$lib/server/db/rollups';
import { defineQuery, escapeLike, type PageResult, type RowOf } from '$lib/server/query';
import { handleFromEmail, looksLikeSamePerson } from '$lib/domain/claim';
import { getRequestEvent } from '$app/server';

/**
 * A URL carrying no list state, for a strip that shows a fixed set rather than
 * a browsed one — the homepage bands, the six newest rows on an overview.
 *
 * Passing the request's own URL there would let `?page=3` or a stray filter,
 * meant for the list further down the page, quietly reshape the strip too.
 */
export const unfiltered = () => new URL('http://list.local/');

/** Rows that exist and have not been soft-deleted. */
const live = <T extends { isActive: any; deletedAt: any }>(table: T) =>
	and(eq(table.isActive, true), isNull(table.deletedAt));

/**
 * Every listing below is a `defineQuery` definition plus a thin function that
 * supplies the conditions the *session* decides — whose rows these are, and
 * what is published. The query string only ever reaches the definition's
 * declared filters, which is what keeps a crafted URL from widening a scope.
 *
 * @see $lib/server/query.ts
 */

/* ------------------------------------------------------------------ *
 * Reference data — small, and loaded once per request by the root layout
 * load. Nothing memoises it, so a route that needs it takes it from
 * `await parent()` rather than calling `getReferenceData` a second time.
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

/** The homepage gallery, in the order an admin arranged it. */
export const listGallerySlides = () =>
	db
		.select()
		.from(t.gallerySlides)
		.where(live(t.gallerySlides))
		.orderBy(asc(t.gallerySlides.sortOrder));

async function loadReferenceData() {
	const [countries, regions, categories, platforms, languages] = await Promise.all([
		listCountries(),
		listRegions(),
		listCategories(),
		listPlatforms(),
		listLanguages()
	]);
	return { countries, regions, categories, platforms, languages };
}

export type ReferenceData = Awaited<ReturnType<typeof loadReferenceData>>;

/**
 * Everything the filter panels need, in one round trip — and at most one round
 * trip per request.
 *
 * The root layout loads this for every page, and eight routes ask for it again
 * for their own forms. That used to be five extra queries each time. The
 * *promise* is memoised rather than its result, so two loads running in
 * parallel share one flight instead of racing to start a second.
 */
export function getReferenceData(): Promise<ReferenceData> {
	let event: ReturnType<typeof getRequestEvent> | undefined;
	try {
		event = getRequestEvent();
	} catch {
		/* Outside a request — the seed script, a test. Nothing to memoise on. */
		return loadReferenceData();
	}
	return (event.locals.referenceData ??= loadReferenceData());
}

/* ------------------------------------------------------------------ *
 * Creators
 * ------------------------------------------------------------------ */

const creatorCardColumns = {
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
	/* Whether anyone is on the other side of a booking. Read by the
	   representation badge on every card, quick view and profile. */
	isClaimed: t.creators.isClaimed,
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
};

const creatorJoins = (qb: any) =>
	qb
		.leftJoin(t.countries, eq(t.countries.id, t.creators.countryId))
		.leftJoin(t.regions, eq(t.regions.id, t.creators.regionId))
		.leftJoin(t.platforms, eq(t.platforms.id, t.creators.primaryPlatformId));

/**
 * The categories, channels and average engagement behind a card.
 *
 * Two queries for a whole page rather than two per creator, and — because it
 * runs after the page has been cut — over twenty-four rows rather than the
 * table.
 */
async function hydrateCreatorCards(rows: any[]) {
	if (!rows.length) return [];
	const ids = rows.map((row) => row.id as number);

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

	return rows.map((row) => {
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
}

/** Creators whose profile carries the given category, matched by its slug. */
const creatorsInCategory = (slug: string) =>
	inArray(
		t.creators.id,
		db
			.select({ id: t.creatorCategories.creatorId })
			.from(t.creatorCategories)
			.innerJoin(t.categories, eq(t.categories.id, t.creatorCategories.categoryId))
			.where(eq(t.categories.slug, slug))
	);

export const creatorsQuery = defineQuery({
	table: t.creators,
	columns: creatorCardColumns,
	joins: creatorJoins,
	search: [t.creators.fullName, t.creators.username, t.creators.bio, t.creators.city],
	filters: {
		country: { type: 'numbers', column: t.creators.countryId },
		region: { type: 'number', column: t.creators.regionId },
		platform: { type: 'number', column: t.creators.primaryPlatformId },
		verification: {
			type: 'enum',
			column: t.creators.verificationLevel,
			values: t.verificationLevelEnum
		},
		availability: { type: 'enum', column: t.creators.availability, values: t.availabilityEnum },
		maxPrice: { type: 'max', column: t.creators.startingPrice },
		minReach: { type: 'min', column: t.creators.totalReach },
		category: {
			type: 'custom',
			build: (values) => creatorsInCategory(values[0])
		}
	},
	sort: {
		score: { column: t.creators.score, direction: 'desc' },
		/* Fit is ranked in the server, not ordered in SQL. The column here is the
		   pool that ranking draws from, and the order it falls back to when no
		   campaign has been chosen to match against. */
		match: { column: t.creators.score, direction: 'desc' },
		reach: { column: t.creators.totalReach, direction: 'desc' },
		price: { column: t.creators.startingPrice, direction: 'asc' },
		rating: { column: t.creators.averageRating, direction: 'desc' },
		newest: { column: t.creators.createdAt, direction: 'desc' }
	},
	defaultSort: 'score',
	tiebreaker: t.creators.id,
	hydrate: hydrateCreatorCards
});

export type CreatorCard = Awaited<ReturnType<typeof hydrateCreatorCards>>[number];

/** Only what discovery is allowed to show, whoever is asking. */
const publishedCreators = () => [live(t.creators), eq(t.creators.isPublished, true)];

/**
 * One page of published creators.
 *
 * `rank` orders by a campaign fit score, which is computed in the domain and
 * cannot be expressed in SQL — see `RunOptions.rank` for what that costs.
 */
export function listCreators(
	url: URL,
	options: {
		where?: (SQL | undefined)[];
		perPage?: number;
		rank?: (row: CreatorCard) => number;
	} = {}
): Promise<PageResult<CreatorCard>> {
	return creatorsQuery.run(url, {
		where: [...publishedCreators(), ...(options.where ?? [])],
		perPage: options.perPage,
		...(options.rank ? { rank: { by: options.rank } } : {})
	});
}

/** How many published creators sit in each market, for the discovery chips. */
export const creatorFacet = (url: URL, key: string) =>
	creatorsQuery.facet(url, key, { where: publishedCreators() });

/** The homepage strip. A fixed handful, not a browsable list. */
export async function listFeaturedCreators(limit = 6): Promise<CreatorCard[]> {
	const page = await creatorsQuery.run(unfiltered(), {
		where: [...publishedCreators(), eq(t.creators.isFeatured, true)],
		perPage: limit
	});
	return page.rows;
}

/**
 * The trending strip, in the order the published board earned.
 *
 * The flag is what the run wrote, so the set always matches; the ranks are read
 * separately only to put them back in the operator's order. Falls back to score
 * order when no board has been published yet.
 */
export async function listTrendingCreators(limit = 8): Promise<CreatorCard[]> {
	const board = await db
		.select({ creatorId: t.trendingEntries.creatorId, rank: t.trendingEntries.rank })
		.from(t.trendingEntries)
		.orderBy(asc(t.trendingEntries.rank));

	const rankOf = new Map(board.map((entry) => [entry.creatorId, entry.rank]));

	const page = await creatorsQuery.run(unfiltered(), {
		where: [...publishedCreators(), eq(t.creators.isTrending, true)],
		perPage: limit,
		/* Negated because ranking sorts high-to-low and rank 1 comes first. */
		...(board.length ? { rank: { by: (row: any) => -(rankOf.get(row.id) ?? Infinity) } } : {})
	});

	return page.rows;
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

const campaignColumns = {
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
	/* Both are on the edit form, so both have to survive a round trip: reading
	   them back as `undefined` made every save reset them to the column
	   default. */
	isActive: t.campaigns.isActive,
	sortOrder: t.campaigns.sortOrder,
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
};

const campaignJoins = (qb: any) =>
	qb
		.leftJoin(t.categories, eq(t.categories.id, t.campaigns.categoryId))
		.leftJoin(t.countries, eq(t.countries.id, t.campaigns.countryId))
		.innerJoin(t.organizations, eq(t.organizations.id, t.campaigns.organizationId));

/**
 * A brief is in scope for a market if it names that country, names no country
 * at all — those are open to everyone — or lists the country among the regions
 * it targets. The name behind the id is looked up in the statement rather than
 * fetched first, so this stays one query.
 */
const campaignInMarket = (countryId: number) => sql`(
	${t.campaigns.countryId} = ${countryId}
	or ${t.campaigns.countryId} is null
	or json_contains(
		${t.campaigns.targetRegions},
		json_quote((select ${t.countries.name} from ${t.countries} where ${t.countries.id} = ${countryId}))
	)
)`;

export const campaignsQuery = defineQuery({
	table: t.campaigns,
	columns: campaignColumns,
	joins: campaignJoins,
	search: [
		t.campaigns.title,
		t.campaigns.description,
		t.organizations.name,
		t.categories.name,
		t.countries.name
	],
	filters: {
		type: {
			type: 'enum',
			column: t.campaigns.compensationType,
			values: t.compensationTypeEnum
		},
		status: { type: 'enum', column: t.campaigns.status, values: t.campaignStatusEnum },
		category: { type: 'number', column: t.campaigns.categoryId },
		market: {
			type: 'custom',
			build: (values) => {
				const id = Number(values[0]);
				return Number.isInteger(id) ? campaignInMarket(id) : undefined;
			}
		}
	},
	sort: {
		newest: { column: t.campaigns.createdAt, direction: 'desc' },
		deadline: { column: t.campaigns.deadline, direction: 'asc' },
		budget: { column: t.campaigns.budgetMax, direction: 'desc' },
		applications: { column: t.campaigns.applicationsCount, direction: 'desc' },
		title: { column: t.campaigns.title, direction: 'asc' }
	},
	defaultSort: 'newest',
	tiebreaker: t.campaigns.id
});

export type CampaignCard = RowOf<typeof campaignColumns>;

/** Conditions a campaign listing always carries, whoever is reading. */
export const campaignScope = (options: { organizationId?: number; publicOnly?: boolean } = {}) => [
	isNull(t.campaigns.deletedAt),
	options.publicOnly ? eq(t.campaigns.status, 'published') : undefined,
	options.organizationId ? eq(t.campaigns.organizationId, options.organizationId) : undefined
];

export const listCampaigns = (
	url: URL,
	options: { organizationId?: number; publicOnly?: boolean; perPage?: number } = {}
) => campaignsQuery.run(url, { where: campaignScope(options), perPage: options.perPage });

export const campaignFacet = (
	url: URL,
	key: string,
	options: { organizationId?: number; publicOnly?: boolean } = {}
) => campaignsQuery.facet(url, key, { where: campaignScope(options) });

/**
 * How many briefs there are once the market filter is set aside.
 *
 * The "all markets" chip cannot take this from `campaignFacet(url, 'type')`:
 * that sum keeps the market condition, so the chip meaning *no market* would
 * count only the market already chosen.
 */
export const countCampaignsAcrossMarkets = (
	url: URL,
	options: { organizationId?: number; publicOnly?: boolean } = {}
) => campaignsQuery.countWithout(url, ['market'], { where: campaignScope(options) });

/** One campaign by its slug — matched in SQL, not by scanning every campaign. */
export async function getCampaignBySlug(slug: string) {
	const rows = await campaignJoins(db.select(campaignColumns).from(t.campaigns).$dynamic())
		.where(and(isNull(t.campaigns.deletedAt), eq(t.campaigns.slug, slug)))
		.limit(1);
	return (rows.at(0) as any) ?? null;
}

/* ------------------------------------------------------------------ *
 * Bookings
 * ------------------------------------------------------------------ */

const bookingColumns = {
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
	introductionStatus: t.bookings.introductionStatus,
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
};

const bookingJoins = (qb: any) =>
	qb
		.innerJoin(t.creators, eq(t.creators.id, t.bookings.creatorId))
		.innerJoin(t.organizations, eq(t.organizations.id, t.bookings.organizationId));

/**
 * The tabs above the deals list. Each names the states it covers; `all` names
 * none, which the builder reads as "no condition" while still counting.
 */
export const BOOKING_TABS = {
	all: [],
	negotiating: ['proposed', 'negotiating'],
	active: ['booked', 'in_production', 'submitted', 'revision', 'approved', 'awaiting_settlement'],
	completed: ['completed'],
	closed: ['cancelled', 'disputed']
} as const;

export const bookingsQuery = defineQuery({
	table: t.bookings,
	columns: bookingColumns,
	joins: bookingJoins,
	search: [t.bookings.title, t.bookings.reference, t.creators.fullName, t.organizations.name],
	filters: {
		tab: { type: 'group', column: t.bookings.status, groups: BOOKING_TABS },
		status: { type: 'enum', column: t.bookings.status, values: t.bookingStatusEnum },
		escrow: { type: 'enum', column: t.bookings.escrowStatus, values: t.escrowStatusEnum },
		compensation: {
			type: 'enum',
			column: t.bookings.compensationType,
			values: t.compensationTypeEnum
		}
	},
	sort: {
		newest: { column: t.bookings.createdAt, direction: 'desc' },
		deadline: { column: t.bookings.deadline, direction: 'asc' },
		value: { column: t.bookings.price, direction: 'desc' },
		reference: { column: t.bookings.reference, direction: 'asc' }
	},
	defaultSort: 'newest',
	tiebreaker: t.bookings.id
});

/**
 * The introduction queue.
 *
 * The same rows as `bookingsQuery`, cut to the deals that opened against a
 * profile nobody had claimed, and carrying what an operator needs to chase the
 * creator: the handle and the imported channel, not the deal's money.
 */
const introductionColumns = {
	...bookingColumns,
	introductionNote: t.bookings.introductionNote,
	introducedAt: t.bookings.introducedAt,
	creatorCity: t.creators.city,
	creatorIsClaimed: t.creators.isClaimed,
	countryName: t.countries.name,
	countryFlag: t.countries.flag,
	platformName: t.platforms.name
};

export const introductionsQuery = defineQuery({
	table: t.bookings,
	columns: introductionColumns,
	joins: (qb: any) =>
		qb
			.innerJoin(t.creators, eq(t.creators.id, t.bookings.creatorId))
			.innerJoin(t.organizations, eq(t.organizations.id, t.bookings.organizationId))
			.leftJoin(t.countries, eq(t.countries.id, t.creators.countryId))
			.leftJoin(t.platforms, eq(t.platforms.id, t.creators.primaryPlatformId)),
	search: [t.bookings.reference, t.creators.fullName, t.creators.username, t.organizations.name],
	filters: {
		introduction: {
			type: 'enum',
			column: t.bookings.introductionStatus,
			values: t.introductionStatusEnum
		}
	},
	sort: {
		newest: { column: t.bookings.createdAt, direction: 'desc' },
		oldest: { column: t.bookings.createdAt, direction: 'asc' },
		value: { column: t.bookings.price, direction: 'desc' }
	},
	/* A queue is worked oldest first — the deal that has waited longest is the
	   one a creator has been unaware of for longest. */
	defaultSort: 'oldest',
	tiebreaker: t.bookings.id
});

export type IntroductionRow = RowOf<typeof introductionColumns>;

export type BookingRow = RowOf<typeof bookingColumns>;

/**
 * Whose deals these are.
 *
 * A user who is neither a creator nor an organisation — mid-onboarding — must
 * see none rather than fall through to an undefined condition that `and()`
 * would drop.
 */
export const bookingScope = (filter: {
	role?: string;
	creatorId?: number;
	organizationId?: number;
}) => [
	isNull(t.bookings.deletedAt),
	filter.role === 'admin'
		? undefined
		: filter.creatorId
			? eq(t.bookings.creatorId, filter.creatorId)
			: filter.organizationId
				? eq(t.bookings.organizationId, filter.organizationId)
				: sql`1 = 0`
];

export const listBookings = (
	url: URL,
	filter: { role?: string; creatorId?: number; organizationId?: number },
	options: { perPage?: number } = {}
) => bookingsQuery.run(url, { where: bookingScope(filter), perPage: options.perPage });

export const bookingFacet = (
	url: URL,
	key: string,
	filter: { role?: string; creatorId?: number; organizationId?: number }
) => bookingsQuery.facet(url, key, { where: bookingScope(filter) });

/** One booking with the joined labels, by id. */
async function getBookingRow(bookingId: number) {
	const rows = await bookingJoins(db.select(bookingColumns).from(t.bookings).$dynamic())
		.where(and(isNull(t.bookings.deletedAt), eq(t.bookings.id, bookingId)))
		.limit(1);
	return (rows.at(0) as any) ?? null;
}

export async function getBookingDetail(bookingId: number) {
	const booking = await getBookingRow(bookingId);
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

const applicationColumns = {
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
};

const applicationJoins = (qb: any) =>
	qb
		.innerJoin(t.campaigns, eq(t.campaigns.id, t.applications.campaignId))
		.innerJoin(t.organizations, eq(t.organizations.id, t.campaigns.organizationId))
		.innerJoin(t.creators, eq(t.creators.id, t.applications.creatorId));

export const applicationsQuery = defineQuery({
	table: t.applications,
	columns: applicationColumns,
	joins: applicationJoins,
	search: [t.campaigns.title, t.creators.fullName, t.organizations.name, t.applications.pitch],
	filters: {
		status: { type: 'enum', column: t.applications.status, values: t.applicationStatusEnum },
		campaign: { type: 'number', column: t.applications.campaignId }
	},
	sort: {
		newest: { column: t.applications.createdAt, direction: 'desc' },
		price: { column: t.applications.proposedPrice, direction: 'desc' },
		score: { column: t.creators.score, direction: 'desc' },
		reach: { column: t.creators.totalReach, direction: 'desc' }
	},
	defaultSort: 'newest',
	tiebreaker: t.applications.id
});

export type ApplicationRow = RowOf<typeof applicationColumns>;

export const applicationScope = (filter: {
	role?: string;
	creatorId?: number;
	organizationId?: number;
	campaignId?: number;
}) => [
	isNull(t.applications.deletedAt),
	filter.campaignId ? eq(t.applications.campaignId, filter.campaignId) : undefined,
	filter.role === 'admin'
		? undefined
		: filter.creatorId
			? eq(t.applications.creatorId, filter.creatorId)
			: filter.organizationId
				? eq(t.campaigns.organizationId, filter.organizationId)
				: sql`1 = 0`
];

export const listApplications = (
	url: URL,
	filter: { role?: string; creatorId?: number; organizationId?: number; campaignId?: number },
	options: { perPage?: number } = {}
) => applicationsQuery.run(url, { where: applicationScope(filter), perPage: options.perPage });

export const applicationFacet = (
	url: URL,
	key: string,
	filter: { role?: string; creatorId?: number; organizationId?: number; campaignId?: number }
) => applicationsQuery.facet(url, key, { where: applicationScope(filter) });

/* ------------------------------------------------------------------ *
 * Reviews, shortlist, verification, users, audit
 * ------------------------------------------------------------------ */

export const reviewsQuery = defineQuery({
	table: t.reviews,
	columns: {
		id: t.reviews.id,
		rating: t.reviews.rating,
		communication: t.reviews.communication,
		professionalism: t.reviews.professionalism,
		timeliness: t.reviews.timeliness,
		quality: t.reviews.quality,
		body: t.reviews.body,
		direction: t.reviews.direction,
		createdAt: t.reviews.createdAt,
		bookingId: t.reviews.bookingId,
		bookingTitle: t.bookings.title,
		creatorName: t.creators.fullName,
		organizationName: t.organizations.name
	},
	joins: (qb: any) =>
		qb
			.innerJoin(t.bookings, eq(t.bookings.id, t.reviews.bookingId))
			.innerJoin(t.creators, eq(t.creators.id, t.reviews.creatorId))
			.innerJoin(t.organizations, eq(t.organizations.id, t.reviews.organizationId)),
	search: [t.reviews.body, t.bookings.title, t.creators.fullName, t.organizations.name],
	filters: {
		direction: { type: 'enum', column: t.reviews.direction, values: t.reviewDirectionEnum },
		rating: { type: 'min', column: t.reviews.rating }
	},
	sort: {
		newest: { column: t.reviews.createdAt, direction: 'desc' },
		rating: { column: t.reviews.rating, direction: 'desc' }
	},
	defaultSort: 'newest',
	tiebreaker: t.reviews.id
});

export const savedCreatorsQuery = defineQuery({
	table: t.savedCreators,
	columns: {
		id: t.savedCreators.id,
		note: t.savedCreators.note,
		createdAt: t.savedCreators.createdAt,
		creatorId: t.creators.id,
		username: t.creators.username,
		fullName: t.creators.fullName,
		avatar: t.creators.avatar,
		bio: t.creators.bio,
		city: t.creators.city,
		score: t.creators.score,
		totalReach: t.creators.totalReach,
		startingPrice: t.creators.startingPrice,
		currencyCode: t.creators.currencyCode,
		averageRating: t.creators.averageRating,
		verificationLevel: t.creators.verificationLevel,
		isClaimed: t.creators.isClaimed,
		countryFlag: t.countries.flag,
		countryName: t.countries.name,
		platformName: t.platforms.name
	},
	joins: (qb: any) =>
		qb
			.innerJoin(t.creators, eq(t.creators.id, t.savedCreators.creatorId))
			.leftJoin(t.countries, eq(t.countries.id, t.creators.countryId))
			.leftJoin(t.platforms, eq(t.platforms.id, t.creators.primaryPlatformId)),
	search: [t.creators.fullName, t.creators.username, t.creators.city, t.savedCreators.note],
	filters: {
		verification: {
			type: 'enum',
			column: t.creators.verificationLevel,
			values: t.verificationLevelEnum
		}
	},
	sort: {
		newest: { column: t.savedCreators.createdAt, direction: 'desc' },
		score: { column: t.creators.score, direction: 'desc' },
		reach: { column: t.creators.totalReach, direction: 'desc' },
		price: { column: t.creators.startingPrice, direction: 'asc' }
	},
	defaultSort: 'newest',
	tiebreaker: t.savedCreators.id
});

export const verificationQuery = defineQuery({
	table: t.verificationRequests,
	columns: {
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
	},
	joins: (qb: any) =>
		qb
			.leftJoin(t.creators, eq(t.creators.id, t.verificationRequests.creatorId))
			.leftJoin(t.organizations, eq(t.organizations.id, t.verificationRequests.organizationId)),
	search: [t.creators.fullName, t.creators.username, t.organizations.name],
	filters: {
		status: {
			type: 'enum',
			column: t.verificationRequests.status,
			values: t.verificationStatusEnum
		},
		subject: {
			type: 'enum',
			column: t.verificationRequests.subjectType,
			values: t.verificationSubjectEnum
		}
	},
	sort: {
		newest: { column: t.verificationRequests.createdAt, direction: 'desc' },
		oldest: { column: t.verificationRequests.createdAt, direction: 'asc' }
	},
	defaultSort: 'newest',
	tiebreaker: t.verificationRequests.id
});

export const listVerificationRequests = (url: URL) => verificationQuery.run(url);

/**
 * The queue at /dashboard/admin/claims: people asking for a profile that was
 * imported before they arrived.
 *
 * The joins carry what an operator needs to judge one without leaving the page
 * — who is asking, which profile, and whether that profile has since been
 * claimed by somebody else.
 */
const claimColumns = {
	id: t.creatorClaims.id,
	status: t.creatorClaims.status,
	evidence: t.creatorClaims.evidence,
	proofUrl: t.creatorClaims.proofUrl,
	adminNotes: t.creatorClaims.adminNotes,
	createdAt: t.creatorClaims.createdAt,
	reviewedAt: t.creatorClaims.reviewedAt,
	creatorId: t.creatorClaims.creatorId,
	creatorName: t.creators.fullName,
	creatorUsername: t.creators.username,
	creatorAvatar: t.creators.avatar,
	creatorIsClaimed: t.creators.isClaimed,
	creatorReach: t.creators.totalReach,
	claimantId: t.creatorClaims.claimantId,
	claimantName: t.user.name,
	claimantEmail: t.user.email,
	countryName: t.countries.name,
	countryFlag: t.countries.flag,
	platformName: t.platforms.name
};

export const claimsQuery = defineQuery({
	table: t.creatorClaims,
	columns: claimColumns,
	joins: (qb: any) =>
		qb
			.innerJoin(t.creators, eq(t.creators.id, t.creatorClaims.creatorId))
			.innerJoin(t.user, eq(t.user.id, t.creatorClaims.claimantId))
			.leftJoin(t.countries, eq(t.countries.id, t.creators.countryId))
			.leftJoin(t.platforms, eq(t.platforms.id, t.creators.primaryPlatformId)),
	search: [t.creators.fullName, t.creators.username, t.user.name, t.user.email],
	filters: {
		status: { type: 'enum', column: t.creatorClaims.status, values: t.claimStatusEnum }
	},
	sort: {
		oldest: { column: t.creatorClaims.createdAt, direction: 'asc' },
		newest: { column: t.creatorClaims.createdAt, direction: 'desc' }
	},
	/* A queue is worked front to back: the person who has waited longest is the
	   one the page opens on. */
	defaultSort: 'oldest',
	tiebreaker: t.creatorClaims.id
});

export type ClaimRow = RowOf<typeof claimColumns>;

/** Profiles nobody is behind, and that a claim could therefore be about. */
const claimable = () =>
	and(
		isNull(t.creators.userId),
		eq(t.creators.isClaimed, false),
		eq(t.creators.isPublished, true),
		eq(t.creators.isActive, true),
		isNull(t.creators.deletedAt)
	);

/**
 * Unclaimed profiles that plausibly describe this account.
 *
 * Two steps on purpose. SQL casts a wide net — a substring of the first name or
 * of the email handle — and `looksLikeSamePerson` makes the actual decision, so
 * the rule that governs what a stranger is shown lives in one place and is unit
 * tested. Doing the narrowing in SQL as well would mean maintaining the same
 * rule in two languages, which is how the two versions drift apart.
 */
export async function findClaimCandidates(account: { name: string; email: string }) {
	const handle = handleFromEmail(account.email);
	const firstName = account.name.trim().split(/\s+/)[0] ?? '';

	const nets: SQL[] = [];
	/* Single characters would match most of the table and prove nothing. */
	if (firstName.length >= 2) nets.push(like(t.creators.fullName, `%${escapeLike(firstName)}%`));
	if (handle.length >= 2) nets.push(like(t.creators.username, `%${escapeLike(handle)}%`));
	if (!nets.length) return [];

	const rows = await db
		.select({
			id: t.creators.id,
			username: t.creators.username,
			fullName: t.creators.fullName,
			avatar: t.creators.avatar,
			city: t.creators.city,
			totalReach: t.creators.totalReach,
			countryName: t.countries.name,
			countryFlag: t.countries.flag,
			platformName: t.platforms.name
		})
		.from(t.creators)
		.leftJoin(t.countries, eq(t.countries.id, t.creators.countryId))
		.leftJoin(t.platforms, eq(t.platforms.id, t.creators.primaryPlatformId))
		.where(and(claimable(), or(...nets)))
		/* A bound on the net, not on the answer: the filter below is what decides,
		   and a name common enough to overflow this will not match it exactly. */
		.limit(50);

	return rows.filter((row) => looksLikeSamePerson(account, row));
}

export type ClaimCandidate = Awaited<ReturnType<typeof findClaimCandidates>>[number];

/**
 * One claimable profile by handle, for the "is this you?" link on a public
 * page.
 *
 * Deliberately not filtered through `looksLikeSamePerson`: the guess is only
 * there to *offer* profiles to someone who has not found theirs. A creator who
 * has walked to their own page knows better than the matcher does, and the
 * decision is an operator's either way.
 */
export async function getClaimableByUsername(username: string) {
	const rows = await db
		.select({
			id: t.creators.id,
			username: t.creators.username,
			fullName: t.creators.fullName,
			avatar: t.creators.avatar,
			city: t.creators.city,
			totalReach: t.creators.totalReach,
			countryName: t.countries.name,
			countryFlag: t.countries.flag,
			platformName: t.platforms.name
		})
		.from(t.creators)
		.leftJoin(t.countries, eq(t.countries.id, t.creators.countryId))
		.leftJoin(t.platforms, eq(t.platforms.id, t.creators.primaryPlatformId))
		.where(and(claimable(), eq(t.creators.username, username)))
		.limit(1);
	return rows.at(0);
}

/**
 * This account's claim that is still waiting, if it has one.
 *
 * One open claim at a time is the rule the claim page enforces. It keeps an
 * operator's queue about people rather than about one person's shortlist, and
 * it means "withdraw" always has an unambiguous subject.
 */
export async function getOpenClaimFor(userId: string) {
	const rows = await db
		.select({
			id: t.creatorClaims.id,
			creatorId: t.creatorClaims.creatorId,
			status: t.creatorClaims.status,
			createdAt: t.creatorClaims.createdAt,
			creatorName: t.creators.fullName,
			creatorUsername: t.creators.username,
			creatorAvatar: t.creators.avatar
		})
		.from(t.creatorClaims)
		.innerJoin(t.creators, eq(t.creators.id, t.creatorClaims.creatorId))
		.where(and(eq(t.creatorClaims.claimantId, userId), eq(t.creatorClaims.status, 'pending')))
		.orderBy(asc(t.creatorClaims.id))
		.limit(1);
	return rows.at(0);
}

/**
 * The most recent decision on this account's claims, when none is open — so the
 * page can say what happened rather than silently offering the form again.
 */
export async function getLastClaimDecisionFor(userId: string) {
	const rows = await db
		.select({
			id: t.creatorClaims.id,
			status: t.creatorClaims.status,
			adminNotes: t.creatorClaims.adminNotes,
			reviewedAt: t.creatorClaims.reviewedAt,
			creatorName: t.creators.fullName,
			creatorUsername: t.creators.username
		})
		.from(t.creatorClaims)
		.innerJoin(t.creators, eq(t.creators.id, t.creatorClaims.creatorId))
		.where(and(eq(t.creatorClaims.claimantId, userId), eq(t.creatorClaims.status, 'rejected')))
		.orderBy(desc(t.creatorClaims.id))
		.limit(1);
	return rows.at(0);
}

/* ------------------------------------------------------------------ *
 * Account settings
 * ------------------------------------------------------------------ */

/**
 * This account's preferences, or nothing.
 *
 * Nothing is a real answer, not a missing row to repair: `DEFAULT_PREFERENCES`
 * is what absence means, so sign-up writes no settings row and an account that
 * never opened the page behaves exactly like one that opened it and changed
 * nothing.
 */
export async function getUserSettings(userId: string) {
	const rows = await db
		.select()
		.from(t.userSettings)
		.where(eq(t.userSettings.userId, userId))
		.limit(1);
	return rows.at(0);
}

/**
 * Where this account is currently signed in.
 *
 * Expired rows are excluded rather than shown greyed out — a session that can
 * no longer be used is not something anyone needs to act on, and listing it
 * only makes the real ones harder to find.
 */
export async function listSessionsFor(userId: string) {
	return (
		db
			.select({
				id: t.session.id,
				createdAt: t.session.createdAt,
				updatedAt: t.session.updatedAt,
				expiresAt: t.session.expiresAt,
				ipAddress: t.session.ipAddress,
				userAgent: t.session.userAgent
			})
			.from(t.session)
			.where(and(eq(t.session.userId, userId), gt(t.session.expiresAt, new Date())))
			/* Most recently used first: the one they are looking for is the one they
		   do not recognise, and that is usually the freshest. */
			.orderBy(desc(t.session.updatedAt))
	);
}

/**
 * Whether this account has a password at all.
 *
 * An account created through Google has no credential row, so offering it a
 * "change your password" form would be offering to change nothing. The settings
 * page says so instead.
 */
export async function hasPasswordLogin(userId: string) {
	const rows = await db
		.select({ id: t.account.id })
		.from(t.account)
		.where(and(eq(t.account.userId, userId), eq(t.account.providerId, 'credential')))
		.limit(1);
	return rows.length > 0;
}

/** Operator accounts, so a closure request reaches somebody. */
export async function listAdminIds() {
	const rows = await db.select({ id: t.user.id }).from(t.user).where(eq(t.user.role, 'admin'));
	return rows.map((row) => row.id);
}

export const countPendingClaims = async () => {
	const rows = await db
		.select({ count: sql<number>`count(*)` })
		.from(t.creatorClaims)
		.where(eq(t.creatorClaims.status, 'pending'));
	return Number(rows[0]?.count ?? 0);
};

export const usersQuery = defineQuery({
	table: t.user,
	columns: {
		id: t.user.id,
		name: t.user.name,
		email: t.user.email,
		role: t.user.role,
		emailVerified: t.user.emailVerified,
		createdAt: t.user.createdAt,
		/* Aggregated because the joins below can match more than once. Without
		   this, an account owning two organisations is one row in the total and
		   two rows in the table — "Showing 1 – 4 of 3", with a duplicate. */
		creatorUsername: sql<string | null>`min(${t.creators.username})`,
		organizationName: sql<string | null>`min(${t.organizations.name})`
	},
	joins: (qb: any) =>
		qb
			.leftJoin(t.creators, eq(t.creators.userId, t.user.id))
			.leftJoin(t.organizations, eq(t.organizations.ownerId, t.user.id)),
	/* An account can own more than one organisation, so the join can match a
	   user twice; the total must still count accounts, and the page must still
	   show one row per account. */
	countColumn: t.user.id,
	groupBy: t.user.id,
	search: [t.user.name, t.user.email, t.creators.username, t.organizations.name],
	filters: {
		role: {
			type: 'enum',
			column: t.user.role,
			values: ['creator', 'business', 'admin'],
			/* `role` is nullable with a default of 'creator'. A row written
			   outside sign-up has NULL, which means 'creator' everywhere else in
			   the app — so it has to mean that here too, or the account is
			   reachable only from "All". */
			nullAs: 'creator'
		}
	},
	sort: {
		newest: { column: t.user.createdAt, direction: 'desc' },
		name: { column: t.user.name, direction: 'asc' },
		email: { column: t.user.email, direction: 'asc' }
	},
	defaultSort: 'newest',
	tiebreaker: t.user.id
});

export const auditQuery = defineQuery({
	table: t.auditLog,
	columns: {
		id: t.auditLog.id,
		actorId: t.auditLog.actorId,
		actorLabel: t.auditLog.actorLabel,
		entity: t.auditLog.entity,
		entityId: t.auditLog.entityId,
		action: t.auditLog.action,
		fromState: t.auditLog.fromState,
		toState: t.auditLog.toState,
		reason: t.auditLog.reason,
		createdAt: t.auditLog.createdAt
	},
	search: [
		t.auditLog.actorLabel,
		t.auditLog.entity,
		t.auditLog.action,
		t.auditLog.reason,
		t.auditLog.toState
	],
	filters: {
		entity: { type: 'text', column: t.auditLog.entity },
		action: { type: 'text', column: t.auditLog.action }
	},
	sort: {
		newest: { column: t.auditLog.createdAt, direction: 'desc' },
		oldest: { column: t.auditLog.createdAt, direction: 'asc' }
	},
	defaultSort: 'newest',
	tiebreaker: t.auditLog.id,
	perPage: 50
});

/* ------------------------------------------------------------------ *
 * Dashboard aggregates
 *
 * Counted and summed in SQL. These used to be derived from arrays the page
 * had already loaded, which meant every dashboard read every booking on the
 * platform to print six numbers.
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

const CLOSED_BOOKINGS = ['completed', 'cancelled'] as const;
const AWAITING_PAYOUT = ['approved', 'awaiting_settlement'] as const;

/**
 * A parameterised `IN` list.
 *
 * The two lists above used to be declared here and spelled out again inside
 * each `sql` template, which is two statements of one rule that nothing checks
 * against each other. Interpolating them means there is only ever one.
 */
const statusList = (states: readonly string[]) =>
	sql.join(
		states.map((state) => sql`${state}`),
		sql`, `
	);

/** The headline figures on a brand's overview, summed in the database. */
export async function getOrganizationTotals(organizationId: number) {
	const mine = and(isNull(t.bookings.deletedAt), eq(t.bookings.organizationId, organizationId));

	const [money, active, campaigns, applications] = await Promise.all([
		db
			.select({
				committed: sql<number>`coalesce(sum(${t.bookings.price}), 0)`,
				settled: sql<number>`coalesce(sum(case when ${t.bookings.escrowStatus} = 'released' then ${t.bookings.price} else 0 end), 0)`,
				held: sql<number>`coalesce(sum(case when ${t.bookings.escrowStatus} = 'held' then ${t.bookings.price} else 0 end), 0)`
			})
			.from(t.bookings)
			.where(mine),
		db
			.select({ n: sql<number>`count(*)` })
			.from(t.bookings)
			.where(and(mine, sql`${t.bookings.status} not in (${statusList(CLOSED_BOOKINGS)})`)),
		db
			.select({ n: sql<number>`count(*)` })
			.from(t.campaigns)
			.where(
				and(
					isNull(t.campaigns.deletedAt),
					eq(t.campaigns.organizationId, organizationId),
					eq(t.campaigns.status, 'published')
				)
			),
		db
			.select({ n: sql<number>`count(*)` })
			.from(t.applications)
			.innerJoin(t.campaigns, eq(t.campaigns.id, t.applications.campaignId))
			.where(
				and(
					isNull(t.applications.deletedAt),
					eq(t.campaigns.organizationId, organizationId),
					eq(t.applications.status, 'applied')
				)
			)
	]);

	return {
		committed: Number(money[0]?.committed ?? 0),
		settled: Number(money[0]?.settled ?? 0),
		held: Number(money[0]?.held ?? 0),
		activeBookings: Number(active[0]?.n ?? 0),
		activeCampaigns: Number(campaigns[0]?.n ?? 0),
		pendingApplications: Number(applications[0]?.n ?? 0)
	};
}

/** The same for a creator: what has been earned, and what is still owed. */
export async function getCreatorTotals(creatorId: number) {
	const mine = and(isNull(t.bookings.deletedAt), eq(t.bookings.creatorId, creatorId));

	const [money, active, applications, reviews] = await Promise.all([
		db
			.select({
				earned: sql<number>`coalesce(sum(case when ${t.bookings.status} = 'completed' then ${t.bookings.creatorPayout} else 0 end), 0)`,
				pending: sql<number>`coalesce(sum(case when ${t.bookings.status} in (${statusList(AWAITING_PAYOUT)}) then ${t.bookings.creatorPayout} else 0 end), 0)`
			})
			.from(t.bookings)
			.where(mine),
		db
			.select({ n: sql<number>`count(*)` })
			.from(t.bookings)
			.where(and(mine, sql`${t.bookings.status} not in (${statusList(CLOSED_BOOKINGS)})`)),
		db
			.select({ n: sql<number>`count(*)` })
			.from(t.applications)
			.where(
				and(
					isNull(t.applications.deletedAt),
					eq(t.applications.creatorId, creatorId),
					inArray(t.applications.status, ['applied', 'shortlisted'])
				)
			),
		db
			.select({ n: sql<number>`count(*)` })
			.from(t.reviews)
			.where(and(eq(t.reviews.creatorId, creatorId), eq(t.reviews.direction, 'brand_to_creator')))
	]);

	return {
		earned: Number(money[0]?.earned ?? 0),
		pending: Number(money[0]?.pending ?? 0),
		activeBookings: Number(active[0]?.n ?? 0),
		openApplications: Number(applications[0]?.n ?? 0),
		reviews: Number(reviews[0]?.n ?? 0)
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
