import * as m from '$lib/paraglide/messages';
import type { RequestHandler } from './$types';
import { listPostsForFeed } from '$lib/server/queries';
import { assetUrl } from '$lib/assets';

/**
 * The blog as a feed.
 *
 * Only live posts, and only the standfirst rather than the body: a feed that
 * carried the whole article would have to carry its HTML too, and an item's
 * `description` is escaped text in every reader. The link is what the reader
 * follows for the article itself.
 *
 * Capped, because a feed is what is *new* — a reader arriving today does not
 * want the archive, and every reader fetches this repeatedly.
 */
const MAX_ITEMS = 40;

const escape = (value: string) =>
	value.replace(
		/[<>&'"]/g,
		(char) => `&${{ '<': 'lt', '>': 'gt', '&': 'amp', "'": 'apos', '"': 'quot' }[char]};`
	);

/**
 * The MIME type an enclosure claims, taken from the stored extension.
 *
 * The extension is not the client's: `saveUploadedFile` assigns it from the
 * type it verified, so it is the one thing about a stored file that is known
 * to be true. Anything unrecognised — an external URL an operator pasted —
 * gets no enclosure at all rather than a guess, because a reader that trusts
 * the declared type will render a PNG announced as a JPEG as nothing.
 */
const IMAGE_TYPES: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.avif': 'image/avif'
};

const imageType = (url: string): string | null => {
	const match = url.toLowerCase().match(/\.[a-z0-9]+$/);
	return match ? (IMAGE_TYPES[match[0]] ?? null) : null;
};

/** RFC 822, which is what `pubDate` must be — not ISO 8601. */
const rfc822 = (value: Date | string | null): string => {
	if (!value) return '';
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? '' : date.toUTCString();
};

export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const posts = await listPostsForFeed(MAX_ITEMS);

	/* A post an operator asked search engines to skip is skipped here too: a
	   feed is syndication, which is the same request by another route. */
	const items = posts
		.filter((post) => !post.noIndex)
		.map((post) => {
			const link = new URL(`/blog/${post.slug}`, url.origin).href;
			const image = post.featuredImage ? assetUrl(post.featuredImage) : '';
			const absoluteImage = image
				? image.startsWith('http')
					? image
					: new URL(image, url.origin).href
				: '';

			const type = absoluteImage ? imageType(absoluteImage) : null;

			return `	<item>
		<title>${escape(post.title)}</title>
		<link>${escape(link)}</link>
		<guid isPermaLink="true">${escape(link)}</guid>${
			post.publishedAt ? `\n\t\t<pubDate>${rfc822(post.publishedAt)}</pubDate>` : ''
		}${post.categoryName ? `\n\t\t<category>${escape(post.categoryName)}</category>` : ''}${
			post.authorName ? `\n\t\t<dc:creator>${escape(post.authorName)}</dc:creator>` : ''
		}${post.excerpt ? `\n\t\t<description>${escape(post.excerpt)}</description>` : ''}${
			/* `length` is required by the spec and unknown without stat-ing the
			   file; every reader treats zero as "unstated". */
			absoluteImage && type
				? `\n\t\t<enclosure url="${escape(absoluteImage)}" type="${type}" length="0" />`
				: ''
		}
	</item>`;
		})
		.join('\n');

	const self = new URL('/blog/rss.xml', url.origin).href;
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
	<title>${escape(m.blog_title())}</title>
	<link>${escape(new URL('/blog', url.origin).href)}</link>
	<description>${escape(m.blog_meta_description())}</description>
	<language>en</language>
	<atom:link href="${escape(self)}" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>`;

	/* Cached at the edge for an hour: the feed changes only when something is
	   published, and readers poll it far more often than that. */
	setHeaders({
		'Content-Type': 'application/rss+xml; charset=utf-8',
		'Cache-Control': 'public, max-age=0, s-maxage=3600'
	});

	return new Response(body);
};
