/**
 * Seeds reference data, creator supply, organisations and campaigns.
 *
 * Run with `npm run db:seed`. It is idempotent: rows are matched on their
 * natural key (country code, creator username, campaign slug) so re-running
 * after a correction updates in place rather than duplicating.
 */

/* eslint-disable @typescript-eslint/no-explicit-any --
   A seed script that upserts into a dozen different tables through one helper.
   It runs by hand against a development database and writes nothing a user
   reaches; typing it fully would cost more than it protects. */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { and, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import * as t from './schema';
import { htmlToText, readingMinutes, sanitizeArticleHtml } from '../sanitize';
import { slugify } from '../../slug';
import { calculateScore } from '../../domain/score';
import { splitFee } from '../../domain/booking';
import { recalcCreatorAggregates } from './rollups';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
const pool = mysql.createPool(process.env.DATABASE_URL);
const db = drizzle(pool, { schema: t, mode: 'default' });

/* ------------------------------------------------------------------ *
 * Reference data
 * ------------------------------------------------------------------ */

const COUNTRIES = [
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
		name: 'United Arab Emirates',
		code: 'AE',
		flag: '🇦🇪',
		currencyCode: 'AED',
		currencySymbol: 'AED',
		usdRate: 3.67,
		paymentRails: ['Stripe UAE', 'Wire Transfer'],
		description: 'Diaspora hub for East African audiences in the Gulf.'
	},
	{
		name: 'United Kingdom',
		code: 'GB',
		flag: '🇬🇧',
		currencyCode: 'GBP',
		currencySymbol: '£',
		usdRate: 0.78,
		paymentRails: ['Wise', 'BACS', 'Stripe'],
		description: 'Diaspora creators bridging London and East Africa.'
	},
	{
		name: 'United States',
		code: 'US',
		flag: '🇺🇸',
		currencyCode: 'USD',
		currencySymbol: '$',
		usdRate: 1.0,
		paymentRails: ['Stripe', 'ACH', 'Wire'],
		description: 'Global diaspora reach and international brand budgets.'
	}
];

const ETHIOPIAN_REGIONS = [
	{ name: 'Addis Ababa', majorCities: ['Bole', 'Kazanchis', 'Piassa', 'Megenagna', 'CMC'] },
	{ name: 'Oromia', majorCities: ['Adama', 'Jimma', 'Bishoftu', 'Shashemene'] },
	{ name: 'Amhara', majorCities: ['Bahir Dar', 'Gondar', 'Dessie', 'Lalibela'] },
	{ name: 'Tigray', majorCities: ['Mekelle', 'Adigrat', 'Axum'] },
	{ name: 'Sidama', majorCities: ['Hawassa', 'Yirgalem'] },
	{ name: 'SNNPR', majorCities: ['Arba Minch', 'Sodo', 'Jinka'] },
	{ name: 'Dire Dawa', majorCities: ['Dire Dawa'] },
	{ name: 'Harari', majorCities: ['Harar'] },
	{ name: 'Afar', majorCities: ['Semera', 'Asaita'] },
	{ name: 'Somali', majorCities: ['Jigjiga', 'Gode'] },
	{ name: 'Benishangul-Gumuz', majorCities: ['Asosa'] },
	{ name: 'Gambela', majorCities: ['Gambela'] }
];

const OTHER_REGIONS: Record<string, { name: string; majorCities: string[] }[]> = {
	KE: [
		{ name: 'Nairobi', majorCities: ['Nairobi', 'Westlands', 'Karen'] },
		{ name: 'Coast', majorCities: ['Mombasa', 'Diani'] }
	],
	NG: [
		{ name: 'Lagos', majorCities: ['Victoria Island', 'Lekki', 'Ikeja'] },
		{ name: 'Abuja', majorCities: ['Abuja'] }
	],
	GH: [{ name: 'Greater Accra', majorCities: ['Accra', 'Tema'] }],
	ZA: [
		{ name: 'Gauteng', majorCities: ['Johannesburg', 'Pretoria'] },
		{ name: 'Western Cape', majorCities: ['Cape Town'] }
	],
	RW: [{ name: 'Kigali', majorCities: ['Kigali'] }],
	GB: [{ name: 'Greater London', majorCities: ['London'] }],
	US: [{ name: 'Washington DC Metro', majorCities: ['Washington', 'Silver Spring'] }],
	EG: [{ name: 'Cairo', majorCities: ['Cairo', 'Giza'] }],
	AE: [{ name: 'Dubai', majorCities: ['Dubai', 'Abu Dhabi'] }]
};

const CATEGORIES = [
	{
		name: 'Technology',
		slug: 'technology',
		icon: 'Cpu',
		description: 'Gadget reviews, apps, AI and digital innovation across the continent.'
	},
	{
		name: 'Beauty & Fashion',
		slug: 'beauty-fashion',
		icon: 'Sparkles',
		description: 'Skincare routines, habesha kemis styling, streetwear and modelling.'
	},
	{
		name: 'Business & Entrepreneurship',
		slug: 'business',
		icon: 'Briefcase',
		description: 'Founder stories, SME growth and the local startup scene.'
	},
	{
		name: 'Entertainment & Comedy',
		slug: 'entertainment',
		icon: 'Drama',
		description: 'Skits, music, film and the viral culture engine.'
	},
	{
		name: 'Education & Tech',
		slug: 'education',
		icon: 'GraduationCap',
		description: 'Digital skills, exam prep, online safety and edtech.'
	},
	{
		name: 'Food & Dining',
		slug: 'food-dining',
		icon: 'UtensilsCrossed',
		description: 'Coffee culture, injera, restaurant reviews and home cooking.'
	},
	{
		name: 'Travel & Tourism',
		slug: 'travel-tourism',
		icon: 'Plane',
		description: 'Lodges, safaris, heritage routes and city guides.'
	},
	{
		name: 'Sports & Fitness',
		slug: 'sports-fitness',
		icon: 'Dumbbell',
		description: 'Running, football, gym culture and athlete stories.'
	},
	{
		name: 'Lifestyle',
		slug: 'lifestyle',
		icon: 'Heart',
		description: 'Day-in-the-life, home, family and everyday culture.'
	},
	{
		name: 'Finance & Money',
		slug: 'finance',
		icon: 'Landmark',
		description: 'Mobile money, saving, investing and personal finance.'
	},
	{
		name: 'Agriculture & Agribusiness',
		slug: 'agriculture',
		icon: 'Sprout',
		description: 'Coffee farming, agritech and rural enterprise.'
	},
	{
		name: 'Health & Wellness',
		slug: 'health-wellness',
		icon: 'Stethoscope',
		description: 'Nutrition, mental health, clinics and medical literacy.'
	}
];

const PLATFORMS = [
	{ name: 'TikTok', color: '#0f172a' },
	{ name: 'Instagram', color: '#e1306c' },
	{ name: 'YouTube', color: '#ef4444' },
	{ name: 'Facebook', color: '#2563eb' },
	{ name: 'Telegram', color: '#0ea5e9' },
	{ name: 'X', color: '#334155' },
	{ name: 'LinkedIn', color: '#0a66c2' }
];

const LANGUAGES = [
	{ name: 'Amharic', code: 'am' },
	{ name: 'English', code: 'en' },
	{ name: 'Afaan Oromo', code: 'om' },
	{ name: 'Tigrinya', code: 'ti' },
	{ name: 'Somali', code: 'so' },
	{ name: 'Swahili', code: 'sw' },
	{ name: 'Yoruba', code: 'yo' },
	{ name: 'Pidgin', code: 'pcm' },
	{ name: 'French', code: 'fr' },
	{ name: 'Arabic', code: 'ar' },
	{ name: 'Kinyarwanda', code: 'rw' },
	{ name: 'Zulu', code: 'zu' }
];

/* ------------------------------------------------------------------ *
 * Creator supply
 * ------------------------------------------------------------------ */

type SeedCreator = {
	username: string;
	fullName: string;
	bio: string;
	country: string;
	region: string;
	city: string;
	categories: string[];
	languages: string[];
	primaryPlatform: string;
	totalReach: number;
	startingPrice: number;
	currencyCode: string;
	verificationLevel: 'unverified' | 'social_verified' | 'identity_verified' | 'cn_verified';
	availability: 'available' | 'busy' | 'away';
	featured: boolean;
	trending: boolean;
	overseas: number;
	topCountries: string[];
	rating: number;
	reviews: number;
	completed: number;
	avatar: string;
	cover: string;
	socials: {
		platform: string;
		handle: string;
		followers: number;
		engagement: number;
		verified: boolean;
	}[];
	packages: {
		title: string;
		platform: string;
		deliverables: string[];
		price: number;
		days: number;
		description: string;
	}[];
	portfolio: { url: string; caption: string; platform: string; views: number; likes: number }[];
};

const img = (id: string, w = 800) =>
	`https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&w=${w}`;

/**
 * Opening slides for the homepage gallery. Admins edit these in the dashboard.
 * The artwork ships with the app under `static/gallery/`, so these are
 * root-relative paths rather than uploads: `assetUrl` passes them straight
 * through.
 */
const GALLERY_SLIDES = [
	{
		title: 'Africa’s creators, one marketplace',
		subtitle:
			'Verified reach, published rate cards and agreements that hold — from Addis to Lagos.',
		image: '/gallery/marketplace.webp',
		linkUrl: '/discover',
		linkLabel: 'Browse creators'
	},
	{
		title: 'Brief once, hear from the right creators',
		subtitle: 'Post a campaign and let matching handle the shortlist instead of your inbox.',
		image: '/gallery/briefs.webp',
		linkUrl: '/campaigns',
		linkLabel: 'See live briefs'
	},
	{
		title: 'Get paid for the work you already do',
		subtitle: 'Set your prices, show your numbers and take bookings without the back and forth.',
		image: '/gallery/earnings.webp',
		linkUrl: '/register',
		linkLabel: 'Join as a creator'
	}
];

/* ------------------------------------------------------------------ *
 * The blog
 *
 * Bodies are written as the sanitiser will store them — plain allowlisted
 * markup, no classes — so that seeded articles and authored ones render
 * through exactly the same rules. `searchText` and `readingMinutes` are
 * derived at seed time by the same functions the save action uses, so a
 * seeded post is searchable the moment it lands.
 * ------------------------------------------------------------------ */

const BLOG_SECTIONS = [
	{
		name: 'Creator economy',
		slug: 'creator-economy',
		description: 'How money actually moves between brands and the people making the work.',
		accent: 'mint'
	},
	{
		name: 'Working with brands',
		slug: 'working-with-brands',
		description: 'Briefs, rates and the paperwork that keeps a booking from going wrong.',
		accent: 'yellow'
	},
	{
		name: 'Platform notes',
		slug: 'platform-notes',
		description: 'What changed on Creator Network, and why it changed.',
		accent: 'indigo'
	}
];

type SeedPost = {
	title: string;
	section: string;
	excerpt: string;
	body: string;
	tags: string[];
	author: string;
	/** Days before today. The newest post is 0. */
	daysAgo: number;
	featured?: boolean;
};

const BLOG_POSTS: SeedPost[] = [
	{
		title: 'Reach is the number you can buy. Trust is the one that sells.',
		section: 'creator-economy',
		excerpt:
			'A creator with nine thousand followers in one neighbourhood of Addis will move more product than a national page with a hundred times the audience. Here is why, and what it means for a media plan.',
		body: `<p>Every brief that crosses this platform opens with a follower count, and almost none of them should. Reach is the cheapest number in the business to acquire and the least predictive of whether anyone buys anything.</p>
<h2>What a small account actually has</h2>
<p>An account with nine thousand followers in Bole is not a small version of an account with nine hundred thousand. It is a different object. The audience overlaps with itself — people who know each other, shop in the same places, and read a recommendation as a recommendation rather than an advertisement.</p>
<ul><li>Replies arrive from names the creator recognises.</li><li>A comment thread reads like a conversation, not a feed.</li><li>A recommendation carries the cost of being wrong in front of people you will see again.</li></ul>
<p>That last one is the whole mechanism. Trust is expensive to hold and cheap to lose, which is exactly why it converts.</p>
<h2>What this changes about a brief</h2>
<p>Three things, in order of how much money they save:</p>
<ol><li><strong>Stop setting a follower floor.</strong> It filters out the accounts that would have worked and lets in the ones that will not.</li><li><strong>Brief the audience, not the number.</strong> "People who cook at home in Addis" is a filter. "Fifty thousand followers" is a shrug.</li><li><strong>Pay for the recommendation, not the impression.</strong> A creator who has to disclaim your product to keep their audience has sold you nothing.</li></ol>
<blockquote>The question is never how many people will see it. It is how many of them will believe it.</blockquote>
<p>None of this argues against scale. It argues against buying scale first and hoping credibility follows, which is the order most plans are still written in.</p>`,
		tags: ['micro-creators', 'brand strategy', 'measurement'],
		author: 'Creator Network',
		daysAgo: 3,
		featured: true
	},
	{
		title: 'Write a brief a creator can say yes to',
		section: 'working-with-brands',
		excerpt:
			'Most briefs are rejected for the same four reasons, and all four are fixable before anyone reads it. A checklist for the version you send out.',
		body: `<p>Briefs get ignored far more often than they get declined, and the reasons repeat. Here is the short version of what makes a creator answer.</p>
<h2>Say what it pays</h2>
<p>A brief with no number is a request for free labour until proven otherwise. If the budget is a range, publish the range. If it is barter, say what the goods are and what they are worth.</p>
<h2>Say what you actually need made</h2>
<p>"Some content" is not a deliverable. Three of these are:</p>
<ul><li>One 60-second video, shot vertically, delivered as a file.</li><li>Two in-feed photographs with the product visible in both.</li><li>Usage on your own channels for ninety days.</li></ul>
<h2>Say when</h2>
<p>A deadline is not a constraint you are imposing on the creator. It is the information that lets them tell you whether they are free.</p>
<h2>Say who decides</h2>
<p>Nothing kills a booking faster than a fourth round of revisions from someone who was not in the original conversation. Name the approver in the brief and hold to it.</p>
<p>A brief with those four in it gets read to the end. One without them is a guess the creator has to price defensively, which is how a job that should cost you thirty thousand birr ends up quoted at eighty.</p>`,
		tags: ['briefs', 'brand strategy', 'rates'],
		author: 'Creator Network',
		daysAgo: 12
	},
	{
		title: 'Terms are frozen when both sides agree',
		section: 'platform-notes',
		excerpt:
			'A booking on Creator Network records what was agreed at the moment it was agreed, and nothing later can quietly rewrite it. What that means in practice.',
		body: `<p>The most common dispute in creator work is not about money. It is about what was agreed, and it happens because the agreement lived in a chat thread that both sides remember differently.</p>
<h2>What gets recorded</h2>
<p>When a brand and a creator accept terms, the booking takes a copy: the price, the deliverables, the deadline, the number of revisions, and the currency. That copy does not change when a rate card changes, when a package is edited, or when a profile is updated.</p>
<blockquote>A price list is a current statement of intent. A booking is a record of what was true when two people shook hands.</blockquote>
<h2>What this rules out</h2>
<ul><li>A rate that rises between agreement and delivery.</li><li>A deliverable list that grows after work has started.</li><li>A revision allowance that turns out to have been unlimited all along.</li></ul>
<p>Changing any of it takes a counter-proposal that the other side accepts, which is recorded in turn. The history is the point: every state a booking passed through is kept, so "what did we agree" has one answer rather than two.</p>`,
		tags: ['bookings', 'platform'],
		author: 'Creator Network',
		daysAgo: 24
	},
	{
		title: 'How to price your first paid collaboration',
		section: 'creator-economy',
		excerpt:
			'The first number you name sets every number after it. A method for arriving at one you can defend, without either underselling the work or pricing yourself out of it.',
		body: `<p>Naming a price is the hardest part of turning an audience into an income, and the usual advice — "charge what you are worth" — is useless, because nobody knows what that is on the first try.</p>
<h2>Start from the work, not the audience</h2>
<p>Count the hours the job actually takes: the planning, the shoot, the edit, the revisions, and the hour you will spend answering messages about it afterwards. Multiply by a rate you would accept for any other skilled work.</p>
<p>That is the floor. It has nothing to do with your following, and it is the number below which the job costs you money.</p>
<h2>Then add what the brand is buying</h2>
<p>Three things raise it, and each is worth naming separately on your rate card:</p>
<ul><li><strong>Exclusivity.</strong> Not working with a competitor for a period has a cost.</li><li><strong>Usage.</strong> A brand running your video as an advertisement is buying something quite different from a post on your own feed.</li><li><strong>Speed.</strong> A deadline inside a week is a premium, not a favour.</li></ul>
<h2>Publish it</h2>
<p>A published rate card ends the negotiation before it starts, and it protects you from the version of the conversation where you are asked to guess first. If a brand cannot meet it, they will say so, and that is a faster no than the alternative.</p>`,
		tags: ['rates', 'getting started'],
		author: 'Creator Network',
		daysAgo: 40
	}
];

const CREATORS: SeedCreator[] = [
	{
		username: 'joel_tech_ethiopia',
		fullName: 'Joel Talargie',
		bio: 'Founder & tech content creator with 650K+ followers across TikTok and YouTube. Reviewing East African tech products, AI tools and digital finance.',
		country: 'ET',
		region: 'Addis Ababa',
		city: 'Bole',
		categories: ['technology', 'business', 'finance'],
		languages: ['Amharic', 'English'],
		primaryPlatform: 'TikTok',
		totalReach: 650000,
		startingPrice: 15000,
		currencyCode: 'ETB',
		verificationLevel: 'cn_verified',
		availability: 'available',
		featured: true,
		trending: true,
		overseas: 32,
		topCountries: ['Ethiopia', 'United States', 'United Arab Emirates', 'Kenya'],
		rating: 4.9,
		reviews: 18,
		completed: 24,
		avatar: img('1534528741775-53994a69daeb', 400),
		cover: img('1518770660439-4636190af475', 1200),
		socials: [
			{
				platform: 'TikTok',
				handle: '@joel_tech_et',
				followers: 420000,
				engagement: 6.8,
				verified: true
			},
			{
				platform: 'YouTube',
				handle: 'Joel Tech ET',
				followers: 150000,
				engagement: 8.2,
				verified: true
			},
			{
				platform: 'Telegram',
				handle: '@joeltechchannel',
				followers: 80000,
				engagement: 12.4,
				verified: true
			}
		],
		packages: [
			{
				title: 'TikTok Tech Review & Demo',
				platform: 'TikTok',
				deliverables: [
					'1 x 60s dedicated TikTok video',
					'Link in bio for 7 days',
					'Raw video file'
				],
				price: 20000,
				days: 3,
				description: 'Product walkthrough with Amharic subtitles and a clear call to action.'
			},
			{
				title: 'Telegram Channel Broadcast',
				platform: 'Telegram',
				deliverables: [
					'1 x sponsored post with media',
					'Pinned for 24 hours',
					'Trackable referral link'
				],
				price: 12000,
				days: 1,
				description: 'Direct reach to 80,000+ tech-minded Ethiopian professionals.'
			},
			{
				title: 'Full Launch Campaign',
				platform: 'YouTube',
				deliverables: [
					'1 x YouTube video (8–10 min)',
					'1 x TikTok short',
					'1 x Telegram post',
					'6 months usage rights'
				],
				price: 65000,
				days: 7,
				description: 'Complete multi-platform product launch coverage.'
			}
		],
		portfolio: [
			{
				url: img('1526374965328-7f61d4dc18c5'),
				caption: 'Telebirr SuperApp feature walkthrough',
				platform: 'TikTok',
				views: 320000,
				likes: 28400
			},
			{
				url: img('1531482615713-2afd69097998'),
				caption: 'Chapa API integration demo for developers',
				platform: 'YouTube',
				views: 95000,
				likes: 8100
			}
		]
	},
	{
		username: 'wangari_tech_ke',
		fullName: 'Wangari Maina',
		bio: 'Nairobi-based tech founder and gadget reviewer covering AI in Africa, mobile banking and consumer tech across East Africa.',
		country: 'KE',
		region: 'Nairobi',
		city: 'Westlands',
		categories: ['technology', 'business', 'finance'],
		languages: ['English', 'Swahili'],
		primaryPlatform: 'YouTube',
		totalReach: 480000,
		startingPrice: 18000,
		currencyCode: 'KES',
		verificationLevel: 'cn_verified',
		availability: 'available',
		featured: true,
		trending: true,
		overseas: 45,
		topCountries: ['Kenya', 'Uganda', 'Ethiopia', 'United Kingdom', 'United States'],
		rating: 4.9,
		reviews: 15,
		completed: 19,
		avatar: img('1573497019940-1c28c88b4f3e', 400),
		cover: img('1526778548025-fa2f459cd5c1', 1200),
		socials: [
			{
				platform: 'YouTube',
				handle: 'Wangari Tech Africa',
				followers: 260000,
				engagement: 7.4,
				verified: true
			},
			{
				platform: 'TikTok',
				handle: '@wangari_tech',
				followers: 160000,
				engagement: 9.1,
				verified: true
			},
			{
				platform: 'LinkedIn',
				handle: 'Wangari Maina',
				followers: 60000,
				engagement: 11.2,
				verified: true
			}
		],
		packages: [
			{
				title: 'Dedicated Tech Breakdown',
				platform: 'YouTube',
				deliverables: ['1 x 8-minute feature video', 'Shorts cut-down', 'Community post'],
				price: 38000,
				days: 5,
				description: 'In-depth evaluation reaching tech enthusiasts across East Africa.'
			},
			{
				title: 'Viral TikTok & Reel Bundle',
				platform: 'TikTok',
				deliverables: ['1 x TikTok video (60s)', '1 x Instagram cross-post', 'Trackable bio link'],
				price: 22000,
				days: 3,
				description: 'Fast, hook-driven consumer product test.'
			}
		],
		portfolio: [
			{
				url: img('1550751827-4bd374c3f58b'),
				caption: 'The rise of East African superapps',
				platform: 'YouTube',
				views: 240000,
				likes: 21500
			}
		]
	},
	{
		username: 'chioma_lagos_vibe',
		fullName: 'Chioma Adeleke',
		bio: 'Lagos lifestyle, Afrobeats culture and fintech creator connecting West African entertainment with digital brand activations.',
		country: 'NG',
		region: 'Lagos',
		city: 'Victoria Island',
		categories: ['entertainment', 'beauty-fashion', 'lifestyle'],
		languages: ['English', 'Yoruba', 'Pidgin'],
		primaryPlatform: 'Instagram',
		totalReach: 890000,
		startingPrice: 28000,
		currencyCode: 'NGN',
		verificationLevel: 'cn_verified',
		availability: 'available',
		featured: true,
		trending: true,
		overseas: 52,
		topCountries: ['Nigeria', 'Ghana', 'United Kingdom', 'United States', 'South Africa'],
		rating: 4.8,
		reviews: 22,
		completed: 31,
		avatar: img('1531746020798-e6953c6e8e04', 400),
		cover: img('1516450360452-9312f5e86fc7', 1200),
		socials: [
			{
				platform: 'Instagram',
				handle: '@chioma_vibe_ng',
				followers: 520000,
				engagement: 6.2,
				verified: true
			},
			{
				platform: 'TikTok',
				handle: '@chioma_adeleke',
				followers: 370000,
				engagement: 8.9,
				verified: true
			}
		],
		packages: [
			{
				title: 'Instagram Reel + Story Set',
				platform: 'Instagram',
				deliverables: ['1 x Reel (30–45s)', '3 x Story frames with link', 'Usage rights 3 months'],
				price: 42000,
				days: 4,
				description: 'High-production lifestyle integration for Lagos audiences.'
			}
		],
		portfolio: [
			{
				url: img('1492684223066-81342ee5ff30'),
				caption: 'Detty December brand takeover',
				platform: 'Instagram',
				views: 410000,
				likes: 52000
			}
		]
	},
	{
		username: 'bete_beauty_addis',
		fullName: 'Bethlehem Tadesse',
		bio: 'Beauty and skincare creator in Addis. Habesha kemis styling, honest cosmetics reviews and everyday glam for Ethiopian women.',
		country: 'ET',
		region: 'Addis Ababa',
		city: 'Kazanchis',
		categories: ['beauty-fashion', 'lifestyle'],
		languages: ['Amharic', 'English'],
		primaryPlatform: 'Instagram',
		totalReach: 310000,
		startingPrice: 12000,
		currencyCode: 'ETB',
		verificationLevel: 'identity_verified',
		availability: 'available',
		featured: true,
		trending: true,
		overseas: 18,
		topCountries: ['Ethiopia', 'United States', 'Israel'],
		rating: 4.8,
		reviews: 12,
		completed: 15,
		avatar: img('1487412720507-e7ab37603c6f', 400),
		cover: img('1522335789203-aabd1fc54bc9', 1200),
		socials: [
			{
				platform: 'Instagram',
				handle: '@bete_beauty',
				followers: 210000,
				engagement: 7.1,
				verified: true
			},
			{
				platform: 'TikTok',
				handle: '@bete_glam',
				followers: 100000,
				engagement: 9.6,
				verified: false
			}
		],
		packages: [
			{
				title: 'Skincare Routine Feature',
				platform: 'Instagram',
				deliverables: ['1 x Reel routine', '2 x Story frames', 'Photo set for brand reuse'],
				price: 15000,
				days: 4,
				description: 'Authentic before-and-after routine filmed over one week.'
			},
			{
				title: 'TikTok Get-Ready-With-Me',
				platform: 'TikTok',
				deliverables: ['1 x GRWM video', 'Pinned comment with offer code'],
				price: 9000,
				days: 2,
				description: 'Native, conversational product placement.'
			}
		],
		portfolio: [
			{
				url: img('1596462502278-27bfdc403348'),
				caption: 'Habesha kemis styling for Meskel',
				platform: 'Instagram',
				views: 180000,
				likes: 24000
			}
		]
	},
	{
		username: 'thabo_jozi',
		fullName: 'Thabo Mokoena',
		bio: 'Johannesburg tech and business storyteller. Startup profiles, fintech explainers and township entrepreneurship.',
		country: 'ZA',
		region: 'Gauteng',
		city: 'Johannesburg',
		categories: ['business', 'technology', 'finance'],
		languages: ['English', 'Zulu'],
		primaryPlatform: 'LinkedIn',
		totalReach: 265000,
		startingPrice: 9000,
		currencyCode: 'ZAR',
		verificationLevel: 'cn_verified',
		availability: 'busy',
		featured: false,
		trending: true,
		overseas: 28,
		topCountries: ['South Africa', 'Nigeria', 'United Kingdom'],
		rating: 4.7,
		reviews: 9,
		completed: 11,
		avatar: img('1519085360753-af0119f7cbe7', 400),
		cover: img('1577086664693-894d8405334a', 1200),
		socials: [
			{
				platform: 'LinkedIn',
				handle: 'Thabo Mokoena',
				followers: 145000,
				engagement: 9.8,
				verified: true
			},
			{
				platform: 'YouTube',
				handle: 'Thabo Builds',
				followers: 120000,
				engagement: 6.4,
				verified: true
			}
		],
		packages: [
			{
				title: 'Founder Story Feature',
				platform: 'LinkedIn',
				deliverables: ['1 x long-form post', '1 x carousel', 'Newsletter mention'],
				price: 14000,
				days: 5,
				description: 'Narrative business feature for a B2B audience.'
			}
		],
		portfolio: [
			{
				url: img('1600880292203-757bb62b4baf'),
				caption: 'Inside a Soweto fintech startup',
				platform: 'YouTube',
				views: 88000,
				likes: 6400
			}
		]
	},
	{
		username: 'kwame_accra_eats',
		fullName: 'Kwame Mensah',
		bio: 'Accra food and travel creator. Street food routes, chop bar reviews and coastal getaways across Ghana.',
		country: 'GH',
		region: 'Greater Accra',
		city: 'Accra',
		categories: ['food-dining', 'travel-tourism'],
		languages: ['English'],
		primaryPlatform: 'TikTok',
		totalReach: 198000,
		startingPrice: 4500,
		currencyCode: 'GHS',
		verificationLevel: 'social_verified',
		availability: 'available',
		featured: false,
		trending: false,
		overseas: 35,
		topCountries: ['Ghana', 'United Kingdom', 'United States'],
		rating: 4.6,
		reviews: 7,
		completed: 8,
		avatar: img('1500648767791-00dcc994a43e', 400),
		cover: img('1414235077428-338989a2e8c0', 1200),
		socials: [
			{
				platform: 'TikTok',
				handle: '@kwame_eats',
				followers: 140000,
				engagement: 10.2,
				verified: false
			},
			{
				platform: 'Instagram',
				handle: '@kwame_accra',
				followers: 58000,
				engagement: 5.4,
				verified: false
			}
		],
		packages: [
			{
				title: 'Restaurant Feature Visit',
				platform: 'TikTok',
				deliverables: ['1 x visit video', '3 x Story frames', 'Google review'],
				price: 6000,
				days: 3,
				description: 'On-location tasting with an honest verdict.'
			}
		],
		portfolio: [
			{
				url: img('1504674900247-0877df9cc836'),
				caption: 'Accra street food in one day',
				platform: 'TikTok',
				views: 220000,
				likes: 31000
			}
		]
	},
	{
		username: 'diane_kigali',
		fullName: 'Diane Uwase',
		bio: 'Kigali conservation and travel storyteller. Gorilla trekking, eco-lodges and Rwanda’s clean-tech story.',
		country: 'RW',
		region: 'Kigali',
		city: 'Kigali',
		categories: ['travel-tourism', 'lifestyle'],
		languages: ['English', 'Kinyarwanda', 'French'],
		primaryPlatform: 'Instagram',
		totalReach: 142000,
		startingPrice: 850000,
		currencyCode: 'RWF',
		verificationLevel: 'identity_verified',
		availability: 'available',
		featured: false,
		trending: false,
		overseas: 61,
		topCountries: ['Rwanda', 'United States', 'Germany', 'United Kingdom'],
		rating: 4.9,
		reviews: 6,
		completed: 7,
		avatar: img('1544005313-94ddf0286df2', 400),
		cover: img('1516426122078-c23e76319801', 1200),
		socials: [
			{
				platform: 'Instagram',
				handle: '@diane_explores',
				followers: 96000,
				engagement: 8.4,
				verified: true
			},
			{
				platform: 'YouTube',
				handle: 'Diane Explores',
				followers: 46000,
				engagement: 7.0,
				verified: false
			}
		],
		packages: [
			{
				title: 'Eco-Lodge Stay Feature',
				platform: 'Instagram',
				deliverables: ['1 x Reel', '6 x Story frames', 'Photo library (20 images)'],
				price: 1200000,
				days: 7,
				description: 'Two-night stay documented end to end.'
			}
		],
		portfolio: [
			{
				url: img('1547471080-7cc2caa01a7e'),
				caption: 'Volcanoes National Park at sunrise',
				platform: 'Instagram',
				views: 130000,
				likes: 18000
			}
		]
	},
	{
		username: 'samira_london_habesha',
		fullName: 'Samira Ahmed',
		bio: 'London-based Ethiopian diaspora creator. Culture, food and the habesha experience abroad.',
		country: 'GB',
		region: 'Greater London',
		city: 'London',
		categories: ['lifestyle', 'food-dining', 'entertainment'],
		languages: ['English', 'Amharic'],
		primaryPlatform: 'TikTok',
		totalReach: 224000,
		startingPrice: 900,
		currencyCode: 'GBP',
		verificationLevel: 'cn_verified',
		availability: 'available',
		featured: true,
		trending: false,
		overseas: 74,
		topCountries: ['United Kingdom', 'United States', 'Ethiopia', 'Canada'],
		rating: 4.8,
		reviews: 11,
		completed: 14,
		avatar: img('1524504388940-b1c1722653e1', 400),
		cover: img('1513635269975-59663e0ac1ad', 1200),
		socials: [
			{
				platform: 'TikTok',
				handle: '@samira_habesha',
				followers: 168000,
				engagement: 9.4,
				verified: true
			},
			{
				platform: 'Instagram',
				handle: '@samira.a',
				followers: 56000,
				engagement: 5.8,
				verified: true
			}
		],
		packages: [
			{
				title: 'Diaspora Brand Feature',
				platform: 'TikTok',
				deliverables: ['1 x TikTok video', '1 x Instagram Reel cross-post'],
				price: 1400,
				days: 4,
				description: 'Reaches East African diaspora audiences in the UK and US.'
			}
		],
		portfolio: [
			{
				url: img('1466978913421-dad2ebd01d17'),
				caption: 'Best Ethiopian coffee in London',
				platform: 'TikTok',
				views: 290000,
				likes: 42000
			}
		]
	},
	{
		username: 'abel_addis_finance',
		fullName: 'Abel Kassahun',
		bio: 'Personal finance educator in Amharic. Saving, mobile money, and how to avoid the scams targeting young Ethiopians.',
		country: 'ET',
		region: 'Addis Ababa',
		city: 'Megenagna',
		categories: ['finance', 'education', 'business'],
		languages: ['Amharic', 'English'],
		primaryPlatform: 'Telegram',
		totalReach: 268000,
		startingPrice: 11000,
		currencyCode: 'ETB',
		verificationLevel: 'cn_verified',
		availability: 'available',
		featured: true,
		trending: true,
		overseas: 21,
		topCountries: ['Ethiopia', 'United Arab Emirates', 'Saudi Arabia'],
		rating: 4.9,
		reviews: 14,
		completed: 20,
		avatar: img('1506794778202-cad84cf45f1d', 400),
		cover: img('1554224155-6726b3ff858f', 1200),
		socials: [
			{
				platform: 'Telegram',
				handle: '@abel_finance',
				followers: 155000,
				engagement: 14.2,
				verified: true
			},
			{
				platform: 'YouTube',
				handle: 'Abel Finance Amharic',
				followers: 78000,
				engagement: 6.9,
				verified: true
			},
			{
				platform: 'TikTok',
				handle: '@abel_birr',
				followers: 35000,
				engagement: 8.1,
				verified: false
			}
		],
		packages: [
			{
				title: 'Telegram Explainer Series',
				platform: 'Telegram',
				deliverables: ['3 x posts over one week', 'Pinned summary', 'Trackable link'],
				price: 18000,
				days: 7,
				description: 'Educational sequence that converts rather than shouts.'
			},
			{
				title: 'YouTube Deep Dive',
				platform: 'YouTube',
				deliverables: ['1 x 12-minute Amharic explainer', 'Pinned comment', 'Community post'],
				price: 32000,
				days: 6,
				description: 'Long-form trust building for financial products.'
			}
		],
		portfolio: [
			{
				url: img('1579621970563-ebec7560ff3e'),
				caption: 'How Telebirr fees actually work',
				platform: 'YouTube',
				views: 142000,
				likes: 11800
			}
		]
	},
	{
		username: 'eden_worku_travel',
		fullName: 'Eden Worku',
		bio: 'Ethiopian travel creator covering the historic route, Danakil, Simien treks and the lodges worth the drive.',
		country: 'ET',
		region: 'Amhara',
		city: 'Bahir Dar',
		categories: ['travel-tourism', 'lifestyle', 'food-dining'],
		languages: ['Amharic', 'English'],
		primaryPlatform: 'YouTube',
		totalReach: 176000,
		startingPrice: 14000,
		currencyCode: 'ETB',
		verificationLevel: 'identity_verified',
		availability: 'available',
		featured: false,
		trending: true,
		overseas: 44,
		topCountries: ['Ethiopia', 'United States', 'Germany', 'United Kingdom'],
		rating: 4.7,
		reviews: 8,
		completed: 10,
		avatar: img('1508214751196-bcfd4ca60f91', 400),
		cover: img('1523805009345-7448845a9e53', 1200),
		socials: [
			{
				platform: 'YouTube',
				handle: 'Eden Travels ET',
				followers: 104000,
				engagement: 7.8,
				verified: true
			},
			{
				platform: 'Instagram',
				handle: '@eden.wanders',
				followers: 72000,
				engagement: 6.1,
				verified: false
			}
		],
		packages: [
			{
				title: 'Lodge & Destination Film',
				platform: 'YouTube',
				deliverables: [
					'1 x 6-minute destination film',
					'1 x Instagram Reel',
					'Photo set (15 images)'
				],
				price: 45000,
				days: 10,
				description: 'Two-night stay, filmed and colour graded.'
			}
		],
		portfolio: [
			{
				url: img('1523592121529-f6dde35f079e'),
				caption: 'Lalibela at dawn',
				platform: 'YouTube',
				views: 96000,
				likes: 9200
			}
		]
	},
	{
		username: 'dawit_food_addict',
		fullName: 'Dawit Alemu',
		bio: 'Addis food creator. Buna ceremonies, hidden kitfo spots and the honest verdict on every new restaurant in Bole.',
		country: 'ET',
		region: 'Addis Ababa',
		city: 'Bole',
		categories: ['food-dining', 'lifestyle', 'entertainment'],
		languages: ['Amharic', 'English'],
		primaryPlatform: 'TikTok',
		totalReach: 412000,
		startingPrice: 13000,
		currencyCode: 'ETB',
		verificationLevel: 'cn_verified',
		availability: 'available',
		featured: true,
		trending: true,
		overseas: 26,
		topCountries: ['Ethiopia', 'United States', 'United Arab Emirates'],
		rating: 4.9,
		reviews: 19,
		completed: 27,
		avatar: img('1492562080023-ab3db95bfbce', 400),
		cover: img('1555396273-367ea4eb4db5', 1200),
		socials: [
			{
				platform: 'TikTok',
				handle: '@dawit_food',
				followers: 305000,
				engagement: 11.4,
				verified: true
			},
			{
				platform: 'Instagram',
				handle: '@dawit.eats',
				followers: 107000,
				engagement: 6.7,
				verified: true
			}
		],
		packages: [
			{
				title: 'Restaurant Launch Visit',
				platform: 'TikTok',
				deliverables: ['1 x tasting video', '4 x Story frames', 'Pinned comment'],
				price: 16000,
				days: 3,
				description: 'The visit that fills tables the same weekend.'
			},
			{
				title: 'Coffee Brand Feature',
				platform: 'Instagram',
				deliverables: ['1 x Reel', '1 x carousel', 'Photo set'],
				price: 11000,
				days: 4,
				description: 'Buna-first storytelling for coffee brands.'
			}
		],
		portfolio: [
			{
				url: img('1447933601403-0c6688de566e'),
				caption: 'Every kitfo spot in Addis, ranked',
				platform: 'TikTok',
				views: 520000,
				likes: 61000
			}
		]
	},
	{
		username: 'selam_comedy_et',
		fullName: 'Selamawit Bekele',
		bio: 'Sketch comedy about Addis life — taxis, weddings, landlords and the group chat. Brand integrations that people actually rewatch.',
		country: 'ET',
		region: 'Addis Ababa',
		city: 'Piassa',
		categories: ['entertainment', 'lifestyle'],
		languages: ['Amharic'],
		primaryPlatform: 'TikTok',
		totalReach: 585000,
		startingPrice: 17000,
		currencyCode: 'ETB',
		verificationLevel: 'social_verified',
		availability: 'busy',
		featured: false,
		trending: true,
		overseas: 24,
		topCountries: ['Ethiopia', 'United States', 'Israel'],
		rating: 4.6,
		reviews: 10,
		completed: 13,
		avatar: img('1534528741702-a0cfae58b707', 400),
		cover: img('1543007630-9710e4a00a20', 1200),
		socials: [
			{
				platform: 'TikTok',
				handle: '@selam_comedy',
				followers: 430000,
				engagement: 12.8,
				verified: false
			},
			{
				platform: 'Facebook',
				handle: 'Selam Comedy',
				followers: 155000,
				engagement: 4.9,
				verified: true
			}
		],
		packages: [
			{
				title: 'Branded Sketch',
				platform: 'TikTok',
				deliverables: [
					'1 x 60–90s sketch',
					'Brand integrated into the story',
					'Cross-post to Facebook'
				],
				price: 24000,
				days: 6,
				description: 'Written around the product, not bolted onto it.'
			}
		],
		portfolio: [
			{
				url: img('1509281373149-e957c6296406'),
				caption: 'When the taxi says "kabede"',
				platform: 'TikTok',
				views: 890000,
				likes: 132000
			}
		]
	},
	{
		username: 'yohannes_agri_et',
		fullName: 'Yohannes Girma',
		bio: 'Agribusiness creator from Jimma. Coffee farming, agritech tools and the economics of smallholder farms.',
		country: 'ET',
		region: 'Oromia',
		city: 'Jimma',
		categories: ['agriculture', 'business', 'education'],
		languages: ['Amharic', 'Afaan Oromo', 'English'],
		primaryPlatform: 'YouTube',
		totalReach: 128000,
		startingPrice: 9500,
		currencyCode: 'ETB',
		verificationLevel: 'identity_verified',
		availability: 'available',
		featured: false,
		trending: false,
		overseas: 12,
		topCountries: ['Ethiopia', 'Kenya', 'United States'],
		rating: 4.8,
		reviews: 5,
		completed: 6,
		avatar: img('1472099645785-5658abf4ff4e', 400),
		cover: img('1500382017468-9049fed747ef', 1200),
		socials: [
			{
				platform: 'YouTube',
				handle: 'Yohannes Agri',
				followers: 86000,
				engagement: 8.6,
				verified: true
			},
			{
				platform: 'Telegram',
				handle: '@agri_ethiopia',
				followers: 42000,
				engagement: 13.1,
				verified: false
			}
		],
		packages: [
			{
				title: 'Field Demonstration Video',
				platform: 'YouTube',
				deliverables: ['1 x on-farm demo (8 min)', 'Telegram summary post'],
				price: 14000,
				days: 8,
				description: 'Product shown working on a real smallholder farm.'
			}
		],
		portfolio: [
			{
				url: img('1447752875215-b2761acb3c5d'),
				caption: 'Coffee harvest economics, explained',
				platform: 'YouTube',
				views: 74000,
				likes: 5900
			}
		]
	},
	{
		username: 'meron_fitness_et',
		fullName: 'Meron Haile',
		bio: 'Addis fitness coach. Home workouts without equipment, running clubs and nutrition that works on an Ethiopian diet.',
		country: 'ET',
		region: 'Addis Ababa',
		city: 'CMC',
		categories: ['sports-fitness', 'health-wellness', 'lifestyle'],
		languages: ['Amharic', 'English'],
		primaryPlatform: 'Instagram',
		totalReach: 156000,
		startingPrice: 8000,
		currencyCode: 'ETB',
		verificationLevel: 'social_verified',
		availability: 'available',
		featured: false,
		trending: false,
		overseas: 19,
		topCountries: ['Ethiopia', 'United States', 'United Arab Emirates'],
		rating: 4.7,
		reviews: 6,
		completed: 9,
		avatar: img('1517841905240-472988babdf9', 400),
		cover: img('1571019613454-1cb2f99b2d8b', 1200),
		socials: [
			{
				platform: 'Instagram',
				handle: '@meron_moves',
				followers: 98000,
				engagement: 7.9,
				verified: false
			},
			{
				platform: 'TikTok',
				handle: '@meron_fit',
				followers: 58000,
				engagement: 10.4,
				verified: false
			}
		],
		packages: [
			{
				title: 'Product Integration Workout',
				platform: 'Instagram',
				deliverables: ['1 x Reel workout', '3 x Story frames', 'Discount code'],
				price: 10000,
				days: 3,
				description: 'Supplement, apparel and equipment integrations.'
			}
		],
		portfolio: [
			{
				url: img('1518611012118-696072aa579a'),
				caption: '20-minute home workout, no equipment',
				platform: 'Instagram',
				views: 118000,
				likes: 14200
			}
		]
	}
];

/* ------------------------------------------------------------------ *
 * Organisations and campaigns
 * ------------------------------------------------------------------ */

const ORGANISATIONS = [
	{
		slug: 'ethio-telecom',
		name: 'Ethio Telecom',
		orgType: 'company' as const,
		country: 'ET',
		city: 'Addis Ababa',
		logo: img('1563986768609-322da13575f3', 200),
		bio: 'National telecom operator running Telebirr and 5G consumer campaigns.',
		verificationLevel: 'cn_verified' as const,
		email: 'marketing@ethiotelecom.et'
	},
	{
		slug: 'goh-hotels',
		name: 'Goh Hotels & Resorts',
		orgType: 'company' as const,
		country: 'ET',
		city: 'Bahir Dar',
		logo: img('1566073771259-6a8506099945', 200),
		bio: 'Lakeside resorts across the historic route, hosting creators on barter stays.',
		verificationLevel: 'identity_verified' as const,
		email: 'marketing@gohhotels.et'
	},
	{
		slug: 'addis-tech-summit',
		name: 'Addis Tech Summit',
		orgType: 'event_organizer' as const,
		country: 'ET',
		city: 'Addis Ababa',
		logo: img('1540575467063-178a50c2df87', 200),
		bio: 'East Africa’s largest technology conference, held each November.',
		verificationLevel: 'cn_verified' as const,
		email: 'press@addistechsummit.et'
	},
	{
		slug: 'habesha-coffee-co',
		name: 'Habesha Coffee Co.',
		orgType: 'startup' as const,
		country: 'ET',
		city: 'Addis Ababa',
		logo: img('1495474472287-4d71bcdd2085', 200),
		bio: 'Single-origin roaster exporting Yirgacheffe and Sidamo.',
		verificationLevel: 'identity_verified' as const,
		email: 'hello@habeshacoffee.et'
	},
	{
		slug: 'green-futures-ngo',
		name: 'Green Futures Initiative',
		orgType: 'ngo' as const,
		country: 'RW',
		city: 'Kigali',
		logo: img('1497435334941-8c899ee9e8e9', 200),
		bio: 'Pan-African NGO working on clean cooking and solar access.',
		verificationLevel: 'cn_verified' as const,
		email: 'comms@greenfutures.org'
	}
];

const CAMPAIGNS = [
	{
		slug: 'telebirr-superapp-launch',
		org: 'ethio-telecom',
		title: 'Telebirr SuperApp 5G Launch Series',
		description:
			'We are launching the new Telebirr SuperApp with 5G-backed features and need creators who can explain what actually changes for everyday users — sending money, paying bills, and the new merchant tools. Show it working in real life, in Amharic, without marketing language.',
		objective: 'Drive 50,000 new SuperApp activations in Addis Ababa within six weeks.',
		compensationType: 'paid' as const,
		category: 'technology',
		platforms: ['TikTok', 'Telegram', 'YouTube'],
		creatorsNeeded: 6,
		followerMin: 50000,
		followerMax: 800000,
		budgetMin: 25000,
		budgetMax: 60000,
		currencyCode: 'ETB',
		country: 'ET',
		targetRegions: ['Ethiopia'],
		deliverables: [
			'1 x dedicated video (60–90s)',
			'1 x Telegram or Story post',
			'Trackable download link',
			'3 months usage rights'
		],
		deadline: '2026-10-15',
		tags: ['#Fintech', '#MobileMoney', '#Telebirr', '#5G'],
		status: 'published' as const
	},
	{
		slug: 'goh-resort-barter-stay',
		org: 'goh-hotels',
		title: 'Lake Tana Resort — Creator Stay Programme',
		description:
			'Two nights for two at our Bahir Dar lakeside resort, including all meals, a sunrise boat trip to the monasteries, and spa access. We are looking for travel and lifestyle creators who film properly — not phone snapshots — and who can show the resort as a destination rather than a backdrop.',
		objective: 'Fill midweek occupancy in the green season with domestic and diaspora bookings.',
		compensationType: 'barter' as const,
		category: 'travel-tourism',
		platforms: ['Instagram', 'YouTube', 'TikTok'],
		creatorsNeeded: 4,
		followerMin: 30000,
		followerMax: 400000,
		budgetMin: 0,
		budgetMax: 0,
		currencyCode: 'ETB',
		country: 'ET',
		targetRegions: ['Ethiopia', 'United States', 'United Kingdom'],
		barterDetails:
			'Two nights for two people in a lake-view suite, all meals and drinks, sunrise boat excursion to the Zege monasteries, and full spa access. Transport from Bahir Dar airport included. Total retail value approximately 48,000 ETB.',
		deliverables: [
			'1 x destination film or Reel',
			'6 x Story frames during the stay',
			'Photo set of 15 images licensed to the resort'
		],
		deadline: '2026-11-30',
		tags: ['#Travel', '#LakeTana', '#EcoTourism'],
		status: 'published' as const
	},
	{
		slug: 'addis-tech-summit-vip-pass',
		org: 'addis-tech-summit',
		title: 'Addis Tech Summit 2026 — Creator VIP Passes',
		description:
			'Twenty VIP creator passes for the summit, including the invite-only founder dinner and backstage access to the main stage. We want pre-event build-up, live coverage across the two days, and one reflective post afterwards. This is access, not cash — please only apply if that works for you.',
		objective: 'Reach 2M impressions across the creator cohort during summit week.',
		compensationType: 'event_pass' as const,
		category: 'technology',
		platforms: ['TikTok', 'Instagram', 'LinkedIn', 'X'],
		creatorsNeeded: 20,
		followerMin: 20000,
		followerMax: 0,
		budgetMin: 0,
		budgetMax: 0,
		currencyCode: 'ETB',
		country: 'ET',
		targetRegions: ['Ethiopia', 'Kenya', 'Nigeria'],
		eventName: 'Addis Tech Summit 2026',
		eventDate: '2026-11-12',
		eventLocation: 'Skylight Hotel, Addis Ababa',
		passType: 'VIP Access Pass + founder dinner + backstage',
		deliverables: [
			'1 x pre-event teaser',
			'4 x live Story or post updates across both days',
			'1 x post-event reflection'
		],
		deadline: '2026-11-01',
		tags: ['#AddisTechSummit', '#Technology', '#StartupsAfrica'],
		status: 'published' as const
	},
	{
		slug: 'habesha-coffee-origin-story',
		org: 'habesha-coffee-co',
		title: 'Yirgacheffe Origin Story — Food & Coffee Creators',
		description:
			'We are taking four creators to the Yirgacheffe washing station during harvest to document where the coffee actually comes from. Travel, accommodation and a fee are covered. We want the farmers on camera, not just the cup.',
		objective: 'Build export-market credibility ahead of a European retail listing.',
		compensationType: 'paid' as const,
		category: 'food-dining',
		platforms: ['YouTube', 'Instagram', 'TikTok'],
		creatorsNeeded: 4,
		followerMin: 40000,
		followerMax: 0,
		budgetMin: 30000,
		budgetMax: 75000,
		currencyCode: 'ETB',
		country: 'ET',
		targetRegions: ['Ethiopia', 'United Kingdom', 'United States'],
		deliverables: [
			'1 x origin film (4–8 min)',
			'1 x short-form cut',
			'Photo set of 20 images',
			'12 months usage rights'
		],
		deadline: '2026-12-20',
		tags: ['#Coffee', '#Yirgacheffe', '#Foodie', '#OriginStory'],
		status: 'published' as const
	},
	{
		slug: 'green-futures-clean-cooking',
		org: 'green-futures-ngo',
		title: 'Clean Cooking Awareness — Pan-African Creators',
		description:
			'A public-health campaign about indoor air pollution from traditional cookstoves. We need creators across Ethiopia, Kenya and Rwanda who can carry a serious message without lecturing. Scripts are collaborative — you know your audience better than we do.',
		objective: 'Reach 500,000 households with clean-cooking messaging in local languages.',
		compensationType: 'paid' as const,
		category: 'health-wellness',
		platforms: ['TikTok', 'Facebook', 'YouTube'],
		creatorsNeeded: 9,
		followerMin: 25000,
		followerMax: 0,
		budgetMin: 18000,
		budgetMax: 40000,
		currencyCode: 'ETB',
		country: null,
		targetRegions: ['Ethiopia', 'Kenya', 'Rwanda'],
		deliverables: [
			'1 x explainer video in a local language',
			'1 x follow-up post answering comments'
		],
		deadline: '2026-12-05',
		tags: ['#CleanEnergy', '#PublicHealth', '#ClimateAction'],
		status: 'published' as const
	},
	{
		slug: 'ethio-telecom-back-to-school',
		org: 'ethio-telecom',
		title: 'Back to School Data Bundles',
		description:
			'Student data bundles launching for the new academic year. Looking for education and student-life creators to explain the tiers.',
		objective: 'Drive bundle uptake among university students.',
		compensationType: 'paid' as const,
		category: 'education',
		platforms: ['TikTok', 'Telegram'],
		creatorsNeeded: 5,
		followerMin: 20000,
		followerMax: 0,
		budgetMin: 10000,
		budgetMax: 25000,
		currencyCode: 'ETB',
		country: 'ET',
		targetRegions: ['Ethiopia'],
		deliverables: ['1 x explainer video', '1 x Telegram post'],
		deadline: '2026-09-30',
		tags: ['#Education', '#DigitalSkills'],
		status: 'draft' as const
	}
];

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Insert or update on a natural key, returning the row id either way. */
async function upsert<T extends Record<string, any>>(
	table: any,
	where: any,
	values: T
): Promise<number> {
	const existing = await db.select({ id: table.id }).from(table).where(where).limit(1);
	if (existing.length) {
		await db.update(table).set(values).where(eq(table.id, existing[0].id));
		return existing[0].id;
	}
	const result: any = await db.insert(table).values(values);
	return Number(result.insertId ?? result[0]?.insertId);
}

/** Shared sign-in password for the seeded accounts. See ACCOUNTS.md. */
const SEED_PASSWORD = 'creator2026';

/**
 * Creates the user and its credential account, hashed the way better-auth
 * hashes it, so the seeded accounts can sign in through the normal form.
 */
async function ensureUser(email: string, name: string, role: string) {
	const existing = await db.select().from(t.user).where(eq(t.user.email, email)).limit(1);
	const userId = existing.length ? existing[0].id : randomUUID();

	if (existing.length) {
		await db.update(t.user).set({ name, role }).where(eq(t.user.id, userId));
	} else {
		await db.insert(t.user).values({ id: userId, name, email, emailVerified: true, role });
	}

	const credential = await db
		.select({ id: t.account.id })
		.from(t.account)
		.where(and(eq(t.account.userId, userId), eq(t.account.providerId, 'credential')))
		.limit(1);

	if (!credential.length) {
		await db.insert(t.account).values({
			id: randomUUID(),
			accountId: userId,
			providerId: 'credential',
			userId,
			password: await hashPassword(SEED_PASSWORD),
			updatedAt: new Date()
		});
	}

	return userId;
}

/* ------------------------------------------------------------------ *
 * Seed
 * ------------------------------------------------------------------ */

/**
 * Earlier seeds used placeholder `.demo` addresses, which surfaced in the
 * operator's user list. Renaming in place keeps each account's id, sessions and
 * every row that references it — creating fresh users would orphan all of that.
 */
async function migrateSeedEmails() {
	const renames: [string, string][] = [
		['brand@ethiotelecom.demo', 'marketing@ethiotelecom.et'],
		['marketing@gohhotels.demo', 'marketing@gohhotels.et'],
		['press@addistechsummit.demo', 'press@addistechsummit.et'],
		['hello@habeshacoffee.demo', 'hello@habeshacoffee.et'],
		['comms@greenfutures.demo', 'comms@greenfutures.org'],
		...CREATORS.map(
			(creator) =>
				[`${creator.username}@creators.demo`, `${creator.username}@gmail.com`] as [string, string]
		)
	];

	let renamed = 0;
	for (const [from, to] of renames) {
		const existing = await db
			.select({ id: t.user.id })
			.from(t.user)
			.where(eq(t.user.email, from))
			.limit(1);
		if (!existing.length) continue;

		// Skip if the destination is already taken, so the unique index holds.
		const taken = await db
			.select({ id: t.user.id })
			.from(t.user)
			.where(eq(t.user.email, to))
			.limit(1);
		if (taken.length) continue;

		await db.update(t.user).set({ email: to }).where(eq(t.user.id, existing[0].id));
		renamed++;
	}

	if (renamed) console.log(`→ renamed ${renamed} placeholder account address(es)`);
}

/* ------------------------------------------------------------------ *
 * Review history
 *
 * A creator's rating is the average of the reviews on their record, so the
 * demo data has to contain the reviews it claims: 18 reviews on the profile
 * means 18 rows here, each hanging off a completed booking the way a real
 * one does. `rating` and `reviews` on a SeedCreator are the target the
 * generator aims at — the value the profile prints is recomputed from the
 * rows afterwards, never copied from the literal.
 * ------------------------------------------------------------------ */

/** Stable hash — the seed must produce the same rows on every run. */
function hashOf(key: string): number {
	let h = 2166136261;
	for (let i = 0; i < key.length; i++) {
		h ^= key.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

/** One option out of a list, chosen by key rather than by chance. */
const pick = <T>(options: readonly T[], key: string): T => options[hashOf(key) % options.length];

/** Deterministic shuffle, so the four-star reviews are not all at the end. */
function shuffled<T>(items: T[], key: string): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = hashOf(`${key}:${i}`) % (i + 1);
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/**
 * `count` star ratings whose mean rounds to `target` at the one decimal the
 * UI prints. Ratings are whole stars, so a few targets are unreachable (no
 * six whole stars average 4.9) — the generator lands on the closest mean and
 * the profile then shows that, rather than a headline its reviews disagree
 * with.
 */
function ratingSpread(count: number, target: number): number[] {
	const total = Math.min(count * 5, Math.max(count, Math.round(target * count)));
	const base = Math.floor(total / count);
	const above = total - base * count;
	const ratings = Array.from({ length: count }, (_, i) => (i < above ? base + 1 : base));

	/* A real record has an outlier or two rather than one flat band. Trading a
	   pair of middle ratings for one above and one below leaves the mean —
	   and so the number on the profile — exactly where it was. */
	for (let swap = 0; swap < Math.floor(count / 9); swap++) {
		const first = ratings.indexOf(base);
		const second = ratings.lastIndexOf(base);
		if (first < 0 || first === second || base - 1 < 1 || base + 1 > 5) break;
		ratings[first] = base + 1;
		ratings[second] = base - 1;
	}

	return ratings;
}

/** A per-criterion score that sits near the stars the brand gave overall. */
const subScore = (rating: number, key: string) => {
	const deltas = rating >= 5 ? [0, 0, 0, -1] : rating === 4 ? [0, 0, 1, -1] : [0, 1, -1, 0];
	return Math.min(5, Math.max(1, rating + pick(deltas, key)));
};

/** Work that predates the lifecycle bookings above: closed, paid, reviewed. */
const HISTORY_BRIEFS = [
	{
		title: 'Product feature — {platform}',
		deliverables: ['1 x dedicated {platform} video', '1 x Story set']
	},
	{
		title: 'Brand awareness push',
		deliverables: ['2 x {platform} posts', 'Usage rights for 30 days']
	},
	{
		title: 'Seasonal campaign creative',
		deliverables: ['1 x {platform} video', '3 x still images']
	},
	{
		title: 'Launch-week takeover',
		deliverables: ['3 x posts over one week', '1 x pinned summary']
	},
	{
		title: 'Event coverage',
		deliverables: ['Live coverage across Stories', '1 x recap video']
	},
	{
		title: 'How-to feature',
		deliverables: ['1 x how-to video', '1 x carousel']
	},
	{
		title: 'Testimonial spot',
		deliverables: ['1 x testimonial video', 'Whitelisting for paid amplification']
	},
	{
		title: 'Always-on retainer drop',
		deliverables: ['2 x {platform} videos', '1 x community post']
	}
];

const PRICE_FACTORS = [0.9, 1, 1.1, 1.25, 1.4, 1.6, 1.8, 2.2];

const FIVE_STAR_BODIES = [
	'Delivered two days ahead of the deadline and the first cut needed no changes. The comments were full of people asking where to buy.',
	'Second time working with {first} and it was as smooth as the first. The brief gets read properly, questions come early, and the footage is usable straight away.',
	'Understood the product better than parts of our own team did. Sales through the tracked link covered the fee inside two weeks.',
	'Professional from the first call. We had a shot list before filming, so there were no surprises at review.',
	'Good instinct for what their audience will actually sit through. We asked for sixty seconds and got something that held to the end.',
	'Handled a tight turnaround over a holiday weekend without a fuss, and the quality did not drop for the speed.',
	'The Amharic voiceover landed far better than the English script we drafted. We ended up using their version in our own paid media.',
	'Clear communication throughout, invoiced exactly what we agreed, and usage rights were sorted without any back and forth.',
	'Brought an idea to the brief that was better than ours. Approved the first cut with no revisions.',
	'The audience trust is real — the replies were genuine questions about the product rather than the usual noise.',
	'Everything arrived in the right formats and sizes, captioned and ready to publish. Rarer than it should be.',
	'We briefed four creators for this campaign and this was the only one we did not have to send back.',
	'Flagged a factual error in our script before filming rather than reading it out. That alone was worth the fee.',
	'Reach was in line with the profile and the engagement was better than we projected. We have booked them again since.',
	'Kept us updated at every stage without being asked, which made approvals easy on our side.',
	'The recap film is still the best asset we have. We have reused it for three separate placements.',
	'Filmed on location with no supervision from us and came back with more than the brief asked for.',
	'Straightforward to work with, honest about what would and would not work for their audience, and delivered exactly what was promised.'
];

const FOUR_STAR_BODIES = [
	'Good work overall. One round of revisions to move the product mention earlier, handled quickly.',
	'Content quality was strong. Replies were a little slow during production, but the deadline held.',
	'The video performed well. We would have liked another still for the retail listing, though that was a gap in our brief.',
	'Solid delivery and a professional attitude. Audio in the opening shot was low and needed a fix.',
	'Delivered on time and on brief. The tone came out slightly more formal than we expected for the platform.',
	'Happy with the result. Scheduling took a few days to settle, then everything moved quickly.',
	'Nice storytelling, and the second cut for Reels arrived the next day when we asked.',
	'Reliable and easy to work with. Engagement came in a little under our forecast, which was our forecast being optimistic.',
	'Professional throughout. We had to chase the raw files after publication, but they came.',
	'The creative was good. Approval took two rounds because the pack shot was cropped in the first version.'
];

const THREE_STAR_BODIES = [
	'The deliverables arrived and met the brief, but it took two revision rounds to get the product framing right.',
	'Content was fine. Communication went quiet mid-production and we had to chase for a status update.',
	'Filed a day past the deadline. The finished piece was decent and the delay was explained.',
	'An average result for us — the audience fit was not as close as we expected, though the work itself was competent.',
	'Usable content, but we did most of the direction ourselves rather than getting a proposal back.'
];

/** Everything historical is dated back from here, so re-seeding is stable. */
const HISTORY_ANCHOR = new Date('2026-07-20T09:00:00Z');
const daysBefore = (days: number) => new Date(HISTORY_ANCHOR.getTime() - days * 86_400_000);
const asDate = (value: Date) => value.toISOString().slice(0, 10);

async function seed() {
	await migrateSeedEmails();

	console.log('→ reference data');

	const countryIds: Record<string, number> = {};
	for (const [index, country] of COUNTRIES.entries()) {
		countryIds[country.code] = await upsert(t.countries, eq(t.countries.code, country.code), {
			...country,
			sortOrder: index,
			isActive: true
		});
	}

	const regionIds: Record<string, number> = {};
	const seedRegions = async (code: string, list: { name: string; majorCities: string[] }[]) => {
		for (const [index, region] of list.entries()) {
			const id = await upsert(
				t.regions,
				and(eq(t.regions.countryId, countryIds[code]), eq(t.regions.name, region.name))!,
				{
					countryId: countryIds[code],
					name: region.name,
					majorCities: region.majorCities,
					sortOrder: index,
					isActive: true
				}
			);
			regionIds[`${code}:${region.name}`] = id;
		}
	};
	await seedRegions('ET', ETHIOPIAN_REGIONS);
	for (const [code, list] of Object.entries(OTHER_REGIONS)) await seedRegions(code, list);

	const categoryIds: Record<string, number> = {};
	for (const [index, category] of CATEGORIES.entries()) {
		categoryIds[category.slug] = await upsert(t.categories, eq(t.categories.slug, category.slug), {
			...category,
			sortOrder: index,
			isActive: true
		});
	}

	const platformIds: Record<string, number> = {};
	for (const [index, platform] of PLATFORMS.entries()) {
		platformIds[platform.name] = await upsert(t.platforms, eq(t.platforms.name, platform.name), {
			...platform,
			sortOrder: index,
			isActive: true
		});
	}

	const languageIds: Record<string, number> = {};
	for (const [index, language] of LANGUAGES.entries()) {
		languageIds[language.name] = await upsert(t.languages, eq(t.languages.code, language.code), {
			...language,
			sortOrder: index,
			isActive: true
		});
	}

	for (const [index, slide] of GALLERY_SLIDES.entries()) {
		await upsert(t.gallerySlides, eq(t.gallerySlides.title, slide.title), {
			...slide,
			sortOrder: index,
			isActive: true
		});
	}

	console.log('→ site settings');
	await upsert(t.siteSettings, sql`1=1`, {
		siteName: 'Creator Network',
		tagline: "Connecting Ethiopia's digital influence.",
		heroTitle: 'Find the right creator. Build the right campaign.',
		heroSubtitle:
			'Ethiopia’s managed creator marketplace. Work with verified creators across TikTok, Telegram, YouTube and Instagram, agree terms that are recorded, and track delivery through to completion.',
		platformFeePercent: 15,
		supportEmail: 'support@creatornetwork.et',
		supportPhone: '+251 11 000 0000'
	});

	console.log('→ accounts');
	const adminId = await ensureUser('admin@creatornetwork.et', 'Platform Operator', 'admin');

	console.log(`→ ${BLOG_POSTS.length} blog posts`);
	const sectionIds = new Map<string, number>();
	for (const [index, section] of BLOG_SECTIONS.entries()) {
		const id = await upsert(t.blogCategories, eq(t.blogCategories.slug, section.slug), {
			...section,
			sortOrder: index,
			isActive: true
		});
		sectionIds.set(section.slug, id);
	}

	for (const post of BLOG_POSTS) {
		/* Through the same two functions the save action uses, so a seeded body
		   and an authored one are stored under identical rules. */
		const body = sanitizeArticleHtml(post.body);
		const text = htmlToText(body);

		/*
		 * Derived, not declared — through the same function the save action uses.
		 *
		 * A hand-written slug that `slugify` would not produce is a slug the
		 * first save silently replaces, and the next seed then no longer
		 * recognises the row it wrote: `upsert` matches on the slug, finds
		 * nothing, and inserts the article a second time.
		 */
		const slug = slugify(post.title, 'post');

		await upsert(t.blogPosts, eq(t.blogPosts.slug, slug), {
			title: post.title,
			slug,
			excerpt: post.excerpt,
			body,
			searchText: text,
			readingMinutes: readingMinutes(text),
			categoryId: sectionIds.get(post.section) ?? null,
			tags: post.tags,
			status: 'published' as const,
			publishedAt: daysBefore(post.daysAgo),
			isFeatured: post.featured ?? false,
			authorName: post.author,
			createdBy: adminId,
			updatedBy: adminId
		});
	}

	console.log(`→ ${CREATORS.length} creators`);
	const creatorIds: Record<string, number> = {};

	for (const [index, seedCreator] of CREATORS.entries()) {
		const userId = await ensureUser(
			`${seedCreator.username}@gmail.com`,
			seedCreator.fullName,
			'creator'
		);

		const engagement =
			seedCreator.socials.reduce((sum, s) => sum + s.engagement, 0) / seedCreator.socials.length;

		const score = calculateScore({
			fullName: seedCreator.fullName,
			bio: seedCreator.bio,
			avatar: seedCreator.avatar,
			cover: seedCreator.cover,
			categoryCount: seedCreator.categories.length,
			languageCount: seedCreator.languages.length,
			packageCount: seedCreator.packages.length,
			portfolioCount: seedCreator.portfolio.length,
			verificationLevel: seedCreator.verificationLevel,
			engagementRate: engagement,
			averageRating: seedCreator.rating,
			completedBookings: seedCreator.completed
		});

		const creatorId = await upsert(t.creators, eq(t.creators.username, seedCreator.username), {
			userId,
			username: seedCreator.username,
			fullName: seedCreator.fullName,
			avatar: seedCreator.avatar,
			cover: seedCreator.cover,
			bio: seedCreator.bio,
			countryId: countryIds[seedCreator.country],
			regionId: regionIds[`${seedCreator.country}:${seedCreator.region}`] ?? null,
			city: seedCreator.city,
			primaryPlatformId: platformIds[seedCreator.primaryPlatform],
			totalReach: seedCreator.totalReach,
			startingPrice: seedCreator.startingPrice,
			currencyCode: seedCreator.currencyCode,
			score,
			verificationLevel: seedCreator.verificationLevel,
			availability: seedCreator.availability,
			isFeatured: seedCreator.featured,
			isTrending: seedCreator.trending,
			overseasPercentage: seedCreator.overseas,
			topCountries: seedCreator.topCountries,
			/* reviewsCount, averageRating and completedBookings are not written
			   here: they are recomputed from the review and booking rows once
			   the history below exists. */
			isPublished: true,
			isClaimed: true,
			isActive: true,
			sortOrder: index,
			createdBy: adminId
		});
		creatorIds[seedCreator.username] = creatorId;

		await db.delete(t.creatorCategories).where(eq(t.creatorCategories.creatorId, creatorId));
		for (const slug of seedCreator.categories) {
			await db.insert(t.creatorCategories).values({ creatorId, categoryId: categoryIds[slug] });
		}

		await db.delete(t.creatorLanguages).where(eq(t.creatorLanguages.creatorId, creatorId));
		for (const language of seedCreator.languages) {
			if (languageIds[language]) {
				await db
					.insert(t.creatorLanguages)
					.values({ creatorId, languageId: languageIds[language] });
			}
		}

		await db.delete(t.socialAccounts).where(eq(t.socialAccounts.creatorId, creatorId));
		for (const [order, social] of seedCreator.socials.entries()) {
			await db.insert(t.socialAccounts).values({
				creatorId,
				platformId: platformIds[social.platform],
				handle: social.handle,
				followers: social.followers,
				engagementRate: social.engagement,
				isVerified: social.verified,
				sortOrder: order,
				createdBy: adminId
			});
		}

		await db.delete(t.packages).where(eq(t.packages.creatorId, creatorId));
		for (const [order, pack] of seedCreator.packages.entries()) {
			await db.insert(t.packages).values({
				creatorId,
				title: pack.title,
				platformId: platformIds[pack.platform],
				description: pack.description,
				deliverables: pack.deliverables,
				price: pack.price,
				currencyCode: seedCreator.currencyCode,
				deliveryDays: pack.days,
				revisions: 2,
				sortOrder: order,
				createdBy: adminId
			});
		}

		await db.delete(t.portfolioItems).where(eq(t.portfolioItems.creatorId, creatorId));
		for (const [order, item] of seedCreator.portfolio.entries()) {
			await db.insert(t.portfolioItems).values({
				creatorId,
				mediaType: 'image',
				url: item.url,
				caption: item.caption,
				platformId: platformIds[item.platform],
				views: item.views,
				likes: item.likes,
				sortOrder: order,
				createdBy: adminId
			});
		}
	}

	console.log(`→ ${ORGANISATIONS.length} organisations`);
	const orgIds: Record<string, number> = {};
	for (const [index, org] of ORGANISATIONS.entries()) {
		const ownerId = await ensureUser(org.email, `${org.name} Team`, 'business');
		const orgId = await upsert(t.organizations, eq(t.organizations.slug, org.slug), {
			ownerId,
			name: org.name,
			slug: org.slug,
			orgType: org.orgType,
			logo: org.logo,
			bio: org.bio,
			countryId: countryIds[org.country],
			city: org.city,
			verificationLevel: org.verificationLevel,
			isActive: true,
			sortOrder: index,
			createdBy: adminId
		});
		orgIds[org.slug] = orgId;

		await upsert(
			t.organizationMembers,
			and(
				eq(t.organizationMembers.organizationId, orgId),
				eq(t.organizationMembers.userId, ownerId)
			)!,
			{ organizationId: orgId, userId: ownerId, role: 'owner', createdBy: adminId }
		);
	}

	console.log(`→ ${CAMPAIGNS.length} campaigns`);
	const campaignIds: Record<string, number> = {};
	for (const [index, campaign] of CAMPAIGNS.entries()) {
		campaignIds[campaign.slug] = await upsert(t.campaigns, eq(t.campaigns.slug, campaign.slug), {
			organizationId: orgIds[campaign.org],
			title: campaign.title,
			slug: campaign.slug,
			description: campaign.description,
			objective: campaign.objective,
			compensationType: campaign.compensationType,
			categoryId: categoryIds[campaign.category],
			platformIds: campaign.platforms.map((name) => platformIds[name]),
			creatorsNeeded: campaign.creatorsNeeded,
			followerMin: campaign.followerMin,
			followerMax: campaign.followerMax,
			budgetMin: campaign.budgetMin,
			budgetMax: campaign.budgetMax,
			currencyCode: campaign.currencyCode,
			countryId: campaign.country ? countryIds[campaign.country] : null,
			targetRegions: campaign.targetRegions,
			barterDetails: (campaign as any).barterDetails ?? null,
			eventName: (campaign as any).eventName ?? null,
			eventDate: (campaign as any).eventDate ?? null,
			eventLocation: (campaign as any).eventLocation ?? null,
			passType: (campaign as any).passType ?? null,
			deliverables: campaign.deliverables,
			deadline: campaign.deadline,
			language: 'Amharic & English',
			tags: campaign.tags,
			status: campaign.status,
			isActive: true,
			sortOrder: index,
			createdBy: adminId
		});
	}

	console.log('→ applications, bookings and reviews across the lifecycle');

	const applicationSeed = [
		{
			campaign: 'telebirr-superapp-launch',
			creator: 'joel_tech_ethiopia',
			status: 'selected' as const,
			price: 40000,
			pitch:
				'I can produce a high-retention TikTok explaining the SuperApp 5G speed difference filmed in Bole, plus a Telegram post to my 80K channel. My audience already asks me about Telebirr fees every week.'
		},
		{
			campaign: 'telebirr-superapp-launch',
			creator: 'abel_addis_finance',
			status: 'shortlisted' as const,
			price: 32000,
			pitch:
				'My Telegram channel is 155K people who follow me specifically for money explainers. I would run a three-post sequence over a week rather than one video, because activation needs repetition.'
		},
		{
			campaign: 'telebirr-superapp-launch',
			creator: 'selam_comedy_et',
			status: 'applied' as const,
			price: 24000,
			pitch:
				'A sketch where the whole family argues about splitting a bill until someone opens the SuperApp. Comedy carries fintech better than a demo does.'
		},
		{
			campaign: 'addis-tech-summit-vip-pass',
			creator: 'joel_tech_ethiopia',
			status: 'shortlisted' as const,
			price: 0,
			pitch:
				'Happy to attend as a tech creator and cover the keynote plus the founder dinner. I covered the 2025 summit and the recap did 180K views.'
		},
		{
			campaign: 'goh-resort-barter-stay',
			creator: 'eden_worku_travel',
			status: 'selected' as const,
			price: 0,
			pitch:
				'I am based in Bahir Dar, so I can shoot at sunrise on the lake without the travel overhead. I would deliver a proper 6-minute film rather than phone footage.'
		},
		{
			campaign: 'goh-resort-barter-stay',
			creator: 'diane_kigali',
			status: 'applied' as const,
			price: 0,
			pitch:
				'My audience is 61% overseas and books Ethiopian itineraries. A Lake Tana feature would sit well alongside my Rwanda content.'
		},
		{
			campaign: 'habesha-coffee-origin-story',
			creator: 'dawit_food_addict',
			status: 'selected' as const,
			price: 55000,
			pitch:
				'I have wanted to film at a washing station for two years. I would focus on the farmers and the sorting process, not the latte art.'
		},
		{
			campaign: 'habesha-coffee-origin-story',
			creator: 'samira_london_habesha',
			status: 'applied' as const,
			price: 1800,
			pitch:
				'I can carry this to the UK diaspora market where your retail listing is heading. My London coffee video did 290K views.'
		},
		{
			campaign: 'clean-cooking',
			creator: 'meron_fitness_et',
			status: 'applied' as const,
			price: 22000,
			pitch:
				'Indoor air quality connects directly to the respiratory content my audience already engages with.'
		}
	];

	for (const app of applicationSeed) {
		const campaignId = campaignIds[app.campaign] ?? campaignIds['green-futures-clean-cooking'];
		const creatorId = creatorIds[app.creator];
		if (!campaignId || !creatorId) continue;
		await upsert(
			t.applications,
			and(eq(t.applications.campaignId, campaignId), eq(t.applications.creatorId, creatorId))!,
			{
				campaignId,
				creatorId,
				pitch: app.pitch,
				proposedPrice: app.price,
				currencyCode: 'ETB',
				status: app.status,
				createdBy: adminId
			}
		);
	}

	for (const slug of Object.keys(campaignIds)) {
		const count = await db
			.select({ n: sql<number>`count(*)` })
			.from(t.applications)
			.where(eq(t.applications.campaignId, campaignIds[slug]));
		await db
			.update(t.campaigns)
			.set({ applicationsCount: Number(count[0]?.n ?? 0) })
			.where(eq(t.campaigns.id, campaignIds[slug]));
	}

	/** One booking parked at each stage of the lifecycle, so every screen has content. */
	const bookingSeed = [
		{
			ref: 'CN-2608-A1B2',
			creator: 'joel_tech_ethiopia',
			org: 'ethio-telecom',
			campaign: 'telebirr-superapp-launch',
			title: 'Telebirr SuperApp — TikTok launch video',
			price: 40000,
			status: 'completed' as const,
			escrow: 'released' as const,
			deliverables: [
				'1 x 60s dedicated TikTok video',
				'1 x Telegram post',
				'Trackable download link'
			],
			review: {
				rating: 5,
				body: 'Joel turned the brief around in three days and the video outperformed our own paid media. He flagged a factual error in our script before filming, which we appreciated more than the view count.'
			}
		},
		{
			ref: 'CN-2608-C3D4',
			creator: 'dawit_food_addict',
			org: 'habesha-coffee-co',
			campaign: 'habesha-coffee-origin-story',
			title: 'Yirgacheffe origin film',
			price: 55000,
			status: 'in_production' as const,
			escrow: 'held' as const,
			deliverables: ['1 x origin film (4–8 min)', '1 x short-form cut', 'Photo set of 20 images'],
			review: null
		},
		{
			ref: 'CN-2608-E5F6',
			creator: 'eden_worku_travel',
			org: 'goh-hotels',
			campaign: 'goh-resort-barter-stay',
			title: 'Lake Tana resort destination film',
			price: 0,
			status: 'submitted' as const,
			escrow: 'unfunded' as const,
			compensation: 'barter' as const,
			deliverables: ['1 x destination film', '6 x Story frames', 'Photo set of 15 images'],
			review: null
		},
		{
			ref: 'CN-2608-G7H8',
			creator: 'abel_addis_finance',
			org: 'ethio-telecom',
			campaign: null,
			title: 'Telegram explainer series — bundle pricing',
			price: 18000,
			status: 'booked' as const,
			escrow: 'unfunded' as const,
			deliverables: ['3 x posts over one week', 'Pinned summary'],
			review: null
		},
		{
			ref: 'CN-2608-J9K0',
			creator: 'bete_beauty_addis',
			org: 'habesha-coffee-co',
			campaign: null,
			title: 'Coffee brand lifestyle Reel',
			price: 11000,
			status: 'revision' as const,
			escrow: 'held' as const,
			deliverables: ['1 x Reel', '1 x carousel'],
			review: null
		},
		{
			ref: 'CN-2608-L1M2',
			creator: 'samira_london_habesha',
			org: 'habesha-coffee-co',
			campaign: null,
			title: 'UK diaspora launch feature',
			price: 1400,
			currency: 'GBP',
			status: 'awaiting_settlement' as const,
			escrow: 'held' as const,
			deliverables: ['1 x TikTok video', '1 x Instagram Reel cross-post'],
			review: null
		}
	];

	for (const seedBooking of bookingSeed) {
		const creatorId = creatorIds[seedBooking.creator];
		const organizationId = orgIds[seedBooking.org];
		if (!creatorId || !organizationId) continue;

		const currency = (seedBooking as any).currency ?? 'ETB';
		const { platformFee, creatorPayout } = splitFee(seedBooking.price, 15);
		const compensation = (seedBooking as any).compensation ?? 'paid';

		const bookingId = await upsert(t.bookings, eq(t.bookings.reference, seedBooking.ref), {
			reference: seedBooking.ref,
			campaignId: seedBooking.campaign ? campaignIds[seedBooking.campaign] : null,
			creatorId,
			organizationId,
			title: seedBooking.title,
			deliverables: seedBooking.deliverables,
			compensationType: compensation,
			price: seedBooking.price,
			currencyCode: currency,
			platformFee,
			creatorPayout,
			status: seedBooking.status,
			escrowStatus: seedBooking.escrow,
			paymentMethod: seedBooking.escrow === 'unfunded' ? null : 'telebirr',
			paymentRef:
				seedBooking.escrow === 'unfunded' ? null : `TELE-ESC-${seedBooking.ref.slice(-6)}`,
			deadline: '2026-09-30',
			revisionsUsed: seedBooking.status === 'revision' ? 1 : 0,
			revisionsAllowed: 2,
			termsSnapshot: {
				title: seedBooking.title,
				deliverables: seedBooking.deliverables,
				price: seedBooking.price,
				currencyCode: currency,
				platformFee,
				creatorPayout,
				compensationType: compensation,
				revisionsAllowed: 2,
				deadline: '2026-09-30',
				agreedAt: new Date().toISOString(),
				agreedByOrgUserId: null,
				agreedByCreatorUserId: null
			},
			termsFrozenAt: new Date(),
			completedAt: seedBooking.status === 'completed' ? new Date() : null,
			isActive: true,
			createdBy: adminId
		});

		if (seedBooking.review) {
			await upsert(
				t.reviews,
				and(eq(t.reviews.bookingId, bookingId), eq(t.reviews.direction, 'brand_to_creator'))!,
				{
					bookingId,
					creatorId,
					organizationId,
					direction: 'brand_to_creator',
					rating: seedBooking.review.rating,
					communication: 5,
					professionalism: 5,
					timeliness: 5,
					quality: 5,
					body: seedBooking.review.body,
					createdBy: adminId
				}
			);
		}

		if (seedBooking.status === 'submitted' || seedBooking.status === 'revision') {
			const existing = await db
				.select({ id: t.submissions.id })
				.from(t.submissions)
				.where(eq(t.submissions.bookingId, bookingId))
				.limit(1);
			if (!existing.length) {
				await db.insert(t.submissions).values({
					bookingId,
					contentUrl: 'https://www.tiktok.com/@example/video/7300000000000000000',
					notes:
						'First cut attached. Colour grade is final; happy to adjust the music if it clashes with your brand guidelines.',
					status: seedBooking.status === 'revision' ? 'revision_requested' : 'submitted',
					reviewNote:
						seedBooking.status === 'revision'
							? 'Lovely footage. Please move the product mention earlier — it currently lands at 0:38 and most viewers drop before then.'
							: null,
					createdBy: adminId
				});
			}
		}
	}

	console.log('→ closed bookings and the reviews behind every rating');

	/** Work already written above, so the history does not create it twice. */
	const lifecycleCompleted: Record<string, number> = {};
	const lifecycleRatings: Record<string, number[]> = {};
	for (const b of bookingSeed) {
		if (b.status === 'completed') {
			lifecycleCompleted[b.creator] = (lifecycleCompleted[b.creator] ?? 0) + 1;
		}
		if (b.review) (lifecycleRatings[b.creator] ??= []).push(b.review.rating);
	}

	for (const seedCreator of CREATORS) {
		const creatorId = creatorIds[seedCreator.username];
		if (!creatorId) continue;

		/* The ratings this creator's reviews will carry, minus the ones the
		   lifecycle bookings already wrote. */
		const ratings = ratingSpread(seedCreator.reviews, seedCreator.rating);
		for (const written of lifecycleRatings[seedCreator.username] ?? []) {
			const at = ratings.indexOf(written);
			ratings.splice(at >= 0 ? at : ratings.length - 1, 1);
		}
		const plan = shuffled(ratings, seedCreator.username);

		/* A shuffled pool per band, walked in order, so one creator's reviews
		   do not repeat a sentence until the pool runs out. */
		const bodies = {
			5: shuffled(FIVE_STAR_BODIES, `${seedCreator.username}:5`),
			4: shuffled(FOUR_STAR_BODIES, `${seedCreator.username}:4`),
			3: shuffled(THREE_STAR_BODIES, `${seedCreator.username}:3`)
		} as Record<number, string[]>;
		const used: Record<number, number> = { 5: 0, 4: 0, 3: 0 };

		const firstName = seedCreator.fullName.split(' ')[0];
		const orgSlugs = ORGANISATIONS.map((org) => org.slug);
		const historyCount = seedCreator.completed - (lifecycleCompleted[seedCreator.username] ?? 0);

		for (let i = 0; i < historyCount; i++) {
			const key = `${seedCreator.username}:${i}`;
			const organizationId = orgIds[orgSlugs[(hashOf(seedCreator.username) + i) % orgSlugs.length]];
			if (!organizationId) continue;

			const brief = pick(HISTORY_BRIEFS, `${key}:brief`);
			const platform = seedCreator.primaryPlatform;
			const price =
				Math.round((seedCreator.startingPrice * pick(PRICE_FACTORS, `${key}:price`)) / 50) * 50;
			const { platformFee, creatorPayout } = splitFee(price, 15);
			const completedAt = daysBefore(20 + i * 18 + (hashOf(key) % 11));
			const bookedAt = daysBefore(20 + i * 18 + (hashOf(key) % 11) + 21);
			const reference = `CN-H${String(creatorId).padStart(3, '0')}-${String(i + 1).padStart(2, '0')}`;
			const title = brief.title.replace('{platform}', platform);
			const deliverables = brief.deliverables.map((d) => d.replace('{platform}', platform));

			const bookingId = await upsert(t.bookings, eq(t.bookings.reference, reference), {
				reference,
				campaignId: null,
				creatorId,
				organizationId,
				title,
				deliverables,
				compensationType: 'paid' as const,
				price,
				currencyCode: seedCreator.currencyCode,
				platformFee,
				creatorPayout,
				status: 'completed' as const,
				escrowStatus: 'released' as const,
				paymentMethod:
					seedCreator.currencyCode === 'ETB' ? ('telebirr' as const) : ('bank_transfer' as const),
				paymentRef: `TELE-ESC-${reference.slice(-6)}`,
				deadline: asDate(completedAt),
				revisionsUsed: 0,
				revisionsAllowed: 2,
				termsSnapshot: {
					title,
					deliverables,
					price,
					currencyCode: seedCreator.currencyCode,
					platformFee,
					creatorPayout,
					compensationType: 'paid' as const,
					revisionsAllowed: 2,
					deadline: asDate(completedAt),
					agreedAt: bookedAt.toISOString(),
					agreedByOrgUserId: null,
					agreedByCreatorUserId: null
				},
				termsFrozenAt: bookedAt,
				completedAt,
				createdAt: bookedAt,
				isActive: true,
				createdBy: adminId
			});

			/* The oldest bookings are the ones left unreviewed — the same shape a
			   real record has, where not every client wrote something. */
			const rating = plan[i];
			if (rating === undefined) continue;

			const band = rating >= 5 ? 5 : rating === 4 ? 4 : 3;
			const pool = bodies[band];
			const body = pool[used[band]++ % pool.length].replace('{first}', firstName);

			await upsert(
				t.reviews,
				and(eq(t.reviews.bookingId, bookingId), eq(t.reviews.direction, 'brand_to_creator'))!,
				{
					bookingId,
					creatorId,
					organizationId,
					direction: 'brand_to_creator' as const,
					rating,
					communication: subScore(rating, `${key}:communication`),
					professionalism: subScore(rating, `${key}:professionalism`),
					timeliness: subScore(rating, `${key}:timeliness`),
					quality: subScore(rating, `${key}:quality`),
					body,
					createdAt: new Date(completedAt.getTime() + 2 * 86_400_000),
					isActive: true,
					createdBy: adminId
				}
			);
		}
	}

	/* The counters on `creators` are caches of the rows above, so they are
	   recomputed from those rows rather than written from the seed literals —
	   the same rollup the app runs after a review is published. */
	console.log('→ recomputing ratings, review counts and completed bookings');
	await recalcCreatorAggregates(db);

	for (const seedCreator of CREATORS) {
		const creatorId = creatorIds[seedCreator.username];
		if (!creatorId) continue;
		const row = (
			await db
				.select({
					averageRating: t.creators.averageRating,
					completedBookings: t.creators.completedBookings
				})
				.from(t.creators)
				.where(eq(t.creators.id, creatorId))
				.limit(1)
		).at(0);
		if (!row) continue;

		const engagement =
			seedCreator.socials.reduce((sum, s) => sum + s.engagement, 0) / seedCreator.socials.length;

		await db
			.update(t.creators)
			.set({
				score: calculateScore({
					fullName: seedCreator.fullName,
					bio: seedCreator.bio,
					avatar: seedCreator.avatar,
					cover: seedCreator.cover,
					categoryCount: seedCreator.categories.length,
					languageCount: seedCreator.languages.length,
					packageCount: seedCreator.packages.length,
					portfolioCount: seedCreator.portfolio.length,
					verificationLevel: seedCreator.verificationLevel,
					engagementRate: engagement,
					averageRating: row.averageRating,
					completedBookings: row.completedBookings
				})
			})
			.where(eq(t.creators.id, creatorId));
	}

	console.log('→ verification queue');
	for (const [username, level] of [
		['selam_comedy_et', 'cn_verified'],
		['kwame_accra_eats', 'identity_verified'],
		['meron_fitness_et', 'identity_verified']
	] as const) {
		const creatorId = creatorIds[username];
		if (!creatorId) continue;
		await upsert(
			t.verificationRequests,
			and(
				eq(t.verificationRequests.creatorId, creatorId),
				eq(t.verificationRequests.status, 'pending')
			)!,
			{
				subjectType: 'creator',
				creatorId,
				requestedLevel: level,
				documentUrl: 'https://example.com/evidence/national-id.pdf',
				socialProofs: ['https://www.tiktok.com/@example', 'https://instagram.com/example'],
				status: 'pending',
				createdBy: adminId
			}
		);
	}

	console.log('\n✓ Seed complete. Sign-in addresses are listed in ACCOUNTS.md.');
	await pool.end();
}

seed().catch(async (err) => {
	console.error(err);
	await pool.end();
	process.exit(1);
});
