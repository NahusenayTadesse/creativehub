import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

/**
 * The public surface, for crawlers.
 *
 * Only what is genuinely public and genuinely indexable: published creator
 * profiles and published briefs. The dashboard, the sign-in pages and the file
 * routes are deliberately absent — a sitemap is a claim that these URLs are
 * worth fetching, not a directory of everything that responds.
 *
 * Capped, because a sitemap has a 50,000-URL limit and a marketplace does not.
 * Past that the answer is an index of several sitemaps, which is worth writing
 * when there is something to index.
 */
const MAX_URLS = 20_000;

/** Only ever `2024-01-31` — a bare date is a valid W3C datetime for lastmod. */
const day = (value: Date | string | null | undefined): string | null => {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const escape = (value: string) =>
	value.replace(
		/[<>&'"]/g,
		(char) => `&${{ '<': 'lt', '>': 'gt', '&': 'amp', "'": 'apos', '"': 'quot' }[char]};`
	);

type Entry = { path: string; lastmod?: string | null; changefreq: string; priority: string };

export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const [creators, campaigns] = await Promise.all([
		db
			.select({ username: t.creators.username, updatedAt: t.creators.updatedAt })
			.from(t.creators)
			.where(
				and(
					isNull(t.creators.deletedAt),
					eq(t.creators.isActive, true),
					eq(t.creators.isPublished, true)
				)
			)
			.orderBy(desc(t.creators.updatedAt))
			.limit(MAX_URLS),
		db
			.select({ slug: t.campaigns.slug, updatedAt: t.campaigns.updatedAt })
			.from(t.campaigns)
			.where(and(isNull(t.campaigns.deletedAt), eq(t.campaigns.status, 'published')))
			.orderBy(desc(t.campaigns.updatedAt))
			.limit(MAX_URLS)
	]);

	const entries: Entry[] = [
		{ path: '/', changefreq: 'daily', priority: '1.0' },
		{ path: '/discover', changefreq: 'daily', priority: '0.9' },
		{ path: '/campaigns', changefreq: 'daily', priority: '0.9' },
		...creators.map((creator) => ({
			path: `/creators/${creator.username}`,
			lastmod: day(creator.updatedAt),
			changefreq: 'weekly',
			priority: '0.7'
		})),
		...campaigns.map((campaign) => ({
			path: `/campaigns/${campaign.slug}`,
			lastmod: day(campaign.updatedAt),
			changefreq: 'daily',
			priority: '0.8'
		}))
	];

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
	.map(
		(entry) => `	<url>
		<loc>${escape(new URL(entry.path, url.origin).href)}</loc>${
			entry.lastmod ? `\n\t\t<lastmod>${entry.lastmod}</lastmod>` : ''
		}
		<changefreq>${entry.changefreq}</changefreq>
		<priority>${entry.priority}</priority>
	</url>`
	)
	.join('\n')}
</urlset>
`;

	setHeaders({ 'content-type': 'application/xml', 'cache-control': 'public, max-age=3600' });
	return new Response(body);
};
