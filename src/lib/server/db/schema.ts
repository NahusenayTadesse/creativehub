import { relations } from 'drizzle-orm';
import {
	mysqlTable,
	mysqlEnum,
	int,
	double,
	varchar,
	text,
	mediumtext,
	boolean,
	json,
	date,
	timestamp,
	uniqueIndex,
	index
} from 'drizzle-orm/mysql-core';
import { user } from './auth.schema';

/* ------------------------------------------------------------------ *
 * Shared column sets
 *
 * `contentCrud` in $lib/server/crud.ts stamps `createdBy` / `updatedBy` on
 * every write, so every table it manages must carry the audit columns. Content
 * rows an admin can arrange also carry `sortOrder`, which crud.ts orders by.
 * ------------------------------------------------------------------ */

/** Who touched the row and when. Required by every crud-managed table. */
const audit = () => ({
	createdBy: varchar('created_by', { length: 36 }),
	updatedBy: varchar('updated_by', { length: 36 }),
	createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { fsp: 3 })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
	/** Soft delete. Public queries filter these out; history keeps them. */
	deletedAt: timestamp('deleted_at', { fsp: 3 })
});

/** Visibility + admin-chosen display order, for anything shown on the site. */
const publishable = () => ({
	isActive: boolean('is_active').default(true).notNull(),
	sortOrder: int('sort_order').default(0).notNull()
});

const id = () => int('id').autoincrement().primaryKey();
const userRef = (column: string) => varchar(column, { length: 36 });

/* ================================================================== *
 * 1. REFERENCE DATA
 *
 * Controlled vocabularies. Admin-editable so the filter panels stay
 * consistent, seeded once, and referenced by id everywhere else — a label
 * can be renamed without rewriting history.
 * ================================================================== */

export const countries = mysqlTable(
	'countries',
	{
		id: id(),
		name: varchar('name', { length: 120 }).notNull(),
		code: varchar('code', { length: 8 }).notNull(),
		flag: varchar('flag', { length: 16 }).default('🌍').notNull(),
		currencyCode: varchar('currency_code', { length: 8 }).default('USD').notNull(),
		currencySymbol: varchar('currency_symbol', { length: 12 }).default('$').notNull(),
		/** Units of the local currency per 1 USD. One source of truth for FX. */
		usdRate: double('usd_rate').default(1).notNull(),
		paymentRails: json('payment_rails').$type<string[]>().default([]).notNull(),
		description: text('description'),
		...publishable(),
		...audit()
	},
	(t) => [uniqueIndex('countries_code_idx').on(t.code)]
);

export const regions = mysqlTable(
	'regions',
	{
		id: id(),
		countryId: int('country_id')
			.notNull()
			.references(() => countries.id, { onDelete: 'cascade' }),
		name: varchar('name', { length: 120 }).notNull(),
		majorCities: json('major_cities').$type<string[]>().default([]).notNull(),
		...publishable(),
		...audit()
	},
	(t) => [index('regions_country_idx').on(t.countryId)]
);

export const categories = mysqlTable(
	'categories',
	{
		id: id(),
		name: varchar('name', { length: 120 }).notNull(),
		slug: varchar('slug', { length: 140 }).notNull(),
		description: text('description'),
		/** Lucide icon name, resolved by $lib/components/dynamic-icon.svelte. */
		icon: varchar('icon', { length: 60 }).default('Sparkles').notNull(),
		...publishable(),
		...audit()
	},
	(t) => [uniqueIndex('categories_slug_idx').on(t.slug)]
);

export const platforms = mysqlTable(
	'platforms',
	{
		id: id(),
		name: varchar('name', { length: 60 }).notNull(),
		/** Tailwind-friendly hex used by badges and charts. */
		color: varchar('color', { length: 16 }).default('#0f172a').notNull(),
		...publishable(),
		...audit()
	},
	(t) => [uniqueIndex('platforms_name_idx').on(t.name)]
);

export const languages = mysqlTable(
	'languages',
	{
		id: id(),
		name: varchar('name', { length: 80 }).notNull(),
		code: varchar('code', { length: 8 }).notNull(),
		...publishable(),
		...audit()
	},
	(t) => [uniqueIndex('languages_code_idx').on(t.code)]
);

/* ================================================================== *
 * 2. ORGANISATIONS (brands, agencies, NGOs, event organisers)
 * ================================================================== */

export const orgTypeEnum = [
	'company',
	'startup',
	'agency',
	'ngo',
	'government',
	'event_organizer'
] as const;

export const verificationLevelEnum = [
	'unverified',
	'social_verified',
	'identity_verified',
	'cn_verified'
] as const;

export const organizations = mysqlTable(
	'organizations',
	{
		id: id(),
		ownerId: userRef('owner_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: varchar('name', { length: 180 }).notNull(),
		slug: varchar('slug', { length: 200 }).notNull(),
		orgType: mysqlEnum('org_type', orgTypeEnum).default('company').notNull(),
		logo: varchar('logo', { length: 500 }),
		website: varchar('website', { length: 300 }),
		bio: text('bio'),
		countryId: int('country_id').references(() => countries.id),
		city: varchar('city', { length: 120 }),
		verificationLevel: mysqlEnum('verification_level', verificationLevelEnum)
			.default('unverified')
			.notNull(),
		/** Guardrail from the PRD: spend ceiling an operator can set per month. */
		monthlyBudgetCap: int('monthly_budget_cap'),
		...publishable(),
		...audit()
	},
	(t) => [
		uniqueIndex('organizations_slug_idx').on(t.slug),
		index('organizations_owner_idx').on(t.ownerId)
	]
);

export const orgMemberRoleEnum = ['owner', 'admin', 'member'] as const;

export const organizationMembers = mysqlTable(
	'organization_members',
	{
		id: id(),
		organizationId: int('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		userId: userRef('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		role: mysqlEnum('role', orgMemberRoleEnum).default('member').notNull(),
		...publishable(),
		...audit()
	},
	(t) => [uniqueIndex('org_member_unique').on(t.organizationId, t.userId)]
);

/* ================================================================== *
 * 3. CREATOR SUPPLY
 * ================================================================== */

export const availabilityEnum = ['available', 'busy', 'away'] as const;

export const creators = mysqlTable(
	'creators',
	{
		id: id(),
		userId: userRef('user_id').references(() => user.id, { onDelete: 'set null' }),
		username: varchar('username', { length: 120 }).notNull(),
		fullName: varchar('full_name', { length: 180 }).notNull(),
		avatar: varchar('avatar', { length: 500 }),
		cover: varchar('cover', { length: 500 }),
		bio: text('bio'),
		countryId: int('country_id').references(() => countries.id),
		regionId: int('region_id').references(() => regions.id),
		city: varchar('city', { length: 120 }),
		primaryPlatformId: int('primary_platform_id').references(() => platforms.id),
		/** Denormalised so discovery can filter and sort without a join per row. */
		totalReach: int('total_reach').default(0).notNull(),
		startingPrice: int('starting_price').default(0).notNull(),
		currencyCode: varchar('currency_code', { length: 8 }).default('ETB').notNull(),
		/** 0–100, derived by $lib/server/score.ts. Never edited by hand. */
		score: int('score').default(10).notNull(),
		verificationLevel: mysqlEnum('verification_level', verificationLevelEnum)
			.default('unverified')
			.notNull(),
		availability: mysqlEnum('availability', availabilityEnum).default('available').notNull(),
		isFeatured: boolean('is_featured').default(false).notNull(),
		isTrending: boolean('is_trending').default(false).notNull(),
		/** Share of audience outside the home country, and where it sits. */
		overseasPercentage: int('overseas_percentage').default(0).notNull(),
		topCountries: json('top_countries').$type<string[]>().default([]).notNull(),
		reviewsCount: int('reviews_count').default(0).notNull(),
		averageRating: double('average_rating').default(0).notNull(),
		completedBookings: int('completed_bookings').default(0).notNull(),
		/** Imported profiles stay unpublished until an operator releases them. */
		isPublished: boolean('is_published').default(false).notNull(),
		isClaimed: boolean('is_claimed').default(false).notNull(),
		...publishable(),
		...audit()
	},
	(t) => [
		uniqueIndex('creators_username_idx').on(t.username),
		/*
		 * One profile per account. `getCreatorFor` assumes this everywhere, and
		 * without it a double-submitted create form leaves the user with two
		 * profiles and no defined answer to which one they are. Imported
		 * profiles carry a null `userId`, and MySQL permits repeated nulls in a
		 * unique index, so unclaimed supply is unaffected.
		 */
		uniqueIndex('creators_user_idx').on(t.userId),
		index('creators_country_idx').on(t.countryId),
		index('creators_reach_idx').on(t.totalReach),
		index('creators_price_idx').on(t.startingPrice)
	]
);

export const creatorCategories = mysqlTable(
	'creator_categories',
	{
		id: id(),
		creatorId: int('creator_id')
			.notNull()
			.references(() => creators.id, { onDelete: 'cascade' }),
		categoryId: int('category_id')
			.notNull()
			.references(() => categories.id, { onDelete: 'cascade' })
	},
	(t) => [uniqueIndex('creator_category_unique').on(t.creatorId, t.categoryId)]
);

export const creatorLanguages = mysqlTable(
	'creator_languages',
	{
		id: id(),
		creatorId: int('creator_id')
			.notNull()
			.references(() => creators.id, { onDelete: 'cascade' }),
		languageId: int('language_id')
			.notNull()
			.references(() => languages.id, { onDelete: 'cascade' })
	},
	(t) => [uniqueIndex('creator_language_unique').on(t.creatorId, t.languageId)]
);

export const socialAccounts = mysqlTable(
	'social_accounts',
	{
		id: id(),
		creatorId: int('creator_id')
			.notNull()
			.references(() => creators.id, { onDelete: 'cascade' }),
		platformId: int('platform_id')
			.notNull()
			.references(() => platforms.id),
		handle: varchar('handle', { length: 160 }).notNull(),
		followers: int('followers').default(0).notNull(),
		engagementRate: double('engagement_rate').default(0).notNull(),
		profileUrl: varchar('profile_url', { length: 500 }),
		isVerified: boolean('is_verified').default(false).notNull(),
		...publishable(),
		...audit()
	},
	(t) => [index('social_creator_idx').on(t.creatorId)]
);

export const packages = mysqlTable(
	'packages',
	{
		id: id(),
		creatorId: int('creator_id')
			.notNull()
			.references(() => creators.id, { onDelete: 'cascade' }),
		title: varchar('title', { length: 200 }).notNull(),
		platformId: int('platform_id').references(() => platforms.id),
		description: text('description'),
		deliverables: json('deliverables').$type<string[]>().default([]).notNull(),
		price: int('price').default(0).notNull(),
		currencyCode: varchar('currency_code', { length: 8 }).default('ETB').notNull(),
		deliveryDays: int('delivery_days').default(3).notNull(),
		revisions: int('revisions').default(2).notNull(),
		...publishable(),
		...audit()
	},
	(t) => [index('packages_creator_idx').on(t.creatorId)]
);

export const portfolioItems = mysqlTable(
	'portfolio_items',
	{
		id: id(),
		creatorId: int('creator_id')
			.notNull()
			.references(() => creators.id, { onDelete: 'cascade' }),
		mediaType: mysqlEnum('media_type', ['image', 'video']).default('image').notNull(),
		url: varchar('url', { length: 500 }).notNull(),
		caption: varchar('caption', { length: 300 }),
		platformId: int('platform_id').references(() => platforms.id),
		views: int('views').default(0).notNull(),
		likes: int('likes').default(0).notNull(),
		...publishable(),
		...audit()
	},
	(t) => [index('portfolio_creator_idx').on(t.creatorId)]
);

/* ================================================================== *
 * 4. DEMAND — campaigns and applications
 * ================================================================== */

export const compensationTypeEnum = ['paid', 'barter', 'event_pass'] as const;
export const campaignStatusEnum = [
	'draft',
	'published',
	'closed',
	'cancelled',
	'completed'
] as const;

export const campaigns = mysqlTable(
	'campaigns',
	{
		id: id(),
		organizationId: int('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		title: varchar('title', { length: 250 }).notNull(),
		slug: varchar('slug', { length: 280 }).notNull(),
		description: text('description'),
		objective: text('objective'),
		/** Exactly one compensation model per published campaign (PRD FR-041). */
		compensationType: mysqlEnum('compensation_type', compensationTypeEnum)
			.default('paid')
			.notNull(),
		categoryId: int('category_id').references(() => categories.id),
		platformIds: json('platform_ids').$type<number[]>().default([]).notNull(),
		creatorsNeeded: int('creators_needed').default(1).notNull(),
		followerMin: int('follower_min').default(0).notNull(),
		followerMax: int('follower_max').default(0).notNull(),
		budgetMin: int('budget_min').default(0).notNull(),
		budgetMax: int('budget_max').default(0).notNull(),
		currencyCode: varchar('currency_code', { length: 8 }).default('ETB').notNull(),
		countryId: int('country_id').references(() => countries.id),
		targetRegions: json('target_regions').$type<string[]>().default([]).notNull(),
		/** Only meaningful when compensationType is `barter`. */
		barterDetails: text('barter_details'),
		/** Only meaningful when compensationType is `event_pass`. */
		eventName: varchar('event_name', { length: 250 }),
		eventDate: date('event_date', { mode: 'string' }),
		eventLocation: varchar('event_location', { length: 250 }),
		passType: varchar('pass_type', { length: 250 }),
		deliverables: json('deliverables').$type<string[]>().default([]).notNull(),
		deadline: date('deadline', { mode: 'string' }),
		language: varchar('language', { length: 80 }).default('Amharic & English').notNull(),
		tags: json('tags').$type<string[]>().default([]).notNull(),
		status: mysqlEnum('status', campaignStatusEnum).default('draft').notNull(),
		applicationsCount: int('applications_count').default(0).notNull(),
		...publishable(),
		...audit()
	},
	(t) => [
		uniqueIndex('campaigns_slug_idx').on(t.slug),
		index('campaigns_org_idx').on(t.organizationId),
		index('campaigns_status_idx').on(t.status)
	]
);

export const applicationStatusEnum = [
	'applied',
	'shortlisted',
	'selected',
	'rejected',
	'withdrawn'
] as const;

export const applications = mysqlTable(
	'applications',
	{
		id: id(),
		campaignId: int('campaign_id')
			.notNull()
			.references(() => campaigns.id, { onDelete: 'cascade' }),
		creatorId: int('creator_id')
			.notNull()
			.references(() => creators.id, { onDelete: 'cascade' }),
		pitch: text('pitch').notNull(),
		proposedPrice: int('proposed_price').default(0).notNull(),
		currencyCode: varchar('currency_code', { length: 8 }).default('ETB').notNull(),
		status: mysqlEnum('status', applicationStatusEnum).default('applied').notNull(),
		/** Why an organisation rejected or selected. Kept for the audit trail. */
		decisionNote: text('decision_note'),
		...publishable(),
		...audit()
	},
	/** PRD INV-005: one active application per creator per campaign. */
	(t) => [uniqueIndex('application_unique').on(t.campaignId, t.creatorId)]
);

/* ================================================================== *
 * 5. TRANSACTIONS — bookings, deliverables, settlement
 * ================================================================== */

export const bookingStatusEnum = [
	'proposed',
	'negotiating',
	'booked',
	'in_production',
	'submitted',
	'revision',
	'approved',
	'awaiting_settlement',
	'completed',
	'cancelled',
	'disputed'
] as const;

export const escrowStatusEnum = ['unfunded', 'pending', 'held', 'released', 'refunded'] as const;
/**
 * Whether anyone has reached the creator behind an unclaimed profile. `none`
 * is every ordinary booking; see `domain/booking.ts` for the transitions.
 */
export const introductionStatusEnum = [
	'none',
	'pending',
	'contacted',
	'connected',
	'declined'
] as const;
export const paymentMethodEnum = ['telebirr', 'chapa', 'cbe_birr', 'bank_transfer'] as const;

/**
 * Where a single attempt to pay stands.
 *
 * Deliberately not the same vocabulary as `escrowStatusEnum`: a booking has one
 * escrow state, but it may collect several payment attempts on the way there —
 * an abandoned checkout, a card that was declined, then one that worked. Only
 * the last of those changes the booking.
 */
export const paymentStatusEnum = ['pending', 'success', 'failed', 'cancelled'] as const;

/**
 * Where a single attempt to pay a creator stands.
 *
 * Separate from `paymentStatusEnum` because money leaving has a state money
 * arriving does not: `queued`. A deposit is decided the moment the payer
 * finishes at the provider, but a transfer is accepted by Chapa, then held for
 * an OTP or a server approval, then settled by a bank on its own schedule.
 * Collapsing that wait into `pending` would make "we have not sent this yet"
 * and "the bank has it" the same row, and only one of those may be retried.
 */
export const payoutStatusEnum = ['pending', 'queued', 'success', 'failed', 'cancelled'] as const;

/** The frozen copy of agreed terms. Written once, never edited (PRD FR-061). */
export type TermsSnapshot = {
	title: string;
	deliverables: string[];
	price: number;
	currencyCode: string;
	platformFee: number;
	creatorPayout: number;
	compensationType: (typeof compensationTypeEnum)[number];
	revisionsAllowed: number;
	deadline: string | null;
	barterDetails?: string | null;
	eventDetails?: { name: string; date: string | null; location: string; passType: string } | null;
	agreedAt: string;
	agreedByOrgUserId: string | null;
	agreedByCreatorUserId: string | null;
};

export const bookings = mysqlTable(
	'bookings',
	{
		id: id(),
		/** Human-facing order number shown in the UI and on exports. */
		reference: varchar('reference', { length: 32 }).notNull(),
		campaignId: int('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
		applicationId: int('application_id').references(() => applications.id, {
			onDelete: 'set null'
		}),
		creatorId: int('creator_id')
			.notNull()
			.references(() => creators.id, { onDelete: 'cascade' }),
		organizationId: int('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		packageId: int('package_id').references(() => packages.id, { onDelete: 'set null' }),
		title: varchar('title', { length: 250 }).notNull(),
		deliverables: json('deliverables').$type<string[]>().default([]).notNull(),
		compensationType: mysqlEnum('compensation_type', compensationTypeEnum)
			.default('paid')
			.notNull(),
		price: int('price').default(0).notNull(),
		currencyCode: varchar('currency_code', { length: 8 }).default('ETB').notNull(),
		/** 15% marketplace take rate, stored so historical fees never drift. */
		platformFee: int('platform_fee').default(0).notNull(),
		creatorPayout: int('creator_payout').default(0).notNull(),
		status: mysqlEnum('status', bookingStatusEnum).default('proposed').notNull(),
		escrowStatus: mysqlEnum('escrow_status', escrowStatusEnum).default('unfunded').notNull(),
		/*
		 * Set once, at insert, from whether the creator had claimed their
		 * profile. A booking against an unclaimed profile is a lead an operator
		 * has to chase, not a negotiation the creator can answer.
		 */
		introductionStatus: mysqlEnum('introduction_status', introductionStatusEnum)
			.default('none')
			.notNull(),
		introductionNote: text('introduction_note'),
		introducedBy: userRef('introduced_by').references(() => user.id, { onDelete: 'set null' }),
		introducedAt: timestamp('introduced_at', { fsp: 3 }),
		paymentMethod: mysqlEnum('payment_method', paymentMethodEnum),
		paymentRef: varchar('payment_ref', { length: 120 }),
		deadline: date('deadline', { mode: 'string' }),
		revisionsUsed: int('revisions_used').default(0).notNull(),
		revisionsAllowed: int('revisions_allowed').default(2).notNull(),
		/** Frozen at mutual confirmation. Nothing downstream may rewrite it. */
		termsSnapshot: json('terms_snapshot').$type<TermsSnapshot>(),
		termsFrozenAt: timestamp('terms_frozen_at', { fsp: 3 }),
		completedAt: timestamp('completed_at', { fsp: 3 }),
		cancelReason: text('cancel_reason'),
		...publishable(),
		...audit()
	},
	(t) => [
		uniqueIndex('bookings_reference_idx').on(t.reference),
		index('bookings_creator_idx').on(t.creatorId),
		index('bookings_org_idx').on(t.organizationId),
		index('bookings_status_idx').on(t.status),
		/* The operator queue opens on the open cases, so it reads this alone. */
		index('bookings_introduction_idx').on(t.introductionStatus)
	]
);

/** One negotiation round. The chain of these is the negotiation timeline. */
export const proposalPartyEnum = ['organization', 'creator'] as const;
export const proposalStatusEnum = ['pending', 'accepted', 'countered', 'declined'] as const;

/**
 * One attempt to pay for a booking, as the provider saw it.
 *
 * The booking carries the *outcome* — `escrow_status`, and the reference of the
 * attempt that succeeded. This carries the attempts, including the ones that
 * did not: a brand who abandons a checkout and retries leaves two rows, and the
 * difference between "never tried" and "tried twice and gave up" is the sort of
 * thing that only ever matters once, in a support conversation, after the fact.
 *
 * `txRef` is ours and unique. It is the idempotency key for the whole
 * integration: the return page and the webhook both resolve the same payment,
 * usually within a second of each other, and the unique index is what makes
 * "settle this reference" safe to run twice.
 */
export const payments = mysqlTable(
	'payments',
	{
		id: id(),
		bookingId: int('booking_id')
			.notNull()
			.references(() => bookings.id, { onDelete: 'cascade' }),
		/** Our reference, sent to the provider and quoted back by it. */
		txRef: varchar('tx_ref', { length: 100 }).notNull(),
		provider: varchar('provider', { length: 30 }).default('chapa').notNull(),
		status: mysqlEnum('status', paymentStatusEnum).default('pending').notNull(),
		/** Minor-unit-free, like every other amount here — see domain/money.ts. */
		amount: int('amount').default(0).notNull(),
		currencyCode: varchar('currency_code', { length: 8 }).default('ETB').notNull(),
		/**
		 * How they actually paid, in the provider's vocabulary — telebirr,
		 * cbebirr, card. Free text rather than an enum: this is the provider's
		 * list to extend, and a payment method we have never seen is not a
		 * reason to fail a verification.
		 */
		method: varchar('method', { length: 40 }),
		/** The provider's own reference for the movement of money. */
		providerRef: varchar('provider_ref', { length: 120 }),
		/** `test` or `live`. A test payment must never read as money received. */
		mode: varchar('mode', { length: 10 }),
		/** Why it failed, when it did — for the operator, not the payer. */
		failureReason: varchar('failure_reason', { length: 300 }),
		/** When the provider was asked, and answered, about this attempt. */
		verifiedAt: timestamp('verified_at', { fsp: 3 }),
		...audit()
	},
	(t) => [
		uniqueIndex('payments_tx_ref_idx').on(t.txRef),
		index('payments_booking_idx').on(t.bookingId)
	]
);

/**
 * Where a creator's money goes.
 *
 * One per creator, and kept out of the `creators` row on purpose: that row is
 * read by the public profile, the discovery grid, the trending job and the
 * score service, and none of them have any business joining a bank account
 * along for the ride. A separate table means the only queries that can see an
 * account number are the ones that asked for it.
 *
 * `isVerified` is not a claim about the bank. It records that an operator
 * matched the name and number against something — a screenshot, a first small
 * transfer that landed — because Chapa will happily send money to a valid
 * account number belonging to the wrong person, and it cannot be recalled.
 */
export const payoutAccounts = mysqlTable(
	'payout_accounts',
	{
		id: id(),
		creatorId: int('creator_id')
			.notNull()
			.references(() => creators.id, { onDelete: 'cascade' }),
		/** Chapa's own id for the bank, from `GET /v1/banks`. Sent as `bank_code`. */
		bankCode: int('bank_code').notNull(),
		/** Denormalised so a payout row reads without a call to the provider. */
		bankName: varchar('bank_name', { length: 160 }).notNull(),
		/** The name on the account, which the bank matches against the number. */
		accountName: varchar('account_name', { length: 180 }).notNull(),
		accountNumber: varchar('account_number', { length: 60 }).notNull(),
		currencyCode: varchar('currency_code', { length: 8 }).default('ETB').notNull(),
		isVerified: boolean('is_verified').default(false).notNull(),
		verifiedBy: userRef('verified_by').references(() => user.id, { onDelete: 'set null' }),
		verifiedAt: timestamp('verified_at', { fsp: 3 }),
		...audit()
	},
	(t) => [uniqueIndex('payout_accounts_creator_idx').on(t.creatorId)]
);

/**
 * One attempt to pay a creator for one booking.
 *
 * The mirror image of `payments`, and shaped like it for the same reason: a
 * booking may take several attempts to pay out — a wrong account number, a
 * bank that was down — and every one of them is worth keeping.
 *
 * The bank details are copied onto the row rather than read through
 * `payoutAccountId`. This is the same rule as `termsSnapshot`: a creator who
 * changes banks next year must not silently rewrite where last year's money
 * went. The foreign key says which account was chosen; these four columns say
 * what was actually sent, and they are never updated.
 */
export const payouts = mysqlTable(
	'payouts',
	{
		id: id(),
		bookingId: int('booking_id')
			.notNull()
			.references(() => bookings.id, { onDelete: 'cascade' }),
		creatorId: int('creator_id')
			.notNull()
			.references(() => creators.id, { onDelete: 'cascade' }),
		/** Which account was chosen. Nulled rather than blocking its deletion. */
		payoutAccountId: int('payout_account_id').references(() => payoutAccounts.id, {
			onDelete: 'set null'
		}),
		/** Ours, unique per attempt, and what Chapa is later asked about. */
		reference: varchar('reference', { length: 100 }).notNull(),
		provider: varchar('provider', { length: 30 }).default('chapa').notNull(),
		status: mysqlEnum('status', payoutStatusEnum).default('pending').notNull(),
		amount: int('amount').default(0).notNull(),
		currencyCode: varchar('currency_code', { length: 8 }).default('ETB').notNull(),
		/* Frozen at send. See the note above — these are deliberately not a join. */
		bankCode: int('bank_code').notNull(),
		bankName: varchar('bank_name', { length: 160 }).notNull(),
		accountName: varchar('account_name', { length: 180 }).notNull(),
		accountNumber: varchar('account_number', { length: 60 }).notNull(),
		/** Chapa's own reference for the transfer, for a support conversation. */
		providerRef: varchar('provider_ref', { length: 120 }),
		/** `test` or `live`. A test transfer must never read as money sent. */
		mode: varchar('mode', { length: 10 }),
		failureReason: varchar('failure_reason', { length: 300 }),
		/** When the provider was last asked, and answered, about this attempt. */
		verifiedAt: timestamp('verified_at', { fsp: 3 }),
		...audit()
	},
	(t) => [
		uniqueIndex('payouts_reference_idx').on(t.reference),
		index('payouts_booking_idx').on(t.bookingId),
		index('payouts_creator_idx').on(t.creatorId),
		/* The operator queue opens on what is unresolved, so it reads this alone. */
		index('payouts_status_idx').on(t.status)
	]
);

export const termProposals = mysqlTable(
	'term_proposals',
	{
		id: id(),
		bookingId: int('booking_id')
			.notNull()
			.references(() => bookings.id, { onDelete: 'cascade' }),
		proposedBy: mysqlEnum('proposed_by', proposalPartyEnum).notNull(),
		price: int('price').default(0).notNull(),
		currencyCode: varchar('currency_code', { length: 8 }).default('ETB').notNull(),
		deliverables: json('deliverables').$type<string[]>().default([]).notNull(),
		deadline: date('deadline', { mode: 'string' }),
		revisionsAllowed: int('revisions_allowed').default(2).notNull(),
		note: text('note'),
		status: mysqlEnum('status', proposalStatusEnum).default('pending').notNull(),
		...publishable(),
		...audit()
	},
	(t) => [index('proposals_booking_idx').on(t.bookingId)]
);

export const submissionStatusEnum = ['submitted', 'approved', 'revision_requested'] as const;

export const submissions = mysqlTable(
	'submissions',
	{
		id: id(),
		bookingId: int('booking_id')
			.notNull()
			.references(() => bookings.id, { onDelete: 'cascade' }),
		contentUrl: varchar('content_url', { length: 500 }).notNull(),
		notes: text('notes'),
		status: mysqlEnum('status', submissionStatusEnum).default('submitted').notNull(),
		/** Reason recorded whenever a revision is requested (PRD FR-072). */
		reviewNote: text('review_note'),
		reviewedBy: userRef('reviewed_by').references(() => user.id, { onDelete: 'set null' }),
		reviewedAt: timestamp('reviewed_at', { fsp: 3 }),
		...publishable(),
		...audit()
	},
	(t) => [index('submissions_booking_idx').on(t.bookingId)]
);

/* ================================================================== *
 * 6. CONVERSATION, TRUST, OPERATIONS
 * ================================================================== */

export const messages = mysqlTable(
	'messages',
	{
		id: id(),
		/** Scoped to a deal — there is no global inbox (PRD FR-100). */
		bookingId: int('booking_id').references(() => bookings.id, { onDelete: 'cascade' }),
		applicationId: int('application_id').references(() => applications.id, {
			onDelete: 'cascade'
		}),
		senderId: userRef('sender_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		body: text('body').notNull(),
		/** True when the contact masker rewrote part of the message. */
		isMasked: boolean('is_masked').default(false).notNull(),
		readAt: timestamp('read_at', { fsp: 3 }),
		...publishable(),
		...audit()
	},
	(t) => [
		index('messages_booking_idx').on(t.bookingId),
		index('messages_app_idx').on(t.applicationId)
	]
);

export const reviewDirectionEnum = ['brand_to_creator', 'creator_to_brand'] as const;

export const reviews = mysqlTable(
	'reviews',
	{
		id: id(),
		bookingId: int('booking_id')
			.notNull()
			.references(() => bookings.id, { onDelete: 'cascade' }),
		creatorId: int('creator_id')
			.notNull()
			.references(() => creators.id, { onDelete: 'cascade' }),
		organizationId: int('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		authorId: userRef('author_id').references(() => user.id, { onDelete: 'set null' }),
		direction: mysqlEnum('direction', reviewDirectionEnum).default('brand_to_creator').notNull(),
		rating: int('rating').notNull(),
		communication: int('communication').default(5).notNull(),
		professionalism: int('professionalism').default(5).notNull(),
		timeliness: int('timeliness').default(5).notNull(),
		quality: int('quality').default(5).notNull(),
		body: text('body'),
		...publishable(),
		...audit()
	},
	/** PRD INV-010: one active review per party per completed booking. */
	(t) => [uniqueIndex('review_unique').on(t.bookingId, t.direction)]
);

export const verificationSubjectEnum = ['creator', 'organization'] as const;
export const verificationStatusEnum = [
	'pending',
	'under_review',
	'more_info',
	'approved',
	'rejected'
] as const;

export const verificationRequests = mysqlTable(
	'verification_requests',
	{
		id: id(),
		subjectType: mysqlEnum('subject_type', verificationSubjectEnum).default('creator').notNull(),
		creatorId: int('creator_id').references(() => creators.id, { onDelete: 'cascade' }),
		organizationId: int('organization_id').references(() => organizations.id, {
			onDelete: 'cascade'
		}),
		requestedLevel: mysqlEnum('requested_level', verificationLevelEnum)
			.default('identity_verified')
			.notNull(),
		documentUrl: varchar('document_url', { length: 500 }),
		socialProofs: json('social_proofs').$type<string[]>().default([]).notNull(),
		status: mysqlEnum('status', verificationStatusEnum).default('pending').notNull(),
		adminNotes: text('admin_notes'),
		reviewedBy: userRef('reviewed_by').references(() => user.id, { onDelete: 'set null' }),
		reviewedAt: timestamp('reviewed_at', { fsp: 3 }),
		...publishable(),
		...audit()
	},
	(t) => [index('verification_status_idx').on(t.status)]
);

export const claimStatusEnum = ['pending', 'approved', 'rejected', 'withdrawn'] as const;

/**
 * Somebody asking for an imported profile that describes them.
 *
 * The row is a request and nothing more: it grants no access on its own, and
 * the only write that attaches an account is an operator approving it, which
 * sets `creators.userId`. That column carries a unique index, so two approved
 * claims for one account cannot both land however the queue is worked.
 */
export const creatorClaims = mysqlTable(
	'creator_claims',
	{
		id: id(),
		creatorId: int('creator_id')
			.notNull()
			.references(() => creators.id, { onDelete: 'cascade' }),
		/** The account asking. Cascades: a deleted account has no claim to press. */
		claimantId: userRef('claimant_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		status: mysqlEnum('status', claimStatusEnum).default('pending').notNull(),
		/** What the claimant offers as proof. Read by an operator, trusted by nothing. */
		evidence: text('evidence'),
		/** A link an operator can check: a post, a bio mention, a pinned story. */
		proofUrl: varchar('proof_url', { length: 500 }),
		adminNotes: text('admin_notes'),
		reviewedBy: userRef('reviewed_by').references(() => user.id, { onDelete: 'set null' }),
		reviewedAt: timestamp('reviewed_at', { fsp: 3 }),
		...publishable(),
		...audit()
	},
	(t) => [index('claim_status_idx').on(t.status), index('claim_creator_idx').on(t.creatorId)]
);

export const savedCreators = mysqlTable(
	'saved_creators',
	{
		id: id(),
		organizationId: int('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		creatorId: int('creator_id')
			.notNull()
			.references(() => creators.id, { onDelete: 'cascade' }),
		note: varchar('note', { length: 300 }),
		...publishable(),
		...audit()
	},
	(t) => [uniqueIndex('saved_creator_unique').on(t.organizationId, t.creatorId)]
);

export const notifications = mysqlTable(
	'notifications',
	{
		id: id(),
		userId: userRef('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		title: varchar('title', { length: 250 }).notNull(),
		body: text('body'),
		link: varchar('link', { length: 300 }),
		kind: varchar('kind', { length: 60 }).default('info').notNull(),
		readAt: timestamp('read_at', { fsp: 3 }),
		...publishable(),
		...audit()
	},
	(t) => [index('notifications_user_idx').on(t.userId)]
);

/**
 * Per-account preferences, kept out of better-auth's `user` table.
 *
 * That table is owned by the auth library and its shape is its business; a
 * column added there is a column the adapter has to tolerate on every read.
 * These are ours, so they live here, and a missing row means "the defaults" —
 * nothing has to be written at sign-up for the account to behave correctly.
 */
export const userSettings = mysqlTable('user_settings', {
	userId: userRef('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),

	/** Proposals, countered terms, submissions, settlement — the deal itself. */
	dealsEmail: boolean('deals_email').default(true).notNull(),
	dealsApp: boolean('deals_app').default(true).notNull(),

	messagesEmail: boolean('messages_email').default(true).notNull(),
	messagesApp: boolean('messages_app').default(true).notNull(),

	/**
	 * Verification, claims, and the state of the account itself. Security mail a
	 * person did not ask for — a password reset, a sign-in from a new device —
	 * is sent whatever this says: switching off a warning is not a preference
	 * anyone can meaningfully consent to in advance.
	 */
	accountEmail: boolean('account_email').default(true).notNull(),

	/** Anything we send because we want to, rather than because something
	    happened to them. Off unless asked for. */
	productEmail: boolean('product_email').default(false).notNull(),

	/**
	 * When they asked us to close the account, if they have.
	 *
	 * A request rather than a switch. `user` cascades to `organizations`, which
	 * cascades to `bookings`, so deleting the row would take every deal that
	 * organisation ever made with it — an operator unpicks this by hand, and the
	 * timestamp is what stops a second request while the first is open.
	 */
	closureRequestedAt: timestamp('closure_requested_at', { fsp: 3 }),
	closureReason: text('closure_reason'),

	createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { fsp: 3 })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull()
});

/**
 * Append-only record of every state change. Nothing here is ever updated or
 * deleted — that is the point (PRD FR-112).
 */
export const auditLog = mysqlTable(
	'audit_log',
	{
		id: id(),
		actorId: userRef('actor_id'),
		actorLabel: varchar('actor_label', { length: 180 }),
		entity: varchar('entity', { length: 80 }).notNull(),
		entityId: int('entity_id'),
		action: varchar('action', { length: 80 }).notNull(),
		fromState: varchar('from_state', { length: 80 }),
		toState: varchar('to_state', { length: 80 }),
		reason: text('reason'),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull()
	},
	(t) => [index('audit_entity_idx').on(t.entity, t.entityId)]
);

export const siteSettings = mysqlTable('site_settings', {
	id: id(),
	siteName: varchar('site_name', { length: 180 }).default('Creator Network').notNull(),
	tagline: varchar('tagline', { length: 250 })
		.default("Connecting Ethiopia's digital influence.")
		.notNull(),
	heroTitle: varchar('hero_title', { length: 250 })
		.default('Find the right creator. Build the right campaign.')
		.notNull(),
	heroSubtitle: text('hero_subtitle'),
	/** Take rate in percent. Used when a booking is created. */
	platformFeePercent: int('platform_fee_percent').default(15).notNull(),
	supportEmail: varchar('support_email', { length: 200 }),
	supportPhone: varchar('support_phone', { length: 60 }),
	...audit()
});

/**
 * The slides in the homepage gallery, in the order an admin arranged them.
 *
 * Purely presentational, so there is nothing to join to: each row carries its
 * own image and copy. `image` holds an uploaded file name that `/files/[name]`
 * serves, or an absolute URL — `assetUrl` in $lib/assets accepts both.
 */
export const gallerySlides = mysqlTable('gallery_slides', {
	id: id(),
	title: varchar('title', { length: 180 }).notNull(),
	subtitle: text('subtitle'),
	image: varchar('image', { length: 500 }).default('').notNull(),
	/** Where the slide points, if anywhere. Rendered as the call-to-action href. */
	linkUrl: varchar('link_url', { length: 500 }),
	linkLabel: varchar('link_label', { length: 80 }),
	...publishable(),
	...audit()
});

/* ================================================================== *
 * 8. TRENDING
 *
 * The trending strip used to be a single `creators.is_trending` checkbox: an
 * operator ticked a box and nothing recorded why, when, or on what evidence.
 * These seven tables hold the whole mechanism instead —
 *
 *   trending_config       one row of knobs: which signals count and how much
 *   trending_overrides    operator pins, boosts and blocks, optionally expiring
 *   trending_entries      the board that is live right now, one row per slot
 *   trending_lanes        the same board cut by category, market and channel
 *   trending_lane_entries who is in each lane, in order
 *   trending_cooldowns    who is resting, so the same faces cannot camp forever
 *   trending_runs         append-only history of every recompute
 *
 * `creators.is_trending` is still the flag every card and query reads; a run
 * rewrites it from the entries below, so the badge and the board cannot drift.
 * ================================================================== */

/**
 * How the board is filled.
 *
 * `manual` keeps the old behaviour — only what an operator ticks. `automatic`
 * ignores pins and ranks purely on the weighted signals. `hybrid` seats the
 * pins first and lets the algorithm fill what is left.
 */
export const trendingModeEnum = ['manual', 'automatic', 'hybrid'] as const;

/**
 * How a raw signal becomes a 0–1 number before it is weighted.
 *
 * `percentile` ranks a creator against the rest of the candidate pool, so one
 * account with ten million followers cannot flatten everyone else's reach
 * score. `minmax` keeps the true distances between candidates, which is what
 * you want when the pool is small and the gaps are real.
 */
export const trendingNormalizationEnum = ['percentile', 'minmax'] as const;

/**
 * What a reader's own location does to the order they are shown.
 *
 * `off` serves everyone the same board. `boost` is worth `localBoost` points
 * out of a hundred to a creator in the reader's market — enough to lift a
 * near-miss above a stranger, not enough to bury a runaway leader. `first`
 * puts every local creator ahead of every other one, board order kept inside
 * each group.
 */
export const trendingLocalRankingEnum = ['off', 'boost', 'first'] as const;

/**
 * How close a creator has to be to count as the reader's own.
 *
 * The finer levels fall back rather than fail: a reader whose city is unknown
 * is still matched on their region, and one with neither on their country.
 */
export const trendingLocalMatchEnum = ['country', 'region', 'city'] as const;

/**
 * The ways the board is cut into lanes.
 *
 * Every one of these is a column or a join the creator table already carries,
 * which is the test a new kind has to pass: a lane the database cannot group
 * by is a lane somebody has to maintain by hand.
 */
export const trendingLaneKindEnum = [
	'category',
	'country',
	'region',
	'city',
	'platform',
	'language'
] as const;

export const trendingOverrideKindEnum = ['pin', 'boost', 'block'] as const;
export const trendingEntrySourceEnum = ['pinned', 'algorithm', 'manual'] as const;
export const trendingTriggerEnum = ['manual', 'auto', 'settings'] as const;

/** One creator's contribution table, kept so a rank can always be explained. */
export type TrendingBreakdown = {
	components: {
		key: string;
		/** The measured value, in its own unit — followers, bookings, stars. */
		raw: number;
		/** That value mapped to 0–1 against the candidate pool. */
		normalized: number;
		/** The configured weight, as a share of the total weight. */
		share: number;
		/** normalized × share × 100 — what this signal added to the score. */
		contribution: number;
	}[];
	/** Operator boost applied after the weighted sum. 1 means untouched. */
	multiplier: number;
	/** Score before the multiplier, so a boost is visible rather than baked in. */
	baseScore: number;
};

export const trendingConfig = mysqlTable('trending_config', {
	id: id(),
	mode: mysqlEnum('mode', trendingModeEnum).default('hybrid').notNull(),
	/** How many creators the board holds. */
	slots: int('slots').default(12).notNull(),
	/** Activity older than this is not counted at all. */
	windowDays: int('window_days').default(30).notNull(),
	/**
	 * Days after which an event inside the window counts half as much. 0 turns
	 * decay off and every event in the window counts the same — the difference
	 * between "what is happening now" and "what happened this month".
	 */
	halfLifeDays: int('half_life_days').default(7).notNull(),
	normalization: mysqlEnum('normalization', trendingNormalizationEnum)
		.default('percentile')
		.notNull(),

	/* Weights. Relative, not percentages: the service divides by their sum, so
	   an operator can raise one without having to rebalance the other nine. */
	weightScore: int('weight_score').default(20).notNull(),
	weightReach: int('weight_reach').default(10).notNull(),
	weightEngagement: int('weight_engagement').default(15).notNull(),
	weightBookings: int('weight_bookings').default(15).notNull(),
	weightApplications: int('weight_applications').default(5).notNull(),
	weightReviews: int('weight_reviews').default(5).notNull(),
	weightRating: int('weight_rating').default(10).notNull(),
	weightSaves: int('weight_saves').default(5).notNull(),
	weightNewcomer: int('weight_newcomer').default(5).notNull(),
	weightVerification: int('weight_verification').default(10).notNull(),

	/* Eligibility — applied before ranking, so a weight can never promote a
	   creator the platform is not willing to put on its homepage. */
	minScore: int('min_score').default(0).notNull(),
	minFollowers: int('min_followers').default(0).notNull(),
	minRating: double('min_rating').default(0).notNull(),
	minVerification: mysqlEnum('min_verification', verificationLevelEnum)
		.default('unverified')
		.notNull(),
	requireAvailable: boolean('require_available').default(false).notNull(),
	requireChannel: boolean('require_channel').default(true).notNull(),
	/** Demands at least one booking, application, review or save in the window. */
	requireActivity: boolean('require_activity').default(false).notNull(),

	/* Diversity caps. 0 means no cap. */
	maxPerCategory: int('max_per_category').default(0).notNull(),
	maxPerCountry: int('max_per_country').default(0).notNull(),

	/* Rotation. Without it the same handful of accounts hold every slot for as
	   long as their numbers stay good, and new supply is never discovered. */
	maxTenureDays: int('max_tenure_days').default(0).notNull(),
	cooldownDays: int('cooldown_days').default(0).notNull(),

	/** In hybrid mode, whether pins take the top slots or are merely guaranteed. */
	pinnedFirst: boolean('pinned_first').default(true).notNull(),

	/* Location. The market the board is drawn from, and what a reader's own
	   location is worth once it has been drawn. */

	/**
	 * Restricts the board to one market. Null — the default — ranks every
	 * country together, which is what a platform with one home market wants
	 * until the day it has two.
	 */
	countryId: int('country_id').references(() => countries.id),
	localRanking: mysqlEnum('local_ranking', trendingLocalRankingEnum).default('off').notNull(),
	localMatch: mysqlEnum('local_match', trendingLocalMatchEnum).default('country').notNull(),
	/** Points out of a hundred a local match is worth. Only read in `boost`. */
	localBoost: int('local_boost').default(15).notNull(),

	/* Lanes. The board is one ordered list; a lane is that same ranking cut to
	   one category, market or channel, so the homepage can offer "trending in
	   fashion" and "trending in Addis Ababa" without a second algorithm. A
	   count of 0 switches that kind of lane off. */

	/** How many creators a lane holds. */
	laneSlots: int('lane_slots').default(8).notNull(),
	/** A lane thinner than this is not published — three faces is not a strip. */
	laneMinSize: int('lane_min_size').default(4).notNull(),
	/** How far down the ranking lanes are cut from. 0 means every candidate. */
	lanePoolSize: int('lane_pool_size').default(120).notNull(),
	maxCategoryLanes: int('max_category_lanes').default(6).notNull(),
	maxCountryLanes: int('max_country_lanes').default(3).notNull(),
	maxRegionLanes: int('max_region_lanes').default(0).notNull(),
	maxCityLanes: int('max_city_lanes').default(0).notNull(),
	maxPlatformLanes: int('max_platform_lanes').default(3).notNull(),
	maxLanguageLanes: int('max_language_lanes').default(0).notNull(),
	/**
	 * Whether a reader's own market's lanes are moved to the front.
	 *
	 * Read when the page is served rather than when the board is built: the run
	 * is one board for everybody, and where the reader is is a fact about the
	 * request.
	 */
	laneLocalFirst: boolean('lane_local_first').default(true).notNull(),

	autoRefresh: boolean('auto_refresh').default(false).notNull(),
	refreshIntervalMinutes: int('refresh_interval_minutes').default(360).notNull(),
	/** Holds the current board still — no run, manual or automatic, replaces it. */
	isFrozen: boolean('is_frozen').default(false).notNull(),
	lastRunAt: timestamp('last_run_at', { fsp: 3 }),
	...audit()
});

export const trendingOverrides = mysqlTable(
	'trending_overrides',
	{
		id: id(),
		creatorId: int('creator_id')
			.notNull()
			.references(() => creators.id, { onDelete: 'cascade' }),
		kind: mysqlEnum('kind', trendingOverrideKindEnum).notNull(),
		/** Requested slot for a pin, 1-based. 0 means "anywhere in the board". */
		position: int('position').default(0).notNull(),
		/** Multiplies the computed score for a boost. 1 leaves it untouched. */
		multiplier: double('multiplier').default(1).notNull(),
		/** Why — this is the sentence that justifies a hand-placed homepage slot. */
		note: varchar('note', { length: 300 }),
		/** Runs after this stop applying it. Null means it stands until removed. */
		expiresAt: timestamp('expires_at', { fsp: 3 }),
		...audit()
	},
	/* One standing instruction per creator: a pin and a block on the same row
	   would have no defined winner. Removal is a real delete rather than a soft
	   one, so the operator can re-add a creator they just unblocked. */
	(t) => [uniqueIndex('trending_override_creator_idx').on(t.creatorId)]
);

export const trendingEntries = mysqlTable(
	'trending_entries',
	{
		id: id(),
		creatorId: int('creator_id')
			.notNull()
			.references(() => creators.id, { onDelete: 'cascade' }),
		/** 1-based slot on the board. */
		rank: int('rank').notNull(),
		trendingScore: double('trending_score').default(0).notNull(),
		source: mysqlEnum('source', trendingEntrySourceEnum).default('algorithm').notNull(),
		breakdown: json('breakdown').$type<TrendingBreakdown | null>(),
		runId: int('run_id'),
		/** Carried across runs, so tenure is measured from the first appearance. */
		firstRankedAt: timestamp('first_ranked_at', { fsp: 3 }).defaultNow().notNull(),
		computedAt: timestamp('computed_at', { fsp: 3 }).defaultNow().notNull()
	},
	(t) => [
		uniqueIndex('trending_entry_creator_idx').on(t.creatorId),
		index('trending_rank_idx').on(t.rank)
	]
);

export const trendingCooldowns = mysqlTable(
	'trending_cooldowns',
	{
		id: id(),
		creatorId: int('creator_id')
			.notNull()
			.references(() => creators.id, { onDelete: 'cascade' }),
		restingUntil: timestamp('resting_until', { fsp: 3 }).notNull(),
		reason: varchar('reason', { length: 200 }),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull()
	},
	(t) => [uniqueIndex('trending_cooldown_creator_idx').on(t.creatorId)]
);

/**
 * Append-only history of recomputes. The config snapshot is stored with the
 * run because the knobs change: without it, last week's board could not be
 * explained with this week's settings.
 */
export const trendingRuns = mysqlTable('trending_runs', {
	id: id(),
	mode: mysqlEnum('mode', trendingModeEnum).notNull(),
	trigger: mysqlEnum('trigger', trendingTriggerEnum).default('manual').notNull(),
	actorId: userRef('actor_id'),
	actorLabel: varchar('actor_label', { length: 180 }),
	/** How many creators cleared eligibility, and how many made the board. */
	candidateCount: int('candidate_count').default(0).notNull(),
	entryCount: int('entry_count').default(0).notNull(),
	/** Creators on the new board who were not on the previous one. */
	changedCount: int('changed_count').default(0).notNull(),
	durationMs: int('duration_ms').default(0).notNull(),
	note: text('note'),
	configSnapshot: json('config_snapshot').$type<Record<string, unknown>>(),
	createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull()
});

/**
 * A slice of the same ranking, cut to one category, market or channel.
 *
 * Lanes are rewritten wholesale by every run, so there is no unique key here
 * and no soft delete: the table holds the lanes of the current board and
 * nothing else. `label` is a snapshot rather than a join because a category
 * renamed between two runs should read the way it read when the board was
 * built, and because the homepage should not join five reference tables to
 * draw a row of chips.
 */
export const trendingLanes = mysqlTable(
	'trending_lanes',
	{
		id: id(),
		kind: mysqlEnum('kind', trendingLaneKindEnum).notNull(),
		/** The reference row this lane is cut on. Null for `city`, which is text. */
		refId: int('ref_id'),
		/** A city, lower-cased, for the one kind that has no reference table. */
		refKey: varchar('ref_key', { length: 160 }),
		label: varchar('label', { length: 180 }).notNull(),
		/** 1-based order among all lanes, before the reader's own market lifts any. */
		position: int('position').notNull(),
		size: int('size').notNull(),
		/** The best score inside the lane — how lanes of one kind are ordered. */
		topScore: double('top_score').default(0).notNull(),
		runId: int('run_id'),
		computedAt: timestamp('computed_at', { fsp: 3 }).defaultNow().notNull()
	},
	(t) => [index('trending_lane_position_idx').on(t.position)]
);

export const trendingLaneEntries = mysqlTable(
	'trending_lane_entries',
	{
		id: id(),
		laneId: int('lane_id')
			.notNull()
			.references(() => trendingLanes.id, { onDelete: 'cascade' }),
		creatorId: int('creator_id')
			.notNull()
			.references(() => creators.id, { onDelete: 'cascade' }),
		/** 1-based slot within the lane. */
		rank: int('rank').notNull(),
		trendingScore: double('trending_score').default(0).notNull(),
		source: mysqlEnum('source', trendingEntrySourceEnum).default('algorithm').notNull()
	},
	(t) => [index('trending_lane_entry_idx').on(t.laneId, t.rank)]
);

/* ================================================================== *
 * 9. BLOG
 *
 * Editorial pages, written by an operator and read by anyone. Three tables:
 *
 *   blog_categories   the sections a post can sit in — a reference table
 *   blog_posts        the article itself, body included
 *   blog_post_images  the gallery under an article, in the order chosen
 *
 * The body is HTML, because the editor that produces it is a rich text
 * editor. It is sanitised on the way *in* — see `$lib/server/sanitize.ts` —
 * so that the one place rendering it with `{@html}` is reading a value that
 * was already narrowed to an allowlist, rather than trusting the column.
 * ================================================================== */

/**
 * The sections a post can belong to.
 *
 * Separate from `categories`, which is the creator taxonomy: the filters on
 * discovery and the sections on a blog are different vocabularies that would
 * otherwise fight over one table, and renaming "Beauty" for creators would
 * silently rename a blog section.
 */
export const blogCategories = mysqlTable(
	'blog_categories',
	{
		id: id(),
		name: varchar('name', { length: 120 }).notNull(),
		slug: varchar('slug', { length: 140 }).notNull(),
		description: varchar('description', { length: 300 }),
		/** One of the `tile-*` accents, so a section reads the same everywhere. */
		accent: varchar('accent', { length: 40 }).default('mint').notNull(),
		...publishable(),
		...audit()
	},
	(t) => [uniqueIndex('blog_categories_slug_idx').on(t.slug)]
);

/**
 * `draft` is invisible to everyone but an operator, `published` is live, and
 * `archived` keeps a post reachable by its URL while dropping it from the
 * index and the feed — an article that is out of date but still linked to.
 */
export const blogPostStatusEnum = ['draft', 'published', 'archived'] as const;

export const blogPosts = mysqlTable(
	'blog_posts',
	{
		id: id(),
		title: varchar('title', { length: 250 }).notNull(),
		/** Derived from the title and made unique on save; never posted by a form. */
		slug: varchar('slug', { length: 280 }).notNull(),
		/** The standfirst: the card blurb, and the meta description's fallback. */
		excerpt: varchar('excerpt', { length: 500 }).default('').notNull(),
		/** Sanitised HTML. Written only through `sanitizeArticleHtml`. */
		body: mediumtext('body'),
		/**
		 * The body with its markup taken out.
		 *
		 * Search runs against this rather than `body`, because a `LIKE '%…%'`
		 * over HTML matches tag and attribute names — searching for "strong" or
		 * "class" would return every article that has ever been bolded.
		 */
		searchText: mediumtext('search_text'),
		/** Whole minutes, computed from the body on save. Zero means unknown. */
		readingMinutes: int('reading_minutes').default(0).notNull(),

		featuredImage: varchar('featured_image', { length: 500 }).default('').notNull(),
		featuredImageAlt: varchar('featured_image_alt', { length: 250 }),

		categoryId: int('category_id').references(() => blogCategories.id),
		tags: json('tags').$type<string[]>().default([]).notNull(),

		status: mysqlEnum('status', blogPostStatusEnum).default('draft').notNull(),
		/**
		 * When the post went live, which is not `createdAt`: a draft written in
		 * March and published in June is a June article, and the feed, the
		 * sitemap and the byline all date it by this.
		 */
		publishedAt: timestamp('published_at', { fsp: 3 }),

		/** Lifts one post into the index's lead slot. `sortOrder` breaks ties. */
		isFeatured: boolean('is_featured').default(false).notNull(),
		sortOrder: int('sort_order').default(0).notNull(),

		metaTitle: varchar('meta_title', { length: 250 }),
		metaDescription: varchar('meta_description', { length: 320 }),
		/** The social card image, when it should differ from the featured image. */
		ogImage: varchar('og_image', { length: 500 }),
		/** Set when a post should stay reachable but out of search results. */
		noIndex: boolean('no_index').default(false).notNull(),

		authorId: userRef('author_id').references(() => user.id, { onDelete: 'set null' }),
		/**
		 * The byline as it was written, kept beside `authorId`.
		 *
		 * The join to `user` supplies the name and the picture for a live
		 * account; this is what the article still says when that account is gone,
		 * and what lets a piece be filed under a name that is not an account.
		 */
		authorName: varchar('author_name', { length: 180 }),

		...audit()
	},
	(t) => [
		uniqueIndex('blog_posts_slug_idx').on(t.slug),
		index('blog_posts_status_idx').on(t.status, t.publishedAt),
		index('blog_posts_category_idx').on(t.categoryId)
	]
);

/**
 * The gallery beneath an article.
 *
 * Kept in its own table rather than as a JSON column on the post, because each
 * image is uploaded, captioned and reordered on its own — and because a
 * removed image has a file on disk that has to be deleted with it.
 */
export const blogPostImages = mysqlTable(
	'blog_post_images',
	{
		id: id(),
		postId: int('post_id')
			.notNull()
			.references(() => blogPosts.id, { onDelete: 'cascade' }),
		/** An uploaded file name, or an absolute URL. `assetUrl` accepts both. */
		image: varchar('image', { length: 500 }).notNull(),
		caption: varchar('caption', { length: 300 }),
		alt: varchar('alt', { length: 250 }),
		...publishable(),
		...audit()
	},
	(t) => [index('blog_post_images_post_idx').on(t.postId)]
);

/* ================================================================== *
 * RELATIONS
 * ================================================================== */

export const countriesRelations = relations(countries, ({ many }) => ({
	regions: many(regions),
	creators: many(creators)
}));

export const regionsRelations = relations(regions, ({ one }) => ({
	country: one(countries, { fields: [regions.countryId], references: [countries.id] })
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
	owner: one(user, { fields: [organizations.ownerId], references: [user.id] }),
	country: one(countries, { fields: [organizations.countryId], references: [countries.id] }),
	members: many(organizationMembers),
	campaigns: many(campaigns),
	bookings: many(bookings)
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
	organization: one(organizations, {
		fields: [organizationMembers.organizationId],
		references: [organizations.id]
	}),
	user: one(user, { fields: [organizationMembers.userId], references: [user.id] })
}));

export const creatorsRelations = relations(creators, ({ one, many }) => ({
	user: one(user, { fields: [creators.userId], references: [user.id] }),
	country: one(countries, { fields: [creators.countryId], references: [countries.id] }),
	region: one(regions, { fields: [creators.regionId], references: [regions.id] }),
	primaryPlatform: one(platforms, {
		fields: [creators.primaryPlatformId],
		references: [platforms.id]
	}),
	categories: many(creatorCategories),
	languages: many(creatorLanguages),
	socialAccounts: many(socialAccounts),
	packages: many(packages),
	portfolio: many(portfolioItems),
	bookings: many(bookings),
	reviews: many(reviews)
}));

export const creatorCategoriesRelations = relations(creatorCategories, ({ one }) => ({
	creator: one(creators, { fields: [creatorCategories.creatorId], references: [creators.id] }),
	category: one(categories, { fields: [creatorCategories.categoryId], references: [categories.id] })
}));

export const creatorLanguagesRelations = relations(creatorLanguages, ({ one }) => ({
	creator: one(creators, { fields: [creatorLanguages.creatorId], references: [creators.id] }),
	language: one(languages, { fields: [creatorLanguages.languageId], references: [languages.id] })
}));

export const socialAccountsRelations = relations(socialAccounts, ({ one }) => ({
	creator: one(creators, { fields: [socialAccounts.creatorId], references: [creators.id] }),
	platform: one(platforms, { fields: [socialAccounts.platformId], references: [platforms.id] })
}));

export const packagesRelations = relations(packages, ({ one }) => ({
	creator: one(creators, { fields: [packages.creatorId], references: [creators.id] }),
	platform: one(platforms, { fields: [packages.platformId], references: [platforms.id] })
}));

export const portfolioItemsRelations = relations(portfolioItems, ({ one }) => ({
	creator: one(creators, { fields: [portfolioItems.creatorId], references: [creators.id] }),
	platform: one(platforms, { fields: [portfolioItems.platformId], references: [platforms.id] })
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [campaigns.organizationId],
		references: [organizations.id]
	}),
	category: one(categories, { fields: [campaigns.categoryId], references: [categories.id] }),
	country: one(countries, { fields: [campaigns.countryId], references: [countries.id] }),
	applications: many(applications),
	bookings: many(bookings)
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
	campaign: one(campaigns, { fields: [applications.campaignId], references: [campaigns.id] }),
	creator: one(creators, { fields: [applications.creatorId], references: [creators.id] }),
	messages: many(messages)
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
	campaign: one(campaigns, { fields: [bookings.campaignId], references: [campaigns.id] }),
	creator: one(creators, { fields: [bookings.creatorId], references: [creators.id] }),
	organization: one(organizations, {
		fields: [bookings.organizationId],
		references: [organizations.id]
	}),
	package: one(packages, { fields: [bookings.packageId], references: [packages.id] }),
	proposals: many(termProposals),
	submissions: many(submissions),
	messages: many(messages),
	reviews: many(reviews),
	payouts: many(payouts)
}));

export const termProposalsRelations = relations(termProposals, ({ one }) => ({
	booking: one(bookings, { fields: [termProposals.bookingId], references: [bookings.id] })
}));

export const payoutAccountsRelations = relations(payoutAccounts, ({ one, many }) => ({
	creator: one(creators, { fields: [payoutAccounts.creatorId], references: [creators.id] }),
	payouts: many(payouts)
}));

export const payoutsRelations = relations(payouts, ({ one }) => ({
	booking: one(bookings, { fields: [payouts.bookingId], references: [bookings.id] }),
	creator: one(creators, { fields: [payouts.creatorId], references: [creators.id] }),
	account: one(payoutAccounts, {
		fields: [payouts.payoutAccountId],
		references: [payoutAccounts.id]
	})
}));

export const submissionsRelations = relations(submissions, ({ one }) => ({
	booking: one(bookings, { fields: [submissions.bookingId], references: [bookings.id] })
}));

export const messagesRelations = relations(messages, ({ one }) => ({
	booking: one(bookings, { fields: [messages.bookingId], references: [bookings.id] }),
	application: one(applications, {
		fields: [messages.applicationId],
		references: [applications.id]
	}),
	sender: one(user, { fields: [messages.senderId], references: [user.id] })
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
	booking: one(bookings, { fields: [reviews.bookingId], references: [bookings.id] }),
	creator: one(creators, { fields: [reviews.creatorId], references: [creators.id] }),
	organization: one(organizations, {
		fields: [reviews.organizationId],
		references: [organizations.id]
	})
}));

export const verificationRequestsRelations = relations(verificationRequests, ({ one }) => ({
	creator: one(creators, { fields: [verificationRequests.creatorId], references: [creators.id] }),
	organization: one(organizations, {
		fields: [verificationRequests.organizationId],
		references: [organizations.id]
	})
}));

export const savedCreatorsRelations = relations(savedCreators, ({ one }) => ({
	organization: one(organizations, {
		fields: [savedCreators.organizationId],
		references: [organizations.id]
	}),
	creator: one(creators, { fields: [savedCreators.creatorId], references: [creators.id] })
}));

export const trendingEntriesRelations = relations(trendingEntries, ({ one }) => ({
	creator: one(creators, { fields: [trendingEntries.creatorId], references: [creators.id] })
}));

export const trendingLanesRelations = relations(trendingLanes, ({ many }) => ({
	entries: many(trendingLaneEntries)
}));

export const trendingLaneEntriesRelations = relations(trendingLaneEntries, ({ one }) => ({
	lane: one(trendingLanes, {
		fields: [trendingLaneEntries.laneId],
		references: [trendingLanes.id]
	}),
	creator: one(creators, { fields: [trendingLaneEntries.creatorId], references: [creators.id] })
}));

export const trendingOverridesRelations = relations(trendingOverrides, ({ one }) => ({
	creator: one(creators, { fields: [trendingOverrides.creatorId], references: [creators.id] })
}));

export const blogCategoriesRelations = relations(blogCategories, ({ many }) => ({
	posts: many(blogPosts)
}));

export const blogPostsRelations = relations(blogPosts, ({ one, many }) => ({
	category: one(blogCategories, {
		fields: [blogPosts.categoryId],
		references: [blogCategories.id]
	}),
	author: one(user, { fields: [blogPosts.authorId], references: [user.id] }),
	images: many(blogPostImages)
}));

export const blogPostImagesRelations = relations(blogPostImages, ({ one }) => ({
	post: one(blogPosts, { fields: [blogPostImages.postId], references: [blogPosts.id] })
}));

export * from './auth.schema';
