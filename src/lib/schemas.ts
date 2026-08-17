import { z } from 'zod/v4';
import { idSchema, sortOrderField } from '$lib/server/crud';

export { idSchema, sortOrderField };

/* ------------------------------------------------------------------ *
 * Building blocks
 * ------------------------------------------------------------------ */

const name = (max = 180) => z.string().trim().min(2, 'Too short').max(max);
const optionalText = z.string().trim().optional().default('');
const optionalUrl = z
	.string()
	.trim()
	.max(500)
	.optional()
	.default('')
	.refine((v) => !v || /^(https?:\/\/|\/)/.test(v), 'Enter a full URL starting with http');
const money = z.coerce.number().int().min(0, 'Cannot be negative').default(0);
const count = z.coerce.number().int().min(0).default(0);
const refId = z.coerce.number().int().positive();
const optionalRefId = z.coerce.number().int().positive().optional();
const active = z.coerce.boolean().default(true);
/** Textareas that hold one item per line; crud.ts turns these into JSON arrays. */
const lines = z.string().trim().optional().default('');
const rate = z.coerce.number().min(0).max(100).default(0);

const CURRENCIES = ['ETB', 'KES', 'NGN', 'ZAR', 'GHS', 'RWF', 'EGP', 'AED', 'GBP', 'USD'] as const;
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
	email: z.email('Enter a valid email'),
	password: z.string().min(8, 'At least 8 characters')
});

export const registerSchema = z
	.object({
		name: name(),
		email: z.email('Enter a valid email'),
		password: z.string().min(8, 'At least 8 characters'),
		confirm: z.string(),
		/** Admin is never self-selected — see routes/register/+page.server.ts. */
		role: z.enum(['creator', 'business']).default('creator')
	})
	.refine((data) => data.password === data.confirm, {
		message: 'Passwords do not match',
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
	usdRate: z.coerce.number().positive('Must be greater than zero').default(1),
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
		.regex(/^[a-z0-9-]+$/, 'Lower-case letters, numbers and dashes only'),
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
		.regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #10b981')
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
		.regex(/^[a-z0-9_.]+$/, 'Lower-case letters, numbers, dots and underscores only'),
	fullName: name(),
	bio: optionalText,
	avatar: optionalUrl,
	cover: optionalUrl,
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
	avatar: optionalUrl,
	cover: optionalUrl,
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
		.regex(/^[a-z0-9_.]+$/, 'Lower-case letters, numbers, dots and underscores only'),
	fullName: name(),
	bio: z.string().trim().min(20, 'Tell brands at least a sentence or two').max(2000),
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
		.regex(/^[a-z0-9-]+$/, 'Lower-case letters, numbers and dashes only'),
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
	title: name(250),
	description: z.string().trim().min(20, 'Give creators something to respond to').max(4000),
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
const withCompensationRules = <T extends z.ZodObject<any>>(schema: T) =>
	schema
		.refine(
			(raw) => {
				const data = raw as CampaignRuleInput;
				return (
					data.compensationType !== 'paid' || data.status !== 'published' || data.budgetMax > 0
				);
			},
			{ message: 'A published paid campaign needs a budget', path: ['budgetMax'] }
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
			{ message: 'Describe what the creator receives', path: ['barterDetails'] }
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
			{ message: 'Name the event', path: ['eventName'] }
		)
		.refine(
			(raw) => {
				const data = raw as CampaignRuleInput;
				return data.followerMax === 0 || data.followerMax >= data.followerMin;
			},
			{ message: 'Maximum must be at least the minimum', path: ['followerMax'] }
		);

export const campaignAdd = withCompensationRules(z.object(campaignShape));
export const campaignEdit = withCompensationRules(z.object({ ...campaignShape, ...idSchema.shape }));

/* ------------------------------------------------------------------ *
 * Applications, bookings, delivery
 * ------------------------------------------------------------------ */

export const applicationSchema = z.object({
	campaignId: refId,
	pitch: z.string().trim().min(30, 'Say why your audience fits, in a sentence or three').max(2000),
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

export const fundEscrowSchema = z.object({
	bookingId: refId,
	paymentMethod: z.enum(['telebirr', 'chapa', 'cbe_birr', 'bank_transfer']).default('telebirr')
});

export const submissionSchema = z.object({
	bookingId: refId,
	contentUrl: z.url('Paste the published link'),
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
		.union([z.instanceof(File), z.string()])
		.optional()
		.default(''),
	socialProofs: lines
});

export const verificationDecision = z.object({
	id: refId,
	status: z.enum(['under_review', 'more_info', 'approved', 'rejected']),
	adminNotes: optionalText
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
