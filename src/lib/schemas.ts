import * as m from '$lib/paraglide/messages';
import { z } from 'zod/v4';
import { idSchema, sortOrderField } from '$lib/server/crud';

export { idSchema, sortOrderField };

/* ------------------------------------------------------------------ *
 * Building blocks
 * ------------------------------------------------------------------ */

const name = (max = 180) =>
	z
		.string()
		.trim()
		.min(2, { error: () => m.val_too_short() })
		.max(max);
const optionalText = z.string().trim().optional().default('');

/**
 * True only for an absolute http(s) URL.
 *
 * `z.url()` validates through the `URL` constructor, which accepts every
 * scheme — `javascript:`, `data:` and `vbscript:` all pass it. Several of these
 * values are rendered straight into an `href`, where those schemes execute, so
 * the protocol is checked explicitly rather than left to the URL parser.
 */
const isHttpUrl = (value: string): boolean => {
	try {
		const { protocol } = new URL(value);
		return protocol === 'http:' || protocol === 'https:';
	} catch {
		return false;
	}
};

/** A required absolute http(s) link, e.g. a published deliverable. */
const httpUrl = z
	.string()
	.trim()
	.max(500)
	.refine(isHttpUrl, { error: () => m.val_full_url() });

const optionalUrl = z
	.string()
	.trim()
	.max(500)
	.optional()
	.default('')
	/* A site-relative path is also allowed here: these columns hold uploads too. */
	.refine((v) => !v || v.startsWith('/') || isHttpUrl(v), { error: () => m.val_full_url() });

/**
 * A column that holds a picture, however it got there.
 *
 * The value is either a freshly picked `File` or a string: an absolute URL, a
 * site-relative path, or the bare file name an earlier upload was stored under.
 * `contentCrud` saves a `File` and drops the string, which is what keeps an
 * edit that never touched the picker from wiping the stored picture.
 *
 * The bare-name case is why this exists rather than `optionalUrl`: that one
 * insists on a `/` or a scheme, and would reject the very name `saveUploadedFile`
 * just handed back.
 */
const uploadOrUrl = z
	.union([
		z.instanceof(File),
		z
			.string()
			.trim()
			.max(500)
			.refine((v) => !v || v.startsWith('/') || isHttpUrl(v) || !v.includes(':'), {
				error: () => m.val_full_url()
			})
	])
	.optional()
	.default('');
const money = z.coerce
	.number()
	.int()
	.min(0, { error: () => m.val_not_negative() })
	.default(0);
const count = z.coerce.number().int().min(0).default(0);
const refId = z.coerce.number().int().positive();
const optionalRefId = z.coerce.number().int().positive().optional();
const active = z.coerce.boolean().default(true);
/** Textareas that hold one item per line; crud.ts turns these into JSON arrays. */
const lines = z.string().trim().optional().default('');

/** Splits a one-per-line textarea into its non-empty, trimmed entries. */
export const linesOf = (value: string | null | undefined): string[] =>
	(value ?? '')
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);
const rate = z.coerce.number().min(0).max(100).default(0);

/* Every currency the `countries` table can carry, including the ones the
   imported African supply prices in (see scripts/import-creators.ts). A code
   missing here is rejected by the admin forms even though the column accepts
   it, which is how a creator ends up unsavable. */
const CURRENCIES = [
	'ETB',
	'KES',
	'NGN',
	'ZAR',
	'GHS',
	'RWF',
	'EGP',
	'UGX',
	'TZS',
	'MAD',
	'XOF',
	'XAF',
	'AED',
	'GBP',
	'USD'
] as const;
const currency = z.enum(CURRENCIES).default('ETB');

const VERIFICATION_LEVELS = [
	'unverified',
	'social_verified',
	'identity_verified',
	'cn_verified'
] as const;

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */

export const loginSchema = z.object({
	email: z.email({ error: () => m.val_valid_email() }),
	password: z.string().min(8, { error: () => m.val_min_8() })
});

export const registerSchema = z
	.object({
		name: name(),
		email: z.email({ error: () => m.val_valid_email() }),
		password: z.string().min(8, { error: () => m.val_min_8() }),
		confirm: z.string(),
		/** Admin is never self-selected — see routes/register/+page.server.ts. */
		role: z.enum(['creator', 'business']).default('creator')
	})
	.refine((data) => data.password === data.confirm, {
		error: () => m.val_passwords_mismatch(),
		path: ['confirm']
	});

/** Asking for a reset link. Only the address — the account may not exist. */
export const forgotPassword = z.object({
	email: z.email({ error: () => m.val_valid_email() })
});

/**
 * Setting the new password from a link.
 *
 * The token travels in a hidden field rather than being re-read from the URL at
 * submit time: the page is reachable with the token in the query string, and a
 * form that carries it explicitly is one that still works if the reader lands
 * here through a restored tab.
 */
export const resetPassword = z
	.object({
		token: z.string().min(1),
		password: z.string().min(8, { error: () => m.val_min_8() }),
		confirm: z.string()
	})
	.refine((data) => data.password === data.confirm, {
		error: () => m.val_passwords_mismatch(),
		path: ['confirm']
	});

export type LoginSchema = typeof loginSchema;
export type RegisterSchema = typeof registerSchema;

/* ------------------------------------------------------------------ *
 * Reference data (admin CRUD)
 * ------------------------------------------------------------------ */

export const countryAdd = z.object({
	name: name(120),
	code: z.string().trim().min(2).max(8).toUpperCase(),
	flag: z.string().trim().max(16).default('🌍'),
	currencyCode: z.string().trim().min(2).max(8).toUpperCase().default('USD'),
	currencySymbol: z.string().trim().max(12).default('$'),
	usdRate: z.coerce
		.number()
		.positive({ error: () => m.val_greater_than_zero() })
		.default(1),
	paymentRails: lines,
	description: optionalText,
	isActive: active,
	sortOrder: sortOrderField
});
export const countryEdit = countryAdd.extend(idSchema.shape);

export const regionAdd = z.object({
	countryId: refId,
	name: name(120),
	majorCities: lines,
	isActive: active,
	sortOrder: sortOrderField
});
export const regionEdit = regionAdd.extend(idSchema.shape);

export const categoryAdd = z.object({
	name: name(120),
	slug: z
		.string()
		.trim()
		.min(2)
		.max(140)
		.regex(/^[a-z0-9-]+$/, { error: () => m.val_slug_format() }),
	description: optionalText,
	icon: z.string().trim().max(60).default('Sparkles'),
	isActive: active,
	sortOrder: sortOrderField
});
export const categoryEdit = categoryAdd.extend(idSchema.shape);

export const platformAdd = z.object({
	name: name(60),
	color: z
		.string()
		.trim()
		.regex(/^#[0-9a-fA-F]{6}$/, { error: () => m.val_hex_colour() })
		.default('#0f172a'),
	isActive: active,
	sortOrder: sortOrderField
});
export const platformEdit = platformAdd.extend(idSchema.shape);

export const languageAdd = z.object({
	name: name(80),
	code: z.string().trim().min(2).max(8),
	isActive: active,
	sortOrder: sortOrderField
});
export const languageEdit = languageAdd.extend(idSchema.shape);

/* ------------------------------------------------------------------ *
 * Creator supply
 * ------------------------------------------------------------------ */

export const creatorAdd = z.object({
	username: z
		.string()
		.trim()
		.min(3)
		.max(120)
		.regex(/^[a-z0-9_.]+$/, { error: () => m.val_handle_format() }),
	fullName: name(),
	bio: optionalText,
	avatar: uploadOrUrl,
	cover: uploadOrUrl,
	countryId: optionalRefId,
	regionId: optionalRefId,
	city: z.string().trim().max(120).optional().default(''),
	primaryPlatformId: optionalRefId,
	totalReach: count,
	startingPrice: money,
	currencyCode: currency,
	verificationLevel: z.enum(VERIFICATION_LEVELS).default('unverified'),
	availability: z.enum(['available', 'busy', 'away']).default('available'),
	overseasPercentage: z.coerce.number().int().min(0).max(100).default(0),
	topCountries: lines,
	isFeatured: z.coerce.boolean().default(false),
	isTrending: z.coerce.boolean().default(false),
	isPublished: z.coerce.boolean().default(false),
	isActive: active,
	sortOrder: sortOrderField
});
export const creatorEdit = creatorAdd.extend(idSchema.shape);

/** What a creator may change about their own profile — no score, no badges. */
export const creatorSelfEdit = z.object({
	id: z.coerce.number(),
	fullName: name(),
	bio: optionalText,
	avatar: uploadOrUrl,
	cover: uploadOrUrl,
	countryId: optionalRefId,
	regionId: optionalRefId,
	city: z.string().trim().max(120).optional().default(''),
	primaryPlatformId: optionalRefId,
	startingPrice: money,
	currencyCode: currency,
	availability: z.enum(['available', 'busy', 'away']).default('available'),
	categoryIds: z.array(z.coerce.number()).default([]),
	languageIds: z.array(z.coerce.number()).default([])
});

export const creatorCreateProfile = z.object({
	username: z
		.string()
		.trim()
		.min(3)
		.max(120)
		.regex(/^[a-z0-9_.]+$/, { error: () => m.val_handle_format() }),
	fullName: name(),
	bio: z
		.string()
		.trim()
		.min(20, { error: () => m.val_bio_min() })
		.max(2000),
	countryId: refId,
	city: z.string().trim().min(2).max(120),
	primaryPlatformId: refId,
	startingPrice: money,
	currencyCode: currency
});

export const socialAdd = z.object({
	platformId: refId,
	handle: z.string().trim().min(2).max(160),
	followers: count,
	engagementRate: rate,
	profileUrl: optionalUrl,
	isVerified: z.coerce.boolean().default(false),
	isActive: active,
	sortOrder: sortOrderField
});
export const socialEdit = socialAdd.extend(idSchema.shape);

export const packageAdd = z.object({
	title: name(200),
	platformId: optionalRefId,
	description: optionalText,
	deliverables: lines,
	price: money,
	currencyCode: currency,
	deliveryDays: z.coerce.number().int().min(1).max(120).default(3),
	revisions: z.coerce.number().int().min(0).max(10).default(2),
	isActive: active,
	sortOrder: sortOrderField
});
export const packageEdit = packageAdd.extend(idSchema.shape);

export const portfolioAdd = z.object({
	mediaType: z.enum(['image', 'video']).default('image'),
	url: z.string().trim().min(1, 'A link or upload is required').max(500),
	caption: z.string().trim().max(300).optional().default(''),
	platformId: optionalRefId,
	views: count,
	likes: count,
	isActive: active,
	sortOrder: sortOrderField
});
export const portfolioEdit = portfolioAdd.extend(idSchema.shape);

/* ------------------------------------------------------------------ *
 * Organisations
 * ------------------------------------------------------------------ */

const ORG_TYPES = ['company', 'startup', 'agency', 'ngo', 'government', 'event_organizer'] as const;

export const organizationAdd = z.object({
	name: name(),
	slug: z
		.string()
		.trim()
		.min(2)
		.max(200)
		.regex(/^[a-z0-9-]+$/, { error: () => m.val_slug_format() }),
	orgType: z.enum(ORG_TYPES).default('company'),
	logo: optionalUrl,
	website: optionalUrl,
	bio: optionalText,
	countryId: optionalRefId,
	city: z.string().trim().max(120).optional().default(''),
	verificationLevel: z.enum(VERIFICATION_LEVELS).default('unverified'),
	monthlyBudgetCap: z.coerce.number().int().min(0).optional(),
	isActive: active,
	sortOrder: sortOrderField
});
export const organizationEdit = organizationAdd.extend(idSchema.shape);

/** The short version a business fills in right after signing up. */
export const organizationCreate = z.object({
	name: name(),
	orgType: z.enum(ORG_TYPES).default('company'),
	countryId: refId,
	city: z.string().trim().max(120).optional().default(''),
	website: optionalUrl,
	bio: optionalText
});

export const organizationSelfEdit = organizationCreate.extend({
	id: z.coerce.number(),
	logo: optionalUrl,
	monthlyBudgetCap: z.coerce.number().int().min(0).optional()
});

/* ------------------------------------------------------------------ *
 * Campaigns
 * ------------------------------------------------------------------ */

const COMPENSATION = ['paid', 'barter', 'event_pass'] as const;

/**
 * Publication validation lives here rather than in the route so the same rules
 * apply whether a campaign is created, edited or published later: a published
 * campaign must carry complete terms for the model it declares (PRD FR-042).
 */
const campaignShape = {
	/**
	 * Only an operator supplies this: a brand's campaigns are stamped from its
	 * session by the crud scope, which overrides anything posted here.
	 */
	organizationId: optionalRefId,
	title: name(250),
	description: z
		.string()
		.trim()
		.min(20, { error: () => m.val_description_min() })
		.max(4000),
	objective: optionalText,
	compensationType: z.enum(COMPENSATION).default('paid'),
	categoryId: optionalRefId,
	platformIds: z.array(z.coerce.number()).default([]),
	creatorsNeeded: z.coerce.number().int().min(1).max(500).default(1),
	followerMin: count,
	followerMax: count,
	budgetMin: money,
	budgetMax: money,
	currencyCode: currency,
	countryId: optionalRefId,
	targetRegions: lines,
	barterDetails: optionalText,
	eventName: z.string().trim().max(250).optional().default(''),
	eventDate: z.string().trim().optional().default(''),
	eventLocation: z.string().trim().max(250).optional().default(''),
	passType: z.string().trim().max(250).optional().default(''),
	deliverables: lines,
	deadline: z.string().trim().optional().default(''),
	language: z.string().trim().max(80).default('Amharic & English'),
	tags: lines,
	status: z.enum(['draft', 'published', 'closed', 'cancelled', 'completed']).default('draft'),
	isActive: active,
	sortOrder: sortOrderField
};

/** The fields the publication rules below inspect. */
type CampaignRuleInput = {
	compensationType: string;
	status: string;
	budgetMax: number;
	followerMin: number;
	followerMax: number;
	barterDetails?: string;
	eventName?: string;
};

/**
 * A draft may be incomplete; a published campaign may not. Applying the rules
 * here rather than in the route means they hold on create, edit and publish
 * alike (PRD FR-042).
 */
const withCompensationRules = <T extends z.ZodObject>(schema: T) =>
	schema
		.refine(
			(raw) => {
				const data = raw as CampaignRuleInput;
				return (
					data.compensationType !== 'paid' || data.status !== 'published' || data.budgetMax > 0
				);
			},
			{ error: () => m.val_paid_needs_budget(), path: ['budgetMax'] }
		)
		.refine(
			(raw) => {
				const data = raw as CampaignRuleInput;
				return (
					data.compensationType !== 'barter' ||
					data.status !== 'published' ||
					(data.barterDetails ?? '').length > 0
				);
			},
			{ error: () => m.val_barter_needs_details(), path: ['barterDetails'] }
		)
		.refine(
			(raw) => {
				const data = raw as CampaignRuleInput;
				return (
					data.compensationType !== 'event_pass' ||
					data.status !== 'published' ||
					(data.eventName ?? '').length > 0
				);
			},
			{ error: () => m.val_event_needs_name(), path: ['eventName'] }
		)
		.refine(
			(raw) => {
				const data = raw as CampaignRuleInput;
				return data.followerMax === 0 || data.followerMax >= data.followerMin;
			},
			{ error: () => m.val_max_at_least_min(), path: ['followerMax'] }
		);

export const campaignAdd = withCompensationRules(z.object(campaignShape));
export const campaignEdit = withCompensationRules(
	z.object({ ...campaignShape, ...idSchema.shape })
);

/* ------------------------------------------------------------------ *
 * Applications, bookings, delivery
 * ------------------------------------------------------------------ */

export const applicationSchema = z.object({
	campaignId: refId,
	pitch: z
		.string()
		.trim()
		.min(30, { error: () => m.val_pitch_min() })
		.max(2000),
	proposedPrice: money,
	currencyCode: currency
});

export const applicationDecision = z.object({
	id: refId,
	status: z.enum(['shortlisted', 'selected', 'rejected']),
	decisionNote: optionalText
});

export const bookingCreate = z.object({
	creatorId: refId,
	packageId: optionalRefId,
	campaignId: optionalRefId,
	title: name(250),
	deliverables: lines,
	compensationType: z.enum(COMPENSATION).default('paid'),
	price: money,
	currencyCode: currency,
	deadline: z.string().trim().optional().default(''),
	revisionsAllowed: z.coerce.number().int().min(0).max(10).default(2),
	note: optionalText
});

/** One round of the negotiation chain. Either side may send one. */
export const proposalSchema = z.object({
	bookingId: refId,
	price: money,
	currencyCode: currency,
	deliverables: lines,
	deadline: z.string().trim().optional().default(''),
	revisionsAllowed: z.coerce.number().int().min(0).max(10).default(2),
	note: optionalText
});

export const proposalRespond = z.object({
	proposalId: refId,
	decision: z.enum(['accept', 'decline'])
});

/**
 * Starting a Chapa checkout. Only the booking — the amount is the booking's
 * own price, read on the server: a form that carried it would be a form that
 * could change it.
 */
export const payDepositSchema = z.object({ bookingId: refId });

export const fundEscrowSchema = z.object({
	bookingId: refId,
	paymentMethod: z.enum(['telebirr', 'chapa', 'cbe_birr', 'bank_transfer']).default('telebirr')
});

export const submissionSchema = z.object({
	bookingId: refId,
	/* Rendered as an `href` on the brand's booking page — http(s) only. */
	contentUrl: httpUrl,
	notes: optionalText
});

export const reviewSubmission = z.object({
	submissionId: refId,
	decision: z.enum(['approve', 'revision']),
	reviewNote: optionalText
});

export const bookingIdSchema = z.object({ bookingId: refId });

export const reviewSchema = z.object({
	bookingId: refId,
	rating: z.coerce.number().int().min(1).max(5),
	communication: z.coerce.number().int().min(1).max(5).default(5),
	professionalism: z.coerce.number().int().min(1).max(5).default(5),
	timeliness: z.coerce.number().int().min(1).max(5).default(5),
	quality: z.coerce.number().int().min(1).max(5).default(5),
	body: z.string().trim().min(10, 'A sentence of detail helps the next brand').max(2000)
});

export const messageSchema = z.object({
	bookingId: optionalRefId,
	applicationId: optionalRefId,
	body: z.string().trim().min(1).max(4000)
});

/* ------------------------------------------------------------------ *
 * Trust and operations
 * ------------------------------------------------------------------ */

export const verificationSubmit = z.object({
	requestedLevel: z.enum(['social_verified', 'identity_verified', 'cn_verified']),
	/** Either an uploaded file or a link — the action normalises both to a path. */
	documentUrl: z
		.union([
			z.instanceof(File),
			/* A pasted link reaches an operator's `href`; an upload is a stored filename. */
			z
				.string()
				.trim()
				.max(500)
				.refine((v) => !v || isHttpUrl(v), {
					error: () => m.val_full_url()
				})
		])
		.optional()
		.default(''),
	/* One proof link per line, each rendered as an `href` in the operator queue. */
	socialProofs: lines.refine((v) => linesOf(v).every(isHttpUrl), {
		error: () => m.val_full_url()
	})
});

export const verificationDecision = z.object({
	id: refId,
	status: z.enum(['under_review', 'more_info', 'approved', 'rejected']),
	adminNotes: optionalText
});

/**
 * An operator recording where an introduction got to. `none` is absent: it is
 * decided at insert from the creator, never chosen by hand.
 */
export const introductionDecision = z.object({
	id: refId,
	status: z.enum(['contacted', 'connected', 'declined']),
	introductionNote: optionalText
});

/**
 * Somebody asking for an imported profile that describes them.
 *
 * The evidence has a floor because an operator has to be able to check it, and
 * "this is me" is not something anyone can check. `proofUrl` stays optional:
 * the strongest proof is often a direct message the operator opens themselves.
 */
export const claimRequest = z.object({
	creatorId: refId,
	evidence: z
		.string()
		.trim()
		.min(20, { error: () => m.val_claim_evidence() })
		.max(2000),
	proofUrl: optionalUrl
});

/** An operator settling a claim. `pending` and `withdrawn` are not outcomes. */
export const claimDecision = z.object({
	id: refId,
	status: z.enum(['approved', 'rejected']),
	adminNotes: optionalText
});

/** A claimant taking back their own request. */
export const claimWithdraw = z.object({ id: refId });

/* ------------------------------------------------------------------ *
 * Account settings
 * ------------------------------------------------------------------ */

export const accountDetails = z.object({
	name: name(180),
	phone: z.string().trim().max(40).optional().default('')
});

/**
 * Changing a password.
 *
 * The current one is required even though the session already proves who this
 * is: a session is something an unattended laptop also has, and this is the
 * change that would lock the owner out of their own account.
 */
export const passwordChange = z
	.object({
		currentPassword: z.string().min(1, { error: () => m.val_required() }),
		newPassword: z.string().min(8, { error: () => m.val_min_8() }),
		confirm: z.string(),
		/** Offered, and on by default: a password change is usually a response
		    to something. */
		signOutOthers: z.coerce.boolean().default(true)
	})
	.refine((data) => data.newPassword === data.confirm, {
		error: () => m.val_passwords_mismatch(),
		path: ['confirm']
	})
	.refine((data) => data.newPassword !== data.currentPassword, {
		error: () => m.val_password_unchanged(),
		path: ['newPassword']
	});

const pref = z.coerce.boolean().default(false);

/**
 * Every switch is sent on every save, so an unchecked box has to arrive as
 * `false` rather than as nothing — which is why these default to `false` and
 * the form posts a hidden companion for each one.
 */
export const notificationPreferences = z.object({
	dealsEmail: pref,
	dealsApp: pref,
	messagesEmail: pref,
	messagesApp: pref,
	accountEmail: pref,
	productEmail: pref
});

/** Asking us to close the account. The address is typed back as the confirmation. */
export const closureRequest = z.object({
	confirmEmail: z.string().trim().max(255),
	reason: optionalText
});

export const savedCreatorSchema = z.object({ creatorId: refId });

export const userRoleUpdate = z.object({
	userId: z.string().min(1),
	role: z.enum(['creator', 'business', 'admin'])
});

export const settingsSchema = z.object({
	id: z.coerce.number().optional(),
	siteName: name(180),
	tagline: z.string().trim().max(250),
	heroTitle: z.string().trim().max(250),
	heroSubtitle: optionalText,
	platformFeePercent: z.coerce.number().int().min(0).max(50).default(15),
	supportEmail: z.string().trim().max(200).optional().default(''),
	supportPhone: z.string().trim().max(60).optional().default('')
});

/* ------------------------------------------------------------------ *
 * Homepage gallery
 * ------------------------------------------------------------------ */

const gallerySlideFields = {
	title: name(180),
	subtitle: optionalText,
	image: uploadOrUrl,
	linkUrl: optionalUrl,
	linkLabel: z.string().trim().max(80).optional().default(''),
	isActive: active,
	sortOrder: sortOrderField
};

/* A new slide with no picture would render an empty box, so add insists on one.
   An edit does not: an empty picker there means "keep the stored image". */
export const gallerySlideAdd = z
	.object(gallerySlideFields)
	.refine((v) => (v.image instanceof File ? v.image.size > 0 : Boolean(v.image)), {
		path: ['image'],
		error: () => m.val_image_required()
	});
export const gallerySlideEdit = z.object({ ...gallerySlideFields, ...idSchema.shape });

/* ------------------------------------------------------------------ *
 * Trending
 *
 * Ranges are not decoration here: these values are the algorithm, and a
 * mistyped window or a negative weight would quietly reshape the homepage.
 * ------------------------------------------------------------------ */

const weight = z.coerce.number().int().min(0).max(100).default(0);

export const trendingConfigSchema = z.object({
	id: z.coerce.number().optional(),
	mode: z.enum(['manual', 'automatic', 'hybrid']).default('hybrid'),
	slots: z.coerce.number().int().min(1).max(48).default(12),
	windowDays: z.coerce.number().int().min(1).max(365).default(30),
	/** 0 disables decay — every event in the window then counts the same. */
	halfLifeDays: z.coerce.number().int().min(0).max(180).default(7),
	normalization: z.enum(['percentile', 'minmax']).default('percentile'),

	weightScore: weight,
	weightReach: weight,
	weightEngagement: weight,
	weightBookings: weight,
	weightApplications: weight,
	weightReviews: weight,
	weightRating: weight,
	weightSaves: weight,
	weightNewcomer: weight,
	weightVerification: weight,

	minScore: z.coerce.number().int().min(0).max(100).default(0),
	minFollowers: count,
	minRating: z.coerce.number().min(0).max(5).default(0),
	minVerification: z.enum(VERIFICATION_LEVELS).default('unverified'),
	requireAvailable: z.coerce.boolean().default(false),
	requireChannel: z.coerce.boolean().default(false),
	requireActivity: z.coerce.boolean().default(false),

	/** 0 means uncapped. */
	maxPerCategory: z.coerce.number().int().min(0).max(48).default(0),
	maxPerCountry: z.coerce.number().int().min(0).max(48).default(0),
	maxTenureDays: z.coerce.number().int().min(0).max(365).default(0),
	cooldownDays: z.coerce.number().int().min(0).max(365).default(0),

	pinnedFirst: z.coerce.boolean().default(false),
	autoRefresh: z.coerce.boolean().default(false),
	refreshIntervalMinutes: z.coerce.number().int().min(15).max(10080).default(360),
	isFrozen: z.coerce.boolean().default(false)
});

export const trendingOverrideSchema = z.object({
	creatorId: refId,
	kind: z.enum(['pin', 'boost', 'block']),
	/** 1-based slot for a pin; 0 leaves placement to the ranking. */
	position: z.coerce.number().int().min(0).max(48).default(0),
	multiplier: z.coerce.number().min(0.1).max(5).default(1),
	note: z.string().trim().max(300).optional().default(''),
	/** Blank means the instruction stands until an operator removes it. */
	expiresAt: z.string().trim().max(20).optional().default('')
});

export const trendingOverrideRemove = z.object({ id: z.coerce.number() });

export const trendingRunSchema = z.object({
	note: z.string().trim().max(300).optional().default('')
});
