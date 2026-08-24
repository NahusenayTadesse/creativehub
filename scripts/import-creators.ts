/**
 * Imports the scraped creator CSV into the schema.
 *
 *   npm run import:creators                          # map + validate, write the JSON, touch no database
 *   npm run import:creators -- --write               # ...and upsert it
 *   npm run import:creators -- --write --skip-existing   # insert new creators only
 *   npm run import:creators -- --file=other.csv --json=out.json --limit=10
 *
 * The mapping itself lives in `src/lib/domain/creator-import.ts` and is unit
 * tested; this file is the two things that cannot be pure — reading the file and
 * resolving natural keys (country code, region name, platform name, category
 * slug) into the ids the foreign keys want.
 *
 * The dry run is the default on purpose: the CSV is a scrape, and the JSON dump
 * is what you read before letting 132 unverified profiles into the database.
 *
 * Re-running never duplicates: creators are matched on `username`, which the
 * schema keeps unique. What a second run does to a creator that is already there
 * depends on the mode.
 *
 * `--write` refreshes the scraped fields — reach, follower counts, location, the
 * derived categories — while leaving an operator's decisions (`isPublished`,
 * `isFeatured`, `isTrending`, `verificationLevel`, the claiming account) alone.
 * That is what you want against a database you own, where the CSV is the source
 * of truth for those numbers.
 *
 * `--skip-existing` does not touch an existing creator at all: no update, no
 * category rewrite, no social account changes. Use it against production, where
 * a profile may have been edited or claimed since it was imported and the CSV is
 * no longer the newer of the two.
 */

/* eslint-disable @typescript-eslint/no-explicit-any --
   The same trade-off `seed.ts` documents: one upsert helper over a dozen
   different tables, run by hand by an operator, writing nothing a user reaches. */
import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Papa from 'papaparse';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { and, eq } from 'drizzle-orm';
import * as t from '../src/lib/server/db/schema';
import {
	AVATAR_COLUMNS,
	EXPECTED_COLUMNS,
	IMPORT_COUNTRIES,
	mapCreatorRows,
	type CsvRow,
	type ImportResult
} from '../src/lib/domain/creator-import';

/* ------------------------------------------------------------------ *
 * Arguments
 * ------------------------------------------------------------------ */

const args = process.argv.slice(2);
const flag = (name: string): string | undefined =>
	args
		.find((arg) => arg.startsWith(`--${name}=`))
		?.split('=')
		.slice(1)
		.join('=');

const csvPath = resolve(
	flag('file') ?? 'african_creator_influencers_132_with_avatars - Creators.csv'
);
const jsonPath = resolve(flag('json') ?? 'scripts/data/creators-import.json');
const limit = Number(flag('limit') ?? 0);
const write = args.includes('--write');
const skipExisting = args.includes('--skip-existing');

/* ------------------------------------------------------------------ *
 * Reference rows the mapping can refer to
 *
 * Names, icons and colours match `seed.ts`. They are only used when a row is
 * missing: the import never rewrites reference data an operator has edited.
 * ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, { name: string; icon: string }> = {
	technology: { name: 'Technology', icon: 'Cpu' },
	'beauty-fashion': { name: 'Beauty & Fashion', icon: 'Sparkles' },
	business: { name: 'Business & Entrepreneurship', icon: 'Briefcase' },
	entertainment: { name: 'Entertainment & Comedy', icon: 'Drama' },
	education: { name: 'Education & Tech', icon: 'GraduationCap' },
	'food-dining': { name: 'Food & Dining', icon: 'UtensilsCrossed' },
	'travel-tourism': { name: 'Travel & Tourism', icon: 'Plane' },
	'sports-fitness': { name: 'Sports & Fitness', icon: 'Dumbbell' },
	lifestyle: { name: 'Lifestyle', icon: 'Heart' },
	finance: { name: 'Finance & Money', icon: 'Landmark' },
	agriculture: { name: 'Agriculture & Agribusiness', icon: 'Sprout' },
	'health-wellness': { name: 'Health & Wellness', icon: 'Stethoscope' }
};

const PLATFORM_COLORS: Record<string, string> = {
	TikTok: '#0f172a',
	Instagram: '#e1306c',
	YouTube: '#ef4444',
	Facebook: '#2563eb',
	Telegram: '#0ea5e9',
	X: '#334155',
	LinkedIn: '#0a66c2'
};

/* ------------------------------------------------------------------ *
 * Read and map
 * ------------------------------------------------------------------ */

function readCsv(path: string): CsvRow[] {
	const parsed = Papa.parse<CsvRow>(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''), {
		header: true,
		skipEmptyLines: true
	});

	const fields = parsed.meta.fields ?? [];
	const missing = EXPECTED_COLUMNS.filter((column) => !fields.includes(column));
	/* The avatar column has had two names; either satisfies the guard. */
	if (!AVATAR_COLUMNS.some((column) => fields.includes(column))) {
		missing.push(AVATAR_COLUMNS.join(' or '));
	}
	if (missing.length) {
		throw new Error(`${path} is missing expected columns: ${missing.join(', ')}`);
	}
	/* A quoted-field error means the rest of the file is misaligned, so it is
	   fatal; anything else is per-row and shows up as a mapping warning. */
	const fatal = parsed.errors.filter((error) => error.type === 'Quotes');
	if (fatal.length) throw new Error(`${path}: ${fatal[0].message} (row ${fatal[0].row})`);

	return parsed.data;
}

function report(result: ImportResult) {
	const totalReach = result.creators.reduce((sum, c) => sum + c.creator.totalReach, 0);
	const socials = result.creators.reduce((sum, c) => sum + c.socials.length, 0);
	const countries = new Set(result.creators.map((c) => c.creator.country));

	console.log(`\n${result.creators.length} creators mapped, ${result.rejected.length} rejected`);
	console.log(`  ${socials} social accounts, ${countries.size} countries`);
	console.log(`  ${totalReach.toLocaleString('en-US')} combined reach`);

	const perCountry = new Map<string, number>();
	for (const { creator } of result.creators) {
		perCountry.set(creator.country, (perCountry.get(creator.country) ?? 0) + 1);
	}
	console.log(
		'  ' +
			[...perCountry.entries()]
				.sort((a, b) => b[1] - a[1])
				.map(([code, count]) => `${code} ${count}`)
				.join(', ')
	);

	for (const row of result.rejected) console.log(`  ✗ ${row.name}: ${row.reason}`);
	if (result.warnings.length) {
		console.log(`\n${result.warnings.length} warnings:`);
		for (const warning of result.warnings) console.log(`  ! ${warning}`);
	}
}

/* ------------------------------------------------------------------ *
 * Write
 * ------------------------------------------------------------------ */

async function importToDatabase(result: ImportResult) {
	if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
	/* The host, so a run against the wrong database is visible in the output. */
	const target = new URL(process.env.DATABASE_URL);
	console.log(
		`\n→ writing to ${target.hostname}:${target.port || 3306}${target.pathname}` +
			` (${skipExisting ? 'skipping creators that already exist' : 'refreshing existing creators'})`
	);

	const pool = mysql.createPool(process.env.DATABASE_URL);
	const db = drizzle(pool, { schema: t, mode: 'default' });

	/** Returns the id of the matching row, inserting `values` when there is none. */
	const ensure = async (table: any, where: any, values: Record<string, unknown>) => {
		const existing = await db.select({ id: table.id }).from(table).where(where).limit(1);
		if (existing.length) return existing[0].id as number;
		const inserted: any = await db.insert(table).values(values);
		return Number(inserted.insertId ?? inserted[0]?.insertId);
	};

	try {
		const usedCountries = new Set(result.creators.map((c) => c.creator.country));
		const countryIds: Record<string, number> = {};
		for (const country of IMPORT_COUNTRIES) {
			if (!usedCountries.has(country.code)) continue;
			countryIds[country.code] = await ensure(t.countries, eq(t.countries.code, country.code), {
				...country,
				isActive: true
			});
		}

		const regionIds: Record<string, number> = {};
		for (const [code, list] of Object.entries(result.regions)) {
			for (const region of list) {
				regionIds[`${code}:${region.name}`] = await ensure(
					t.regions,
					and(eq(t.regions.countryId, countryIds[code]), eq(t.regions.name, region.name))!,
					{
						countryId: countryIds[code],
						name: region.name,
						majorCities: region.majorCities,
						isActive: true
					}
				);
			}
		}

		const platformIds: Record<string, number> = {};
		const platformNames = new Set(
			result.creators.flatMap((c) => [
				c.creator.primaryPlatform,
				...c.socials.map((s) => s.platform)
			])
		);
		for (const name of platformNames) {
			platformIds[name] = await ensure(t.platforms, eq(t.platforms.name, name), {
				name,
				color: PLATFORM_COLORS[name] ?? '#0f172a',
				isActive: true
			});
		}

		const categoryIds: Record<string, number> = {};
		for (const slug of new Set(result.creators.flatMap((c) => c.categories))) {
			const label = CATEGORY_LABELS[slug];
			categoryIds[slug] = await ensure(t.categories, eq(t.categories.slug, slug), {
				slug,
				name: label?.name ?? slug,
				icon: label?.icon ?? 'Sparkles',
				isActive: true
			});
		}

		console.log(
			`→ reference data: ${Object.keys(countryIds).length} countries, ` +
				`${Object.keys(regionIds).length} regions, ${Object.keys(platformIds).length} platforms, ` +
				`${Object.keys(categoryIds).length} categories`
		);

		let created = 0;
		let updated = 0;
		let skipped = 0;

		for (const { creator, categories, socials } of result.creators) {
			/* `creators_username_idx` is unique, so this is also what stops a second
			   run from duplicating anyone: matched, they are updated or skipped. */
			const existing = await db
				.select({ id: t.creators.id })
				.from(t.creators)
				.where(eq(t.creators.username, creator.username))
				.limit(1);

			if (existing.length && skipExisting) {
				skipped++;
				continue;
			}

			const shared = {
				fullName: creator.fullName,
				avatar: creator.avatar,
				cover: creator.cover,
				bio: creator.bio,
				countryId: countryIds[creator.country],
				regionId: creator.region
					? (regionIds[`${creator.country}:${creator.region}`] ?? null)
					: null,
				city: creator.city,
				primaryPlatformId: platformIds[creator.primaryPlatform],
				totalReach: creator.totalReach,
				startingPrice: creator.startingPrice,
				currencyCode: creator.currencyCode,
				score: creator.score
			};

			let creatorId: number;
			if (existing.length) {
				creatorId = existing[0].id;
				/* Only the scraped fields. `isPublished`, `isFeatured`, `isTrending`,
				   `verificationLevel`, `isClaimed` and `userId` are an operator's to
				   set, and a refreshed CSV is not a reason to undo that. */
				await db.update(t.creators).set(shared).where(eq(t.creators.id, creatorId));
				updated++;
			} else {
				const inserted: any = await db.insert(t.creators).values({
					...shared,
					username: creator.username,
					/* No account owns an imported profile until someone claims it. */
					userId: null,
					verificationLevel: creator.verificationLevel,
					availability: creator.availability,
					isFeatured: creator.isFeatured,
					isTrending: creator.isTrending,
					overseasPercentage: creator.overseasPercentage,
					topCountries: creator.topCountries,
					isPublished: creator.isPublished,
					isClaimed: creator.isClaimed,
					isActive: creator.isActive,
					sortOrder: creator.sortOrder
				});
				creatorId = Number(inserted.insertId ?? inserted[0]?.insertId);
				created++;
			}

			/* Categories are derived from the focus line, so the CSV owns them
			   outright and replacing them is the whole update. */
			await db.delete(t.creatorCategories).where(eq(t.creatorCategories.creatorId, creatorId));
			for (const slug of categories) {
				await db.insert(t.creatorCategories).values({ creatorId, categoryId: categoryIds[slug] });
			}

			/* Accounts are matched per platform rather than replaced wholesale: a
			   platform the CSV does not know about was added by hand and stays. */
			for (const social of socials) {
				const platformId = platformIds[social.platform];
				const values = {
					handle: social.handle,
					followers: social.followers,
					engagementRate: social.engagementRate,
					profileUrl: social.profileUrl,
					sortOrder: social.sortOrder
				};
				const account = await db
					.select({ id: t.socialAccounts.id })
					.from(t.socialAccounts)
					.where(
						and(
							eq(t.socialAccounts.creatorId, creatorId),
							eq(t.socialAccounts.platformId, platformId)
						)!
					)
					.limit(1);

				if (account.length) {
					await db
						.update(t.socialAccounts)
						.set(values)
						.where(eq(t.socialAccounts.id, account[0].id));
				} else {
					await db.insert(t.socialAccounts).values({
						...values,
						creatorId,
						platformId,
						isVerified: social.isVerified,
						isActive: true
					});
				}
			}
		}

		console.log(
			`→ creators: ${created} inserted, ${updated} updated, ${skipped} skipped (already present)`
		);
		if (created) {
			console.log('  imported profiles are unpublished — release them from the admin dashboard');
		}
	} finally {
		await pool.end();
	}
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

const rows = readCsv(csvPath);
console.log(`${csvPath}: ${rows.length} rows`);

const result = mapCreatorRows(limit > 0 ? rows.slice(0, limit) : rows);
report(result);

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(
	jsonPath,
	JSON.stringify(
		{
			source: csvPath,
			countries: IMPORT_COUNTRIES.filter((country) =>
				result.creators.some((c) => c.creator.country === country.code)
			),
			regions: result.regions,
			creators: result.creators,
			rejected: result.rejected,
			warnings: result.warnings
		},
		null,
		'\t'
	) + '\n'
);
console.log(`\n→ ${jsonPath}`);

if (write) {
	await importToDatabase(result);
} else {
	console.log('  dry run — pass --write to upsert this into the database');
}
