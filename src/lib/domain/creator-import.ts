/**
 * Turns the scraped creator CSV into rows shaped like the database schema.
 *
 * The CSV is one wide row per creator — location, three platforms' handles and
 * follower counts, a pricing note and the source it was read from. The schema
 * spreads that across `creators`, `social_accounts`, `creator_categories` and
 * the reference tables the first three point at, so the mapping is a fan-out,
 * not a rename.
 *
 * Everything here is pure: it returns natural keys (country code, region name,
 * platform name, category slug) rather than ids, and `scripts/import-creators.ts`
 * resolves those against the reference tables. That keeps the interesting part —
 * what becomes what, and what is thrown away — testable without a database.
 *
 * Columns with no home in the schema (source URL, when it was read, the average
 * views metric, the pricing status, the notes) are kept on `source` for the JSON
 * dump and dropped before the insert. Do not fold them into `bio`: that field is
 * public, and those columns are an operator's working notes about a scrape.
 */
import { calculateScore } from './score';

export type CsvRow = Record<string, string>;

/**
 * The columns this mapping reads. A changed export fails loudly rather than
 * silently mapping every creator to an empty string.
 *
 * Columns the export has gained are not listed and are not an error: the
 * `with_avatars` revision added `ID`, `Africa Region` and `Niche`, and none of
 * them reaches the schema. `ID` is the spreadsheet's own key, `Africa Region`
 * is a macro-region above the country while `regions` here hang *below* one,
 * and `Niche` is the same text `Bio / Focus` already carries — the categories
 * come out identical from either, so reading it would be a second path to the
 * same answer.
 */
export const EXPECTED_COLUMNS = [
	'Name',
	'Country',
	'State/Province/Region',
	'City',
	'Bio / Focus',
	'Primary Platform',
	'Primary Handle',
	'Instagram Handle',
	'Instagram Followers',
	'TikTok Handle',
	'TikTok Followers',
	'YouTube Handle',
	'YouTube Subscribers',
	'Other Socials',
	'Combined Audience Proxy',
	'Average Views / Reach Metric',
	'Engagement Rate',
	'Starting Price',
	'Currency',
	'Pricing Status',
	'Cover URL',
	'Primary Profile URL',
	'Source URL',
	'Source Updated',
	'Notes'
] as const;

/**
 * What the avatar column has been called, newest first.
 *
 * The `with_avatars` revision renamed `Avatar URL` to `Avatar / Profile Image
 * URL`. Both are accepted because both files are real: the rename is not worth
 * invalidating an export someone still has on disk.
 */
export const AVATAR_COLUMNS = ['Avatar / Profile Image URL', 'Avatar URL'] as const;

/** The avatar link, under whichever header this export used for it. */
export function avatarUrlOf(row: CsvRow): string | null {
	for (const column of AVATAR_COLUMNS) {
		const value = (row[column] ?? '').trim();
		if (value) return value;
	}
	return null;
}

/* ------------------------------------------------------------------ *
 * Reference data the CSV implies
 * ------------------------------------------------------------------ */

export type ReferenceCountry = {
	name: string;
	code: string;
	flag: string;
	currencyCode: string;
	currencySymbol: string;
	/** Units of local currency per 1 USD. Approximate — an operator corrects it. */
	usdRate: number;
	paymentRails: string[];
	description: string;
};

/**
 * The thirteen countries the CSV names.
 *
 * Seven already exist in `seed.ts`; those entries repeat the seeded values so
 * that re-running the import against a seeded database is a no-op. The importer
 * inserts a country only when its code is missing, so nothing here overwrites
 * an operator's corrected rate.
 */
export const IMPORT_COUNTRIES: ReferenceCountry[] = [
	{
		name: 'Ethiopia',
		code: 'ET',
		flag: '🇪🇹',
		currencyCode: 'ETB',
		currencySymbol: 'ETB',
		usdRate: 132.5,
		paymentRails: ['Telebirr', 'Chapa', 'CBE Birr', 'Bank Wire'],
		description: 'East Africa’s fastest-growing creator market, led by TikTok and Telegram.'
	},
	{
		name: 'Kenya',
		code: 'KE',
		flag: '🇰🇪',
		currencyCode: 'KES',
		currencySymbol: 'KSh',
		usdRate: 129.0,
		paymentRails: ['M-Pesa', 'Pesapal', 'Bank Wire'],
		description: 'Silicon Savannah: tech reviewers, travel storytellers and lifestyle creators.'
	},
	{
		name: 'Nigeria',
		code: 'NG',
		flag: '🇳🇬',
		currencyCode: 'NGN',
		currencySymbol: '₦',
		usdRate: 1550.0,
		paymentRails: ['Flutterwave', 'Paystack', 'NIBSS'],
		description: 'Africa’s largest creative economy — Afrobeats, comedy and fintech marketing.'
	},
	{
		name: 'Ghana',
		code: 'GH',
		flag: '🇬🇭',
		currencyCode: 'GHS',
		currencySymbol: 'GH₵',
		usdRate: 15.5,
		paymentRails: ['MTN MoMo', 'Flutterwave', 'Bank Transfer'],
		description: 'Heritage vlogging, diaspora homecomings and fashion.'
	},
	{
		name: 'South Africa',
		code: 'ZA',
		flag: '🇿🇦',
		currencyCode: 'ZAR',
		currencySymbol: 'R',
		usdRate: 18.2,
		paymentRails: ['PayFast', 'Ozow', 'Swift Wire'],
		description: 'The continent’s most mature brand-partnership market.'
	},
	{
		name: 'Rwanda',
		code: 'RW',
		flag: '🇷🇼',
		currencyCode: 'RWF',
		currencySymbol: 'FRw',
		usdRate: 1320.0,
		paymentRails: ['MTN MoMo', 'Bank of Kigali'],
		description: 'Conservation, tourism and clean-tech storytelling.'
	},
	{
		name: 'Egypt',
		code: 'EG',
		flag: '🇪🇬',
		currencyCode: 'EGP',
		currencySymbol: 'E£',
		usdRate: 48.5,
		paymentRails: ['Fawry', 'Card', 'Bank'],
		description: 'North African reach across Arabic-language audiences.'
	},
	{
		name: 'Uganda',
		code: 'UG',
		flag: '🇺🇬',
		currencyCode: 'UGX',
		currencySymbol: 'USh',
		usdRate: 3750.0,
		paymentRails: ['MTN MoMo', 'Airtel Money', 'Bank Wire'],
		description: 'Comedy, music and lifestyle creators with strong regional carry-over.'
	},
	{
		name: 'Tanzania',
		code: 'TZ',
		flag: '🇹🇿',
		currencyCode: 'TZS',
		currencySymbol: 'TSh',
		usdRate: 2600.0,
		paymentRails: ['M-Pesa', 'Tigo Pesa', 'Airtel Money'],
		description: 'Swahili-language entertainment, coastal travel and food.'
	},
	{
		name: 'Morocco',
		code: 'MA',
		flag: '🇲🇦',
		currencyCode: 'MAD',
		currencySymbol: 'DH',
		usdRate: 9.9,
		paymentRails: ['CMI', 'Card', 'Bank Wire'],
		description: 'Francophone and Arabic audiences across the Maghreb and the diaspora.'
	},
	{
		name: 'Senegal',
		code: 'SN',
		flag: '🇸🇳',
		currencyCode: 'XOF',
		currencySymbol: 'CFA',
		usdRate: 600.0,
		paymentRails: ['Wave', 'Orange Money', 'Bank Wire'],
		description: 'West African francophone culture, food and music.'
	},
	{
		name: "Côte d'Ivoire",
		code: 'CI',
		flag: '🇨🇮',
		currencyCode: 'XOF',
		currencySymbol: 'CFA',
		usdRate: 600.0,
		paymentRails: ['Wave', 'Orange Money', 'MTN MoMo'],
		description: 'Abidjan’s entertainment and lifestyle scene, francophone West Africa.'
	},
	{
		name: 'Cameroon',
		code: 'CM',
		flag: '🇨🇲',
		currencyCode: 'XAF',
		currencySymbol: 'FCFA',
		usdRate: 600.0,
		paymentRails: ['MTN MoMo', 'Orange Money'],
		description: 'Bilingual creators reaching both francophone and anglophone Africa.'
	}
];

const COUNTRY_BY_NAME = new Map(IMPORT_COUNTRIES.map((country) => [country.name, country]));

/**
 * CSV platform labels to `platforms.name`.
 *
 * A label that is not here has no row in the controlled vocabulary, so the
 * account is dropped with a warning rather than silently inventing a platform.
 */
const PLATFORM_NAMES: Record<string, string> = {
	tiktok: 'TikTok',
	instagram: 'Instagram',
	youtube: 'YouTube',
	facebook: 'Facebook',
	telegram: 'Telegram',
	x: 'X',
	twitter: 'X',
	linkedin: 'LinkedIn'
};

/**
 * Focus words to `categories.slug`.
 *
 * The bios are generated from a small vocabulary — "Creator focused on food /
 * travel / lifestyle." — so the mapping is exact-phrase first, then word by
 * word, which is what catches "family lifestyle" and "lifestyle short-form".
 */
const CATEGORY_SLUGS: Record<string, string> = {
	food: 'food-dining',
	coffee: 'food-dining',
	restaurant: 'food-dining',
	restaurants: 'food-dining',
	'restaurant discovery': 'food-dining',
	'restaurant reviews': 'food-dining',
	catering: 'food-dining',
	culinary: 'food-dining',
	'culinary culture': 'food-dining',
	hospitality: 'food-dining',
	travel: 'travel-tourism',
	adventure: 'travel-tourism',
	hotels: 'travel-tourism',
	'island life': 'travel-tourism',
	'destination storytelling': 'travel-tourism',
	'africa storytelling': 'travel-tourism',
	experiences: 'travel-tourism',
	tech: 'technology',
	gadgets: 'technology',
	photography: 'technology',
	'mobile photography': 'technology',
	editing: 'technology',
	lifestyle: 'lifestyle',
	culture: 'lifestyle',
	family: 'lifestyle',
	interiors: 'lifestyle',
	vlogs: 'lifestyle',
	'african lifestyle': 'lifestyle',
	'social impact': 'lifestyle',
	comedy: 'entertainment',
	entertainment: 'entertainment',
	'short-form': 'entertainment',
	prank: 'entertainment',
	challenges: 'entertainment',
	reactions: 'entertainment',
	dance: 'entertainment',
	choreography: 'entertainment',
	animation: 'entertainment',
	'visual creativity': 'entertainment',
	gaming: 'entertainment',
	commentary: 'entertainment',
	'digital media': 'entertainment',
	motivation: 'entertainment',
	beauty: 'beauty-fashion',
	skincare: 'beauty-fashion',
	hair: 'beauty-fashion',
	fashion: 'beauty-fashion',
	'modest fashion': 'beauty-fashion',
	style: 'beauty-fashion',
	accessories: 'beauty-fashion',
	fitness: 'sports-fitness',
	movement: 'sports-fitness',
	sports: 'sports-fitness',
	'sports content': 'sports-fitness',
	nutrition: 'health-wellness',
	wellness: 'health-wellness',
	health: 'health-wellness',
	business: 'business',
	'real estate': 'business',
	education: 'education',
	landscaping: 'agriculture',
	gardening: 'agriculture',
	'sustainable living': 'agriculture',
	finance: 'finance',
	money: 'finance'
};

/* ------------------------------------------------------------------ *
 * Field-level parsing
 * ------------------------------------------------------------------ */

/** "10,300,000" → 10300000. Anything unparseable is 0, never NaN. */
export function parseCount(value: string | undefined): number {
	const digits = (value ?? '').replace(/[^0-9]/g, '');
	if (!digits) return 0;
	const parsed = Number(digits);
	return Number.isFinite(parsed) ? parsed : 0;
}

/** "21.02%" → 21.02, clamped to the 0–100 the column accepts. */
export function parseRate(value: string | undefined): number {
	const parsed = Number.parseFloat((value ?? '').replace('%', '').trim());
	if (!Number.isFinite(parsed)) return 0;
	return Math.min(100, Math.max(0, parsed));
}

/**
 * A handle becomes the profile URL slug, so it has to satisfy the same
 * `^[a-z0-9_.]{3,120}$` that `creatorAdd` in `$lib/schemas.ts` enforces on the
 * admin form. Anything the regex would reject is reported, not repaired.
 */
export function toUsername(handle: string): string {
	return handle
		.trim()
		.replace(/^@/, '')
		.toLowerCase()
		.replace(/[^a-z0-9_.]/g, '');
}

const USERNAME_PATTERN = /^[a-z0-9_.]{3,120}$/;

/** The focus sentence's platform-agnostic terms, as category slugs. */
export function categoriesFor(bio: string): { slugs: string[]; unmapped: string[] } {
	const focus = bio
		.replace(/^creator focused on\s*/i, '')
		.replace(/\.$/, '')
		.toLowerCase();

	const slugs: string[] = [];
	const unmapped: string[] = [];

	for (const term of focus.split('/').map((part) => part.trim())) {
		if (!term) continue;
		const phrase = CATEGORY_SLUGS[term];
		if (phrase) {
			if (!slugs.includes(phrase)) slugs.push(phrase);
			continue;
		}
		/* Not a known phrase — try the individual words before giving up. */
		const words = term.split(/\s+/).filter((word) => CATEGORY_SLUGS[word]);
		if (!words.length) {
			unmapped.push(term);
			continue;
		}
		for (const word of words) {
			const slug = CATEGORY_SLUGS[word];
			if (!slugs.includes(slug)) slugs.push(slug);
		}
	}

	return { slugs, unmapped };
}

/** Where a handle lives, for the platforms whose URL shape is unambiguous. */
export function profileUrlFor(platform: string, handle: string): string | null {
	const bare = handle.trim().replace(/^@/, '');
	if (!bare) return null;
	switch (platform) {
		case 'Instagram':
			return `https://www.instagram.com/${bare}/`;
		case 'TikTok':
			return `https://www.tiktok.com/@${bare}`;
		case 'YouTube':
			return `https://www.youtube.com/@${bare}`;
		case 'Facebook':
			return `https://www.facebook.com/${bare}`;
		case 'Telegram':
			return `https://t.me/${bare}`;
		case 'X':
			return `https://x.com/${bare}`;
		default:
			return null;
	}
}

/* ------------------------------------------------------------------ *
 * Row mapping
 * ------------------------------------------------------------------ */

export type ImportedSocial = {
	/** `platforms.name` — resolved to `social_accounts.platform_id` on insert. */
	platform: string;
	handle: string;
	followers: number;
	engagementRate: number;
	profileUrl: string | null;
	isVerified: boolean;
	sortOrder: number;
};

/** The `creators` row, with reference tables still named rather than keyed. */
export type ImportedCreatorRow = {
	username: string;
	fullName: string;
	avatar: string | null;
	cover: string | null;
	bio: string;
	/** `countries.code`. */
	country: string;
	/** `regions.name` within that country, or null when the CSV has no region. */
	region: string | null;
	city: string;
	/** `platforms.name`. */
	primaryPlatform: string;
	totalReach: number;
	startingPrice: number;
	currencyCode: string;
	score: number;
	verificationLevel: 'unverified' | 'social_verified' | 'identity_verified' | 'cn_verified';
	availability: 'available' | 'busy' | 'away';
	isFeatured: boolean;
	isTrending: boolean;
	overseasPercentage: number;
	topCountries: string[];
	isPublished: boolean;
	isClaimed: boolean;
	isActive: boolean;
	sortOrder: number;
};

/** CSV columns the schema has no column for. Kept for audit, never inserted. */
export type ImportProvenance = {
	primaryProfileUrl: string;
	sourceUrl: string;
	sourceUpdated: string;
	averageViews: number;
	pricingStatus: string;
	notes: string;
};

export type ImportedCreator = {
	creator: ImportedCreatorRow;
	/** `categories.slug` values for `creator_categories`. */
	categories: string[];
	socials: ImportedSocial[];
	source: ImportProvenance;
	warnings: string[];
};

const PLATFORM_COLUMNS = [
	{ platform: 'Instagram', handle: 'Instagram Handle', followers: 'Instagram Followers' },
	{ platform: 'TikTok', handle: 'TikTok Handle', followers: 'TikTok Followers' },
	{ platform: 'YouTube', handle: 'YouTube Handle', followers: 'YouTube Subscribers' }
] as const;

/**
 * One CSV row to the rows the schema wants.
 *
 * `index` becomes `sortOrder`, which keeps the imported block in the CSV's own
 * order (roughly descending audience) wherever `contentCrud` sorts by it.
 */
export function mapCreatorRow(row: CsvRow, index: number): ImportedCreator {
	const warnings: string[] = [];
	const name = (row['Name'] ?? '').trim();
	const primaryHandle = (row['Primary Handle'] ?? '').trim();
	const username = toUsername(primaryHandle);

	if (!USERNAME_PATTERN.test(username)) {
		warnings.push(`handle "${primaryHandle}" is not a usable username ("${username}")`);
	}

	const country = COUNTRY_BY_NAME.get((row['Country'] ?? '').trim());
	if (!country) warnings.push(`unknown country "${row['Country']}"`);

	const primaryPlatform = PLATFORM_NAMES[(row['Primary Platform'] ?? '').trim().toLowerCase()];
	if (!primaryPlatform) warnings.push(`unknown primary platform "${row['Primary Platform']}"`);

	const focus = (row['Bio / Focus'] ?? '').trim();
	const notes = (row['Notes'] ?? '').trim();
	const { slugs, unmapped } = categoriesFor(focus);
	for (const term of unmapped) warnings.push(`no category for focus term "${term}"`);
	if (!slugs.length) warnings.push('no categories mapped');

	/* The CSV reports one engagement figure per creator, not per platform, so it
	   belongs to the account that produced it: the primary one. */
	const engagementRate = parseRate(row['Engagement Rate']);

	const socials: ImportedSocial[] = [];
	const seenPlatforms = new Set<string>();

	for (const column of PLATFORM_COLUMNS) {
		const followers = parseCount(row[column.followers]);
		const declared = (row[column.handle] ?? '').trim();
		if (!declared && !followers) continue;

		/* A follower count with no handle of its own is the primary handle on a
		   second platform — the CSV omits the repeat. */
		const handle = declared || primaryHandle;
		if (!declared) {
			warnings.push(`${column.platform} followers with no handle; using "${primaryHandle}"`);
		}
		if (handle.trim().length < 2) {
			warnings.push(`${column.platform} account skipped: no usable handle`);
			continue;
		}

		seenPlatforms.add(column.platform);
		socials.push({
			platform: column.platform,
			handle,
			followers,
			engagementRate: column.platform === primaryPlatform ? engagementRate : 0,
			profileUrl:
				column.platform === primaryPlatform && (row['Primary Profile URL'] ?? '').trim()
					? (row['Primary Profile URL'] ?? '').trim()
					: profileUrlFor(column.platform, handle),
			isVerified: false,
			sortOrder: socials.length
		});
	}

	/* "TikTok: @nuruvazi01; YouTube: NURUVAZI" — the overflow column. */
	for (const entry of (row['Other Socials'] ?? '').split(';')) {
		const [label, handle] = entry.split(':').map((part) => part?.trim() ?? '');
		if (!label || !handle) continue;
		const platform = PLATFORM_NAMES[label.toLowerCase()];
		if (!platform) {
			warnings.push(`dropped "${label}" account: no platform row for it`);
			continue;
		}
		if (seenPlatforms.has(platform)) continue;
		seenPlatforms.add(platform);
		socials.push({
			platform,
			handle,
			followers: 0,
			engagementRate: 0,
			profileUrl: profileUrlFor(platform, handle),
			isVerified: false,
			sortOrder: socials.length
		});
	}

	if (!socials.length && primaryPlatform) {
		/* Nothing per-platform, but the row still names one account. */
		socials.push({
			platform: primaryPlatform,
			handle: primaryHandle,
			followers: parseCount(row['Combined Audience Proxy']),
			engagementRate,
			profileUrl: (row['Primary Profile URL'] ?? '').trim() || null,
			isVerified: false,
			sortOrder: 0
		});
	}

	const avatar = avatarUrlOf(row);
	const cover = (row['Cover URL'] ?? '').trim() || null;
	/* The focus sentence only. `Notes` reads as an operator's margin note —
	   "exact YT handle not exposed", "included for culinary content, not
	   celebrity status" — and `bio` is what the public profile renders. */
	const bio = focus;

	/* Every row in this export is "request quote", so the column is empty and
	   `startingPrice` lands on 0 — which is what the cards already render as a
	   price on request. The pricing status itself is kept on `source`. */
	const startingPrice = parseCount(row['Starting Price']);

	const creator: ImportedCreatorRow = {
		username,
		fullName: name,
		avatar,
		cover,
		bio,
		country: country?.code ?? '',
		region: (row['State/Province/Region'] ?? '').trim() || null,
		city: (row['City'] ?? '').trim(),
		primaryPlatform: primaryPlatform ?? '',
		totalReach: parseCount(row['Combined Audience Proxy']),
		startingPrice,
		currencyCode: (row['Currency'] ?? '').trim() || (country?.currencyCode ?? 'USD'),
		score: calculateScore({
			fullName: name,
			bio,
			avatar,
			cover,
			categoryCount: slugs.length,
			/* The CSV carries no language or rate-card data. Both stay empty until
			   the creator claims the profile, and the score reflects that. */
			languageCount: 0,
			packageCount: 0,
			portfolioCount: 0,
			verificationLevel: 'unverified',
			engagementRate,
			averageRating: 0,
			completedBookings: 0
		}),
		/* Scraped, not checked: an operator raises this after verifying. */
		verificationLevel: 'unverified',
		availability: 'available',
		isFeatured: false,
		isTrending: false,
		/* No audience-geography data in this export. */
		overseasPercentage: 0,
		topCountries: [],
		/* Imported supply stays unpublished until an operator releases it. */
		isPublished: false,
		isClaimed: false,
		isActive: true,
		sortOrder: index
	};

	return {
		creator,
		categories: slugs,
		socials,
		source: {
			primaryProfileUrl: (row['Primary Profile URL'] ?? '').trim(),
			sourceUrl: (row['Source URL'] ?? '').trim(),
			sourceUpdated: (row['Source Updated'] ?? '').trim(),
			averageViews: parseCount(row['Average Views / Reach Metric']),
			pricingStatus: (row['Pricing Status'] ?? '').trim(),
			notes
		},
		warnings
	};
}

export type ImportResult = {
	creators: ImportedCreator[];
	/** Rows that could not be mapped at all, with the reason. */
	rejected: { name: string; reason: string }[];
	/** Regions the CSV implies, grouped by country code. */
	regions: Record<string, { name: string; majorCities: string[] }[]>;
	warnings: string[];
};

/**
 * Maps every row, drops the ones that cannot key a `creators` row, and collects
 * the reference rows the import needs to exist first.
 */
export function mapCreatorRows(rows: CsvRow[]): ImportResult {
	const creators: ImportedCreator[] = [];
	const rejected: { name: string; reason: string }[] = [];
	const warnings: string[] = [];
	const usernames = new Set<string>();
	const regions: Record<string, { name: string; majorCities: string[] }[]> = {};

	rows.forEach((row, index) => {
		const mapped = mapCreatorRow(row, index);
		const { username, country, primaryPlatform } = mapped.creator;
		const name = mapped.creator.fullName || username || `row ${index + 2}`;

		if (!USERNAME_PATTERN.test(username)) {
			rejected.push({ name, reason: 'no usable username' });
			return;
		}
		if (!country) {
			rejected.push({ name, reason: `unknown country "${row['Country']}"` });
			return;
		}
		if (!primaryPlatform) {
			rejected.push({ name, reason: `unknown platform "${row['Primary Platform']}"` });
			return;
		}
		/* `creators_username_idx` is unique, so a collision has to be resolved
		   here rather than by the database rejecting the second insert. */
		if (usernames.has(username)) {
			rejected.push({ name, reason: `duplicate username "${username}"` });
			return;
		}
		usernames.add(username);

		if (mapped.creator.region) {
			const list = (regions[country] ??= []);
			const existing = list.find((region) => region.name === mapped.creator.region);
			const city = mapped.creator.city;
			if (existing) {
				if (city && !existing.majorCities.includes(city)) existing.majorCities.push(city);
			} else {
				list.push({ name: mapped.creator.region, majorCities: city ? [city] : [] });
			}
		}

		for (const warning of mapped.warnings) warnings.push(`${name}: ${warning}`);
		creators.push(mapped);
	});

	return { creators, rejected, regions, warnings };
}
